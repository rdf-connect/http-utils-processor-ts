/**
 * Enumeration of the different types of errors that can be thrown by
 * HttpUtils.
 */
enum HttpUtilsErrorType {
    StatusCodeNotAccepted,
    NoBodyInResponse,
    InvalidStatusCodeRange,
    InvalidHeaders,
    GenericFetchError,
    IllegalParameters,
    ConnectionError,
    TimeOutError,
}

/**
 * Extension of the Error class specifically designed for HttpFetch.
 */
export class HttpUtilsError extends Error {
    readonly type: HttpUtilsErrorType;

    constructor(message: string, type: HttpUtilsErrorType) {
        super(message);
        this.name = "HttpUtilsError";
        this.type = type;
    }

    static statusCodeNotAccepted(statusCode: number) {
        return new HttpUtilsError(
            `Status code ${statusCode} not accepted`,
            HttpUtilsErrorType.StatusCodeNotAccepted,
        );
    }

    static noBodyInResponse() {
        return new HttpUtilsError(
            "No body in response",
            HttpUtilsErrorType.NoBodyInResponse,
        );
    }

    static invalidStatusCodeRange() {
        return new HttpUtilsError(
            "Invalid status code range",
            HttpUtilsErrorType.InvalidStatusCodeRange,
        );
    }

    static invalidHeaders() {
        return new HttpUtilsError(
            "Invalid headers",
            HttpUtilsErrorType.InvalidHeaders,
        );
    }

    static genericFetchError() {
        return new HttpUtilsError(
            "Generic fetch error",
            HttpUtilsErrorType.GenericFetchError,
        );
    }

    static illegalParameters(info: string | null = null) {
        return new HttpUtilsError(
            info ?? "Illegal parameters",
            HttpUtilsErrorType.IllegalParameters,
        );
    }

    static connectionError() {
        return new HttpUtilsError(
            "Connection error",
            HttpUtilsErrorType.ConnectionError,
        );
    }

    static timeOutError() {
        return new HttpUtilsError(
            "Request exceeded time limit",
            HttpUtilsErrorType.TimeOutError,
        );
    }
}
