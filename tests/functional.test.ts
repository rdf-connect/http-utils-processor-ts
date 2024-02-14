import { describe, expect, test } from "@jest/globals";
import { SimpleStream } from "@ajuvercr/js-runner";
import { httpFetch } from "../src";

describe("Functional tests for the httpFetch Connector Architecture function", () => {
    // We initialize a simple Bun server to test our process against. Note that
    // since we cannot simply use `expect` inside of the `fetch` function, so we 
    // pass the required values to the client using the response body.
    const server = Bun.serve({
        fetch(req) {
            return new Response(JSON.stringify({
                greeting: "Hello, World!",
                headers: req.headers,
                method: req.method,
            }));
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
            "Content-Type: text/plain, Accept: text/plain",
            writeStream,
            true,
        ))();
    });
});
