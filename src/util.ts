import { HttpUtilsError } from "./error";

/**
 * Parses an array of headers into a Headers object.
 * @param headers Array of headers in the format "key: value".
 * @throw { HttpUtilsError } If the headers are invalid.
 */
export function parseHeaders(headers: string[]): Headers {
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
 *
 * Note that we use `map` over a simple for loop in order to detect invalid
 * status code patterns.
 */
export function statusCodeAccepted(
    statusCode: number,
    acceptStatusCodes: string[],
): boolean {
    return acceptStatusCodes
        .map((it) => {
            // Option A: range
            if (it.includes("-")) {
                const [start, end] = it.split("-").map(Number);

                // Can also fail if a negative integer is given.
                if ([start, end].some(isNaN)) {
                    throw HttpUtilsError.invalidStatusCodeRange();
                }

                return start <= statusCode && statusCode < end;
            }

            // Option B: literal
            const status = Number(it);

            if (isNaN(status)) {
                throw HttpUtilsError.invalidStatusCodeRange();
            }

            return statusCode === status;
        })
        .includes(true);
}
