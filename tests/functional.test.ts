import { describe, expect, test } from "bun:test";
import { SimpleStream } from "@ajuvercr/js-runner";
import { httpFetch } from "../src";
import { HttpUtilsError } from "../src/error";

interface HttpFetchParams {
    url: string;
    method?: string;
    writeStream?: SimpleStream<Buffer>;
    bodyCanBeEmpty?: boolean;
    headers?: string[];
    acceptStatusCodes?: string[];
    timeout?: number;
    closeOnEnd?: boolean;
}

function HttpFetch(params: HttpFetchParams) {
    return httpFetch(
        params.url,
        params.method ?? "GET",
        params.writeStream ?? new SimpleStream<Buffer>(),
        params.closeOnEnd ?? true,
        params.headers ?? [],
        params.acceptStatusCodes ?? ["200-300"],
        params.bodyCanBeEmpty ?? false,
        params.timeout,
    );
}

describe("httpFetch", () => {
    // We initialize a simple Bun server to test our process against. Note that
    // since we cannot simply use `expect` inside the `fetch` function, so we
    // pass the required values to the client using the response body.
    const server = Bun.serve({
        async fetch(req) {
            const requestUrl = new URL(req.url);
            const bodyQuery = requestUrl.searchParams.get("body");
            const statusQuery = requestUrl.searchParams.get("status");
            const status = statusQuery ? Number(statusQuery) : 200;
            const timeoutQuery = requestUrl.searchParams.get("timeout");

            // If a timeout is request, simply wait for the given time.
            if (timeoutQuery) {
                console.log(timeoutQuery);
                const timeout = Number(timeoutQuery);
                if (Number.isNaN(timeout)) {
                    throw Error("Invalid timeout");
                }
                await new Promise((resolve) => setTimeout(resolve, timeout));
            }

            // Make sure that the request is valid, as a sanity check.
            if (Number.isNaN(status)) {
                throw Error("Invalid status code");
            }

            // If a specific body is requested.
            if (bodyQuery) {
                if (bodyQuery === "empty") {
                    return new Response(null, {
                        status,
                    });
                }

                throw Error("Invalid body query");
            }

            return new Response(
                JSON.stringify({
                    greeting: "Hello, World!",
                    headers: req.headers,
                    method: req.method,
                }),
                {
                    status,
                },
            );
        },
    });

    test("ok", async () => {
        const writeStream = new SimpleStream<Buffer>();

        let output = "";
        writeStream
            .data((data) => {
                output += data;
            })
            .on("end", () => {
                const res = JSON.parse(output);

                // Constants
                expect(res["greeting"]).toEqual("Hello, World!");

                // Headers must be set correctly.
                expect(res["headers"]["content-type"]).toEqual("text/plain");
                expect(res["headers"]["accept"]).toEqual("text/plain");

                // Check whether the correct method was used.
                expect(res["method"]).toEqual("GET");
            });

        // Await and execute returned function of processor.
        const func = await HttpFetch({
            url: server.url.toString(),
            writeStream,
            headers: ["Content-Type: text/plain", "Accept: text/plain"],
        });

        await func();
    });

    test("status code - unsuccessful default", async () => {
        const func = await HttpFetch({
            url: `${server.url.toString()}?status=500`,
        });

        expect(func()).rejects.toThrow(
            HttpUtilsError.statusCodeNotAccepted(500),
        );
    });

    test("status code - unsuccessful overwritten", async () => {
        const func = await HttpFetch({
            url: `${server.url.toString()}?status=200`,
            acceptStatusCodes: ["201-300"],
        });

        expect(func()).rejects.toThrow(
            HttpUtilsError.statusCodeNotAccepted(200),
        );
    });

    test("status code - successful range", async () => {
        const func = await HttpFetch({
            url: `${server.url.toString()}?status=501`,
            acceptStatusCodes: ["500-502"],
        });

        await func();
    });

    test("status code - successful single", async () => {
        const func = await HttpFetch({
            url: `${server.url.toString()}?status=500`,
            acceptStatusCodes: ["500"],
        });

        await func();
    });

    test("status code - malformed range", async () => {
        const func = HttpFetch({
            url: `${server.url.toString()}?status=500`,
            acceptStatusCodes: ["2oo-3oo"],
        });

        expect(func).rejects.toThrow(HttpUtilsError.invalidStatusCodeRange());
    });

    test("headers - successful", async () => {
        const writeStream = new SimpleStream<Buffer>();

        let output = "";
        writeStream
            .data((data) => {
                output += data;
            })
            .on("end", () => {
                const res = JSON.parse(output);

                // Headers must be set correctly.
                expect(res["headers"]["content-type"]).toEqual("text/plain");
                expect(res["headers"]["accept"]).toEqual("text/plain");
            });

        // Await and execute returned function of processor.
        const func = await HttpFetch({
            url: server.url.toString(),
            writeStream,
            headers: ["Content-Type: text/plain", "Accept: text/plain"],
        });

        await func();
    });

    test("headers - malformed", async () => {
        const func = HttpFetch({
            url: server.url.toString(),
            headers: ["Content-Type text/plain"],
        });

        return expect(func).rejects.toThrow(HttpUtilsError.invalidHeaders());
    });

    test("empty body - error", async () => {
        const func = await HttpFetch({
            url: `${server.url.toString()}?body=empty`,
        });

        return expect(func()).toThrow(HttpUtilsError.noBodyInResponse());
    });

    test("empty body - illegal head method", async () => {
        const func = HttpFetch({
            url: `${server.url.toString()}?status=200`,
            method: "HEAD",
            bodyCanBeEmpty: false,
        });

        return expect(func).rejects.toThrow(
            HttpUtilsError.illegalParameters(
                "Cannot use HEAD method with bodyCanBeEmpty set to false",
            ),
        );
    });

    test("timeout - successful", async () => {
        const func = await HttpFetch({
            url: `${server.url.toString()}?timeout=100`,
            timeout: 500,
        });

        await func();
    });

    test("timeout - exceeded", async () => {
        const func = await HttpFetch({
            url: `${server.url.toString()}?timeout=500`,
            timeout: 100,
        });

        return expect(func()).rejects.toThrow(HttpUtilsError.timeOutError());
    });
});
