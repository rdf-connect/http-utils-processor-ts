import { SimpleStream } from "@ajuvercr/js-runner";
import { Auth } from "../src/auth";
import { httpFetch } from "../src";

export interface HttpFetchParams {
    url?: string;
    method?: string;
    writeStream?: SimpleStream<Buffer>;
    bodyCanBeEmpty?: boolean;
    headers?: string[];
    acceptStatusCodes?: string[];
    timeout?: number;
    closeOnEnd?: boolean;
    auth?: Auth;
}

export function HttpFetch(params: HttpFetchParams) {
    return httpFetch(
        params.url ?? "http://example.com",
        params.method ?? "GET",
        params.writeStream ?? new SimpleStream<Buffer>(),
        params.closeOnEnd ?? true,
        params.headers ?? [],
        params.acceptStatusCodes ?? ["200-300"],
        params.bodyCanBeEmpty ?? false,
        params.timeout,
        params.auth,
    );
}
