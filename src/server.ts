import { Processor, Writer } from "@rdfc/js-runner";
import * as http from "http";
import { AddressInfo } from "net";
import { HttpUtilsError } from "./error";

// Bodies larger than this are streamed to the writer chunk-by-chunk instead
// of being buffered in memory, at the cost of a round-trip per chunk.
const DEFAULT_STREAM_THRESHOLD_BYTES = 5 * 1024 * 1024;

type HttpServerArguments = {
    host: string;
    method: string;
    path: string;
    successStatusCode: number;
    streamThresholdBytes: number;
};

function intoServerArguments(
    args: Partial<HttpServerArguments>,
): HttpServerArguments {
    const out: HttpServerArguments = {
        host: args.host ?? "0.0.0.0",
        method: args.method ?? "POST",
        path: args.path ?? "/",
        successStatusCode: args.successStatusCode ?? 200,
        streamThresholdBytes:
            args.streamThresholdBytes ?? DEFAULT_STREAM_THRESHOLD_BYTES,
    };

    if (!out.method) {
        throw HttpUtilsError.illegalParameters("Method cannot be empty.");
    }

    // Sanity check: the path must start with a slash.
    if (!out.path.startsWith("/")) {
        throw HttpUtilsError.illegalParameters(
            `Path must start with '/', got '${out.path}'.`,
        );
    }

    // Sanity check: the status code must be a valid HTTP status code.
    if (
        !Number.isInteger(out.successStatusCode) ||
        out.successStatusCode < 100 ||
        out.successStatusCode > 599
    ) {
        throw HttpUtilsError.illegalParameters(
            `Invalid status code '${out.successStatusCode}'. Must be an integer between 100 and 599.`,
        );
    }

    // Sanity check: the streaming threshold must be a non-negative integer.
    if (
        !Number.isInteger(out.streamThresholdBytes) ||
        out.streamThresholdBytes < 0
    ) {
        throw HttpUtilsError.illegalParameters(
            `Invalid streamThresholdBytes '${out.streamThresholdBytes}'. Must be a non-negative integer.`,
        );
    }

    return out;
}

/**
 * Continues an async iterator that's already had some values pulled off it,
 * replaying those first before yielding the rest. Used to switch a request
 * body from buffering to streaming partway through without losing bytes
 * already read.
 */
async function* continueAsStream(
    buffered: Buffer[],
    iterator: AsyncIterator<Buffer>,
): AsyncGenerator<Buffer> {
    yield* buffered;
    while (true) {
        const { value, done } = await iterator.next();
        if (done) return;
        yield value;
    }
}

/**
 * Starts an HTTP server which writes the body of every incoming request to a
 * writer. This effectively turns an RDF-Connect pipeline into an HTTP endpoint
 * that other services can push data to.
 * @param port The port the server listens on. Use `0` to let the OS assign a
 * free port.
 * @param writer The output channel into which request bodies are written.
 * @param options An instance of HttpServerArguments defining various additional
 * parameters.
 * @throws HttpUtilsError
 */
export type HttpServerArgs = {
    port: number;
    writer: Writer;
    options: Partial<HttpServerArguments>;
};

export class HttpServer extends Processor<HttpServerArgs> {
    protected arguments: HttpServerArguments;
    // Exposed so tests can read the actually bound address when `port` is `0`.
    public server: http.Server;
    // Acts as a semaphore of size 1: chains request processing so only one
    // request's body is read and forwarded to the writer at a time.
    private queue: Promise<void> = Promise.resolve();

    async init(this: HttpServerArgs & this): Promise<void> {
        // Validate the port. `0` is allowed and lets the OS pick a free port.
        if (
            !Number.isInteger(this.port) ||
            this.port < 0 ||
            this.port > 65535
        ) {
            throw HttpUtilsError.invalidPort(this.port);
        }

        // Parse the options as provided by the user.
        this.arguments = intoServerArguments(this.options || {});

        // Create the server. The request handler forwards the body to the
        // writer and acknowledges the request to the client.
        this.server = http.createServer((req, res) =>
            this.handleRequest(req, res),
        );
    }

    async transform(this: HttpServerArgs & this): Promise<void> {
        // nothing
    }

