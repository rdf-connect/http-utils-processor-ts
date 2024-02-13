import { describe, expect, test } from "@jest/globals";
import { SimpleStream } from "@ajuvercr/js-runner";
import { httpFetch } from "../src";

describe("Functional tests for the httpFetch Connector Architecture function", () => {
    test("Given a endpoint, data is read and streamed out", async () => {
        const writeStream = new SimpleStream<string>();

        let output = "";
        writeStream.data(data => {
            output += data;
        }).on("end", () => {
            expect(output.length).toBeGreaterThan(0);
        });

        // Await and execute returned function of processor
        await (await httpFetch("Hello, World!", writeStream))();
    });
});
