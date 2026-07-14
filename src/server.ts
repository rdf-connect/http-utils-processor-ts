import { Processor, Writer } from "@rdfc/js-runner";
import * as http from "http";
import { AddressInfo } from "net";
import { HttpUtilsError } from "./error";

/**
 * An instance of this class defines how the HTTP server should behave. All
 * fields are optional and contain default values.
 */
class HttpServerArguments {
    // The address the server binds to. Defaults to `0.0.0.0` so the server is
    // reachable from outside its (Docker) container. Use `127.0.0.1` to only
    // accept connections from the local machine.
    public readonly host: string = "0.0.0.0";

    // The HTTP method that is accepted. Requests using any other method are
    // rejected with `405 Method Not Allowed`. Compared case-insensitively.
    public readonly method: string = "POST";

    // The path that is accepted. Requests to any other path are rejected with
    // `404 Not Found`.
    public readonly path: string = "/";

    // The status code returned to the client after the body has been
    // successfully written to the output channel.
    public readonly successStatusCode: number = 200;

    /**
     * Construct a new HttpServerArguments object by overwriting specific fields.
     * @param partial An object which may contain any fields of the class, which
     * will overwrite the default values.
     */
    constructor(partial: Partial<HttpServerArguments>) {
        Object.assign(this, partial);

        // Sanity check: the method must be a non-empty string.
        if (!this.method) {
            throw HttpUtilsError.illegalParameters("Method cannot be empty.");
        }

        // Sanity check: the path must start with a slash.
        if (!this.path.startsWith("/")) {
            throw HttpUtilsError.illegalParameters(
                `Path must start with '/', got '${this.path}'.`,
            );
        }

        // Sanity check: the status code must be a valid HTTP status code.
        if (
            !Number.isInteger(this.successStatusCode) ||
            this.successStatusCode < 100 ||
            this.successStatusCode > 599
        ) {
            throw HttpUtilsError.illegalParameters(
                `Invalid status code '${this.successStatusCode}'. Must be an integer between 100 and 599.`,
            );
        }
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
        this.arguments = new HttpServerArguments(this.options || {});

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

        // Collect the body and forward it to the writer.
        const chunks: Buffer[] = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("error", (err) => {
            this.logger.error(`Error reading request body: ${err.message}`);
            res.writeHead(500);
            res.end("Internal Server Error");
        });
        req.on("end", () => {
            const body = Buffer.concat(chunks).toString();
            this.logger.debug(`Received ${body.length} bytes, forwarding.`);

            this.writer
                .string(body)
                .then(() => {
                    res.writeHead(this.arguments.successStatusCode);
                    res.end();
                })
                .catch((err) => {
                    this.logger.error(
                        `Failed to write request body to channel: ${err.message}`,
                    );
                    res.writeHead(500);
                    res.end("Internal Server Error");
                });
        });
    }
}