    async produce(this: HttpServerArgs & this): Promise<void> {
        // Start listening and keep the returned promise pending for as long as
        // the server is running. It resolves once the server closes (either
        // because the pipeline was canceled or the process shuts down), and
        // rejects if the server fails to start (e.g. the port is in use).
        return new Promise<void>((resolve, reject) => {
            this.server.on("error", (err) => {
                reject(HttpUtilsError.serverError(err.message));
            });

            // Close the server gracefully when the pipeline is canceled, which
            // resolves this promise.
            this.writer.on("cancel", () => {
                this.server.close();
            });

            this.server.on("close", () => {
                resolve();
            });

            this.server.listen(this.port, this.arguments.host, () => {
                const address = this.server.address() as AddressInfo;
                this.logger.info(
                    `HTTP server listening on ${this.arguments.host}:${address.port} ` +
                        `(accepting ${this.arguments.method} ${this.arguments.path})`,
                );
            });
        });
    }

    /**
     * Handles a single incoming request: validates method and path, reads the
     * body, and writes it to the output channel.
     */
    private handleRequest(
        this: HttpServerArgs & this,
        req: http.IncomingMessage,
        res: http.ServerResponse,
    ): void {
        // Only accept the configured method.
        if (
            (req.method ?? "").toUpperCase() !==
            this.arguments.method.toUpperCase()
        ) {
            this.logger.debug(`Rejected request with method '${req.method}'.`);
            res.writeHead(405, { Allow: this.arguments.method });
            res.end("Method Not Allowed");
            return;
        }

        // Only accept the configured path. `req.url` may contain a query
        // string, so we compare the pathname only.
        const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
        if (pathname !== this.arguments.path) {
            this.logger.debug(`Rejected request to path '${pathname}'.`);
            res.writeHead(404);
            res.end("Not Found");
            return;
        }

        // Queue the actual handling behind any request that's currently being
        // processed, so at most one request is read from and forwarded to the
        // writer at a time.
        this.queue = this.queue.then(() => this.processRequest(req, res));
    }

    /**
     * Reads the body of a single request and forwards it to the writer,
     * responding to the client once that completes. Never rejects, so it's
     * safe to chain onto the processing queue.
     */
    private async processRequest(
        this: HttpServerArgs & this,
        req: http.IncomingMessage,
        res: http.ServerResponse,
    ): Promise<void> {
        try {
            await this.forwardBody(req);
            res.writeHead(this.arguments.successStatusCode);
            res.end();
        } catch (err) {
            this.logger.error(
                `Failed to forward request body to channel: ${(err as Error).message}`,
            );
            res.writeHead(500);
            res.end("Internal Server Error");
        }
    }

    /**
     * Forwards the request body to the writer. Small bodies are buffered in
     * memory and sent in one go; bodies at or above `streamThresholdBytes`
     * are streamed to the writer instead, trading a round-trip per chunk for
     * bounded memory use.
     */
    private async forwardBody(
        this: HttpServerArgs & this,
        req: http.IncomingMessage,
    ): Promise<void> {
        const threshold = this.arguments.streamThresholdBytes;

        // Fast path: a declared Content-Length lets us decide up front,
        // without reading anything into memory first.
        const contentLength = Number(req.headers["content-length"]);
        if (Number.isFinite(contentLength) && contentLength > threshold) {
            this.logger.debug(
                `Streaming request body (Content-Length ${contentLength} bytes).`,
            );
            return this.writer.stream(req);
        }

        // Otherwise buffer chunks as they arrive. If the body turns out to
        // exceed the threshold before it ends (e.g. chunked transfer
        // encoding with no Content-Length), switch to streaming for the
        // remainder without losing the chunks already read.
        const chunks: Buffer[] = [];
        let size = 0;
        const iterator = req[Symbol.asyncIterator]() as AsyncIterator<Buffer>;

        while (true) {
            const { value, done } = await iterator.next();
            if (done) {
                const body = Buffer.concat(chunks);
                this.logger.debug(`Buffered ${body.length} bytes, forwarding.`);
                return this.writer.buffer(body);
            }

            chunks.push(value);
            size += value.length;

            if (size > threshold) {
                this.logger.debug(
                    `Request body exceeded ${threshold} bytes, switching to streaming.`,
                );
                return this.writer.stream(continueAsStream(chunks, iterator));
            }
        }
    }
}
