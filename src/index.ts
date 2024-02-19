import { Writer } from "@treecg/connector-types";
import { HttpUtilsError } from "./error";

/**
 * Parses an array of headers into a Headers object.
 * @param headers Array of headers in the format "key: value".
 * @throw { HttpUtilsError } If the headers are invalid.
 */
function parseHeaders(headers: string[]): Headers {
    const result = new Headers();
    headers.forEach((header) => {
        const [key, value] = header.split(":");
        if (!key || !value) {
            throw HttpUtilsError.invalidHeaders();
        }
        result.append(key.trim(), value.trim());
    });
    return result;
}

/**
 * Checks whether any given status code is accepted by the user.
 * @param statusCode The code to check against.
 * @param acceptStatusCodes a string of comma-separated status codes which
 * is formatted according to the rules specified in `httpFetch`.
 * @throws { HttpUtilsError } If the status code range is invalid.
 */
function statusCodeAccepted(statusCode: number, acceptStatusCodes: string): boolean {
    const pieces = acceptStatusCodes.split(",");

    for (const piece of pieces) {
        if (piece.includes("-")) {
            const [start, end] = piece.split("-").map(Number);

            if ([start, end].some(isNaN)) {
                throw HttpUtilsError.invalidStatusCodeRange();
            }

            if (start <= statusCode && statusCode < end) {
                return true;
            }
        } else {
            const status = Number(piece);
            if (isNaN(status)) {
                throw HttpUtilsError.invalidStatusCodeRange();
            }
            if (statusCode === status) {
                return true;
            }
        }
    }

    return false;
}

/**
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
 * @throws { HttpUtilsError } May throw an error if `fetch` fails, the headers
 * or status code range is invalid, or if the body is empty while not allowed.
 */
export async function httpFetch(
    url: string,
    method: string,
    writer: Writer<string | Buffer>,
    closeOnEnd: boolean = true,
    headers: string[] = [],
    acceptStatusCodes: string = "200-300",
    bodyCanBeEmpty: boolean = false,
) {
    // This is a source processor (i.e, the first processor in a pipeline),
    // therefore we should wait until the rest of the pipeline is set
    // to start pushing down data
    return async () => {
        const res = await fetch(url, {
            method,
            headers: parseHeaders(headers),
        }).catch(() => {
            throw HttpUtilsError.genericFetchError();
        });

        // Check if we accept the status code.
        if (!statusCodeAccepted(res.status, acceptStatusCodes)) {
            throw HttpUtilsError.statusCodeNotAccepted(res.status);
        }

        // Special case if the body is empty. We either throw an error or exit
        // early. Make sure to close the writer.
        if (!res.body) {
            if (!bodyCanBeEmpty) {
                throw HttpUtilsError.noBodyInResponse();
            }

            if (closeOnEnd) {
                await writer.end();
            }

            return;
        }

        // Push the data down the pipeline.
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let data = await reader.read();

        while (!data.done) {
            await writer.push(decoder.decode(data.value));
            data = await reader.read();
        }

        // Optionally close the output stream.
        if (closeOnEnd) {
            await writer.end();
        }
    };
}
