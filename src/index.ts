import { Writer } from "@treecg/connector-types";
import { HttpUtilsError } from "./error";
import { timeout } from "./util/timeout";
import { statusCodeAccepted } from "./util/status";
import { parseHeaders } from "./util/headers";
import { Auth, AuthConfig } from "./auth";
import { cronify } from "./util/cron";

class HttpFetchArgs {
    public readonly method: string = "GET";
    public readonly headers: string[] = [];
    public readonly acceptStatusCodes: string[] = ["200-300"];
    public readonly closeOnEnd: boolean = true;
    public readonly bodyCanBeEmpty: boolean = false;
    public readonly timeOutMilliseconds: number | null = null;
    public readonly auth: AuthConfig | null = null;
    public readonly cron: string | null = null;

    constructor(partial: Partial<HttpFetchArgs>) {
        Object.assign(this, partial);
    }

    public getAuth(): Auth | null {
        return this.auth ? Auth.from(this.auth) : null;
    }
}

/*
 * Fetches data from a HTTP endpoint and streams it to a writer.
 * @param url The URL to fetch data from.
 * @param method The HTTP method to use.
 * @param headers An array of headers in the format "key: value" as strings.
 * @param acceptStatusCodes A string of comma-separated status codes in which
 * either a single number is given, or a range of numbers separated by a
 * hyphen. Note that the first number is inclusive, and the second number is
 * exclusive. For example, "200-210,300".
 * @param writer The writer to stream the data to.
 * @param closeOnEnd Whether to close the writer when the stream ends.
 * @param bodyCanBeEmpty Whether the body can be empty.
 * @param timeOutMilliseconds Time after which the request is considered
 * unsuccessful.
 * @param auth An object containing the username and password for basic.ts
 * http authentication.
 * @throws { HttpUtilsError } May throw an error if `fetch` fails, the headers
 * or status code range is invalid, or if the body is empty while not allowed.
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
        // Add basic.ts auth header supplied. Note that we might only want to do this
        // when a request returns 401 for security reasons.
        if (auth) {
            await auth.authorize(req);
        }

        // Initialize the fetch promise.
        const fetchPromise = fetch(req).catch((err) => {
            throw HttpUtilsError.genericFetchError(err);
        });

        // Wrap the fetch promise in a timeout.
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
            if (res.status == 401 && auth) {
                throw HttpUtilsError.credentialIssue();
            } else if (res.status == 401) {
                throw HttpUtilsError.unauthorizedError();
            } else {
                throw HttpUtilsError.statusCodeNotAccepted(res.status);
            }
        }

        // Special case if the body is empty. We either throw an error or exit
        // early. Make sure to close the writer.
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

        // eslint-disable-next-line no-constant-condition
        while (true) {
            const data = await reader.read().catch(() => {
                throw HttpUtilsError.connectionError();
            });

            if (data.done) {
                break;
            }

            await writer.push(decoder.decode(data.value));
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
