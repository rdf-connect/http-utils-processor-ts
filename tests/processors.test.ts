import { expect, test, describe } from "vitest";
import { ProcHelper } from "@rdfc/js-runner/lib/testUtils/index";
import { HttpFetch } from "../src";
import { resolve } from "path";

describe("http fetch", () => {
    const pipeline = `
        @prefix rdfc: <https://w3id.org/rdf-connect#>.
        @prefix rdfcp: <https://w3id.org/rdf-connect/processors#>.

        <http://example.com/ns#processor> a rdfcp:HttpFetch;
            rdfcp:url "http://example.com";
            rdfcp:writer <jw>.
    `;

    test("is defined", async () => {
        const helper = new ProcHelper<HttpFetch>();
        await helper.importFile(resolve("./processors.ttl"));

        const config = helper.getConfig("HttpFetch");

        expect(config.location).toBeDefined();
        expect(config.file).toBeDefined();
        expect(config.clazz).toEqual("HttpFetch");
    });

    test("definition", async () => {
        const helper = new ProcHelper<HttpFetch>();
        await helper.importFile(resolve("./processors.ttl"));
        await helper.importInline(resolve("./pipeline.ttl"), pipeline);

        helper.getConfig("HttpFetch");
        const proc = await helper.getProcessor(
            "http://example.com/ns#processor",
        );

        // URL must be set.
        expect(proc.url).toEqual(["http://example.com"]);

        expect(proc.writer.constructor.name).toBe("WriterInstance");
    });

    test("URLs can be written as IRIs", async () => {
        const helper = new ProcHelper<HttpFetch>();
        await helper.importFile(resolve("./processors.ttl"));
        await helper.importInline(
            resolve("./pipeline.ttl"),
            `
            @prefix rdfc: <https://w3id.org/rdf-connect#>.
            @prefix rdfcp: <https://w3id.org/rdf-connect/processors#>.

            <http://example.com/ns#processor> a rdfcp:HttpFetch;
                rdfcp:url <http://example.com/a>, "http://example.com/b";
                rdfcp:writer <jw>.
        `,
        );

        helper.getConfig("HttpFetch");
        const proc = await helper.getProcessor(
            "http://example.com/ns#processor",
        );

        expect([...proc.url].sort()).toEqual([
            "http://example.com/a",
            "http://example.com/b",
        ]);
    });

    test("falls back to its default values", async () => {
        const helper = new ProcHelper<HttpFetch>();
        await helper.importFile(resolve("./processors.ttl"));
        await helper.importInline(resolve("./pipeline.ttl"), pipeline);

        helper.getConfig("HttpFetch");
        const proc = await helper.getProcessor(
            "http://example.com/ns#processor",
        );

        expect(proc.options).toEqual({
            method: "GET",
            headers: [],
            acceptStatusCodes: ["200-300"],
            runOnInit: false,
            errorsAreFatal: true,
            outputAsBuffer: false,
            outputAsStream: false,
        });
    });

    test("falls back to its default values for missing options", async () => {
        const helper = new ProcHelper<HttpFetch>();
        await helper.importFile(resolve("./processors.ttl"));
        await helper.importInline(
            resolve("./pipeline.ttl"),
            `
            @prefix rdfc: <https://w3id.org/rdf-connect#>.
            @prefix rdfcp: <https://w3id.org/rdf-connect/processors#>.

            <http://example.com/ns#processor> a rdfcp:HttpFetch;
                rdfcp:url "http://example.com";
                rdfcp:writer <jw>;
                rdfcp:options [
                    rdfcp:method "POST";
                    rdfcp:outputAsStream true
                ].
        `,
        );

        helper.getConfig("HttpFetch");
        const proc = await helper.getProcessor(
            "http://example.com/ns#processor",
        );

        expect(proc.options).toEqual({
            method: "POST",
            headers: [],
            acceptStatusCodes: ["200-300"],
            runOnInit: false,
            errorsAreFatal: true,
            outputAsBuffer: false,
            outputAsStream: true,
        });
    });
});
