import { Writer } from "@treecg/connector-types";
import { HttpUtilsError } from "./error";
import { timeout } from "./util/timeout";
import { statusCodeAccepted } from "./util/status";
import { parseHeaders } from "./util/headers";
import { Auth, AuthConfig } from "./auth";
import { cronify } from "./util/cron";

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

    /**
     * Construct a new HttpFetchArgs object by overwriting specific fields.
     * @param partial An object which may contain any fields of the class, which
     * will overwrite the default values.
     */
    constructor(partial: Partial<HttpFetchArgs>) {
        Object.assign(this, partial);
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
    url: string,
    writer: Writer<string | Buffer>,
    options: Partial<HttpFetchArgs> = {},
): Promise<() => Promise<void>> {
    // Parse the options as provided by the user.
    const args = new HttpFetchArgs(options);
    const auth = args.getAuth();

    // Sanity check.
    if (!args.bodyCanBeEmpty && args.method == "HEAD") {
        throw HttpUtilsError.illegalParameters(
            "Cannot use HEAD method with bodyCanBeEmpty set to false",
        );
    }

    // Check validity of the status code range. Will throw error if invalid.
    statusCodeAccepted(0, args.acceptStatusCodes);

    // Create request object, throws error if invalid.
    const req = new Request(url, {
        method: options.method,
        headers: parseHeaders(args.headers),
    });

    // This is a source processor (i.e, the first processor in a pipeline),
    // therefore we should wait until the rest of the pipeline is set
    // to start pushing down data
    let result = async () => {
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

            if (args.closeOnEnd) {
                await writer.end();
            }

            return;
        }

        // Push the data down the pipeline.
        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        let data = await reader.read().catch(() => {
            throw HttpUtilsError.connectionError();
        });

        while (!data.done) {
            await writer.push(decoder.decode(data.value));

            data = await reader.read().catch(() => {
                throw HttpUtilsError.connectionError();
            });
        }

        // Optionally close the output stream.
        if (args.closeOnEnd) {
            await writer.end();
        }
    };

    // If a cron expression is given, call the helper function which will
    // wrap the current result inside a scheduler.
    if (args.cron != null) {
        result = cronify(result, args.cron);
    }

    return result;
}
