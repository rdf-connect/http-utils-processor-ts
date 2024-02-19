import { describe, expect, test } from "bun:test";
import { SimpleStream } from "@ajuvercr/js-runner";
import { httpFetch } from "../src";
import {HttpUtilsError} from "../src/error";

describe("Functional tests for the httpFetch Connector Architecture function", () => {
    // We initialize a simple Bun server to test our process against. Note that
    // since we cannot simply use `expect` inside the `fetch` function, so we
    // pass the required values to the client using the response body.
    const server = Bun.serve({
        fetch(req) {
            const requestUrl = new URL(req.url);
            const statusQuery = requestUrl.searchParams.get("status");
            const status = statusQuery ? Number(statusQuery) : 200;

            if (Number.isNaN(status)) {
                throw Error("Invalid status code");
            }

            return new Response(JSON.stringify({
                greeting: "Hello, World!",
                headers: req.headers,
                method: req.method,
            }), {
                status,
            });
        },
    });

    test("Given a endpoint, data is read and streamed out", async () => {
        const writeStream = new SimpleStream<Buffer>();

        let output = "";
        writeStream.data(data => {
            output += data;
        }).on("end", () => {
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
        await (await httpFetch(
            server.url.toString(),
            "GET",
            writeStream,
            true,
            ["Content-Type: text/plain", "Accept: text/plain"],
        ))();
    });

    test("Invalid status throws error (default).", async () => {
        const writeStream = new SimpleStream<Buffer>();

        // Await and execute returned function of processor.
        const func = await httpFetch(
            `${server.url.toString()}?status=500`,
            "GET",
            writeStream,
            true,
            ["Content-Type: text/plain", "Accept: text/plain"],
        );

        expect(func()).rejects.toThrow(HttpUtilsError.statusCodeNotAccepted(500));
    });

    test("Deny 200 status code", async () => {
        const writeStream = new SimpleStream<Buffer>();

        // Await and execute returned function of processor.
        const func = await httpFetch(
            `${server.url.toString()}?status=200`,
            "GET",
            writeStream,
            true,
            ["Content-Type: text/plain", "Accept: text/plain"],
            "201-300",
        );

        expect(func()).rejects.toThrow(HttpUtilsError.statusCodeNotAccepted(200));
    })

    test("Explicitly accepted status - range", async () => {
        const writeStream = new SimpleStream<Buffer>();

        // Await and execute returned function of processor.
        const func = await httpFetch(
            `${server.url.toString()}?status=501`,
            "GET",
            writeStream,
            true,
            ["Content-Type: text/plain", "Accept: text/plain"],
            "100,500-502,505",
        );

        await func();
    });

    test("Explicitly accepted status - single", async () => {
        const writeStream = new SimpleStream<Buffer>();

        // Await and execute returned function of processor.
        const func = await httpFetch(
            `${server.url.toString()}?status=500`,
            "GET",
            writeStream,
            true,
            ["Content-Type: text/plain", "Accept: text/plain"],
            "200-300,500,503",
        );

        await func();
    });
});
