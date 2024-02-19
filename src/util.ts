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
 */
export function statusCodeAccepted(
    statusCode: number,
    acceptStatusCodes: string,
): boolean {
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
