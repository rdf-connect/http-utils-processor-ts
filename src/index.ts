import { Writer } from "@rdfc/js-runner";
import { HttpUtilsError } from "./error";
import { timeout } from "./util/timeout";
import { statusCodeAccepted } from "./util/status";
import { parseHeaders } from "./util/headers";
import { Auth, AuthConfig } from "./auth";
import { cronify } from "./util/cronify";
import { getLoggerFor } from "./util/logUtil";

const logger = getLoggerFor("httpFetch");

/**
 * An instance of this class defines how the process should execute a request
 * against a given URL. All fields are optional and contain default values.
 */
class HttpFetchArgs {
    // The HTTP method to use.
    public readonly method: string = "GET";

    // A list of strings specifying which headers to embed in the request.
    // Must be in `key: value` format.
    public readonly headers: string[] = [];

    // A list of integer literals or integer ranges encoded as strings. For
    // example, `200` and `200-300`. Note that `a-b` is inclusive `a`, exclusive
    // `b`.
    public readonly acceptStatusCodes: string[] = ["200-300"];

    // Indicate the channel must be closed when the response has been
    // transmitted.
    public readonly closeOnEnd: boolean = true;

    // Whether to throw an error when the body is empty or not. Note that this
    // cannot be used in conjunction with `method = "HEAD"`.
    public readonly bodyCanBeEmpty: boolean = false;

    // How much time a request might take before an error is thrown. If `null`,
    // no timeout is set.
    public readonly timeOutMilliseconds: number | null = null;

    // Configuration of authentication. If `null`, no authentication is used.
    public readonly auth: AuthConfig | null = null;

    // Cron expression which indicates how often the function should be run. If
    // `null`, the function returns immediately after one call.
    public readonly cron: string | null = null;

    // Instantly triggers the fetch function post initialization. This only works
    // if `cron` is not set to `null` (otherwise, this is the default behavior).
    public readonly runOnInit: boolean = false;

    // If set, any error on any request will terminate the processor.
    public readonly errorsAreFatal: boolean = true;

    // If set, the output will be returned as a buffer instead of a string.
    public readonly outputAsBuffer: boolean = false;

    /**
     * Construct a new HttpFetchArgs object by overwriting specific fields.
     * @param partial An object which may contain any fields of the class, which
     * will overwrite the default values.
     */
    constructor(partial: Partial<HttpFetchArgs>) {
        Object.assign(this, partial);

        // Sanity check.
        if (!partial.bodyCanBeEmpty && partial.method == "HEAD") {
            throw HttpUtilsError.illegalParameters(
                "Cannot use HEAD method with bodyCanBeEmpty set to false",
            );
        }

        // Sanity check.
        if (partial.closeOnEnd && partial.cron !== null) {
            throw HttpUtilsError.illegalParameters(
                "Cannot close stream when using cron.",
            );
        }

        // TODO: Find neat solution for this problem. Since JS-Runner uses an
        // empty list as a default value, it will always be overwritten using
        // Object.assign.
        if (this.acceptStatusCodes.length === 0) {
            this.acceptStatusCodes.push("200-300");
        }

        // Check validity of the status code range. Will throw error if invalid.
        statusCodeAccepted(0, this.acceptStatusCodes);
    }

    /**
     * Construct an `Auth` object based on the parameters given by the user.
     * Note that this may return `null` if no authentication method is set.
     */
    public getAuth(): Auth | null {
        return this.auth ? Auth.from(this.auth) : null;
    }
}

/**
 * Fetches data from an HTTP endpoint and streams it to a writer.
 * @param url The URL to fetch data from.
 * @param writer The output channel into which the body will be written.
 * @param options An instance of HttpFetchArgs defining various additional
 * parameters.
 * @throws HttpUtilsError
 */
export async function httpFetch(
    url: string | string[],
    writer: Writer<string | Buffer>,
    options: Partial<HttpFetchArgs> = {},
): Promise<() => Promise<void>> {
    // If only a single URL is given, we save it as an array anyway.
    url = (Array.isArray(url) ? url : [url]) as string[];

    // Parse the options as provided by the user.
    const args = new HttpFetchArgs(options);
    const auth = args.getAuth();

    // Create request objects, throws error if invalid.
    const headers = parseHeaders(args.headers);
    const requests = url.map((x) => {
        return new Request(x, {
            method: options.method,
            headers,
        });
    });

    // This function takes a single request and executes it. Can be run in
    // parallel.
    const executeRequest = async (req: Request): Promise<void> => {
        logger.debug(`Executing request to '${req.url}'...`);

        // Authentication the request before executing it. We do this every time
        // to assure credentials don't expire.
        if (auth) {
            await auth.authorize(req);
        }

        // Initialize the fetch promise.
        const fetchPromise = fetch(req).catch((err) => {
            throw HttpUtilsError.genericFetchError(err);
        });

        // Wrap the fetch promise in a timeout and execute.
        const res = await timeout(args.timeOutMilliseconds, fetchPromise).catch(
            (err) => {
                if (err === "timeout") {
                    throw HttpUtilsError.timeOutError(args.timeOutMilliseconds);
                } else {
                    throw err;
                }
            },
        );

        // Check if we accept the status code.
        if (!statusCodeAccepted(res.status, args.acceptStatusCodes)) {
            if (res.status === 401 && auth) {
                throw HttpUtilsError.credentialIssue();
            } else if (res.status === 401) {
                throw HttpUtilsError.unauthorizedError();
            } else {
                throw HttpUtilsError.statusCodeNotAccepted(res.status);
            }
        }

        // Special case: if the body is empty. We either throw an error or exit
        // early. Make sure to close the writer if required.
        if (!res.body) {
            if (!args.bodyCanBeEmpty) {
                throw HttpUtilsError.noBodyInResponse();
            }

            // We can assume that closeOnEnd is false when a cron expression is
            // set due to earlier sanity checks.
            if (!args.cron && args.closeOnEnd) {
                await writer.end();
            }

            return;
        }

        // Push the data down the pipeline.
        try {
            const body = args.outputAsBuffer 
                ? Buffer.from(await res.arrayBuffer())
                : await res.text();
            await writer.push(body);
        } catch (e) {
            console.error(e);
        }
    };

    // Executes each individual request and groups them into a single promise.
    // Note that we use Promise.all over Promise.allSettled, which means a
    // single rejected promise would cause the overarching promise to reject as
    // well. Therefore, we only rethrow any potential error if `errorsAreFatal`
    // is set. If set to false,
    let executeAllRequests = async () => {
        const promises = requests.map(executeRequest).map((promise) =>
            promise.catch((err) => {
                // Propagate error to caller if required. Otherwise, simply
                // print to std error.
                if (args.errorsAreFatal) {
                    throw err;
                } else {
                    console.error(err);
                }
            }),
        );

        await Promise.all(promises);

        if (args.closeOnEnd) {
            await writer.end();
        }
    };

    // If a cron expression is given, call the helper function which will
    // wrap the current result inside a scheduler.
    if (args.cron != null) {
        executeAllRequests = cronify(
            executeAllRequests,
            args.cron,
            args.runOnInit,
        );
    }

    return executeAllRequests;
}
