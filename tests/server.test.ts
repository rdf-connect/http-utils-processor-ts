import { describe, expect, test } from "vitest";
import { once } from "events";
import { AddressInfo } from "net";
import { resolve } from "path";
import { createLogger, transports } from "winston";
import { FullProc, Reader } from "@rdfc/js-runner";
import { channel, createRunner } from "@rdfc/js-runner/lib/testUtils";
import { ProcHelper } from "@rdfc/js-runner/lib/testUtils/index";
import { HttpServer, HttpServerArgs } from "../src/server";
import { HttpUtilsError } from "../src/error";

const logger = createLogger({
    transports: new transports.Console({
        level: process.env["DEBUG"] || "info",
    }),
});

/**
 * Boot an HttpServer on an OS-assigned port (`port: 0`) and wait until it is
 * actually listening. Returns the processor, its output reader and the bound
 * address so tests can make real HTTP requests to it.
 */
async function startServer(
    options: Partial<HttpServerArgs["options"]> = {},
): Promise<{
    proc: FullProc<HttpServer>;
    reader: Reader;
    address: AddressInfo;
}> {
    const runner = createRunner();
    const [writer, reader] = channel(runner, "output");

    const proc = <FullProc<HttpServer>>(
        new HttpServer({ port: 0, writer, options }, logger)
    );
    await proc.init();

    // produce() only resolves once the server closes, so don't await it here.
    proc.produce().catch(() => {
        /* server closed by the test, ignore */
    });
    await once(proc.server, "listening");

    return { proc, reader, address: proc.server.address() as AddressInfo };
}

/**
 * Start draining a reader into an array in the background. The consumer must
 * keep pulling past the first message, otherwise the runner never acknowledges
 * it as processed (which is what resolves the writer's `string()` call).
 */
function collect(reader: Reader): string[] {
    const out: string[] = [];
    (async () => {
        for await (const message of reader.strings()) {
            out.push(message);
        }
    })();
    return out;
}

describe("httpServer - sanity checks", () => {
    test("invalid port", async () => {
        const runner = createRunner();
        const [writer] = channel(runner, "output");
        const proc = <FullProc<HttpServer>>(
            new HttpServer({ port: 99999, writer, options: {} }, logger)
        );

        await expect(proc.init()).rejects.toThrow(
            HttpUtilsError.invalidPort(99999),
        );
    });

    test("invalid success status code", async () => {
        const runner = createRunner();
        const [writer] = channel(runner, "output");
        const proc = <FullProc<HttpServer>>(
            new HttpServer(
                { port: 0, writer, options: { successStatusCode: 999 } },
                logger,
            )
        );

        await expect(proc.init()).rejects.toThrow(HttpUtilsError);
    });
});

describe("httpServer - runtime", () => {
    test("forwards request body to the writer", async () => {
        const { proc, reader, address } = await startServer({ method: "POST" });

        try {
            // Start consuming before the request is made. `fetch` only resolves
            // once the body has been written to (and acknowledged by) the
            // channel, so `received` is guaranteed populated by then.
            const received = collect(reader);

            const res = await fetch(`http://127.0.0.1:${address.port}/`, {
                method: "POST",
                body: "hello, world!",
            });

            expect(res.status).toBe(200);
            expect(received).toEqual(["hello, world!"]);
        } finally {
            proc.server.close();
        }
    });

    test("returns the configured success status code", async () => {
        const { proc, reader, address } = await startServer({
            method: "POST",
            successStatusCode: 202,
        });

        try {
            const received = collect(reader);
            const res = await fetch(`http://127.0.0.1:${address.port}/`, {
                method: "POST",
                body: "data",
            });

            expect(res.status).toBe(202);
            expect(received).toEqual(["data"]);
        } finally {
            proc.server.close();
        }
    });

    test("rejects a disallowed method with 405", async () => {
        const { proc, address } = await startServer({ method: "POST" });

        try {
            const res = await fetch(`http://127.0.0.1:${address.port}/`, {
                method: "GET",
            });

            expect(res.status).toBe(405);
        } finally {
            proc.server.close();
        }
    });

    test("rejects an unknown path with 404", async () => {
        const { proc, address } = await startServer({
            method: "POST",
            path: "/ingest",
        });

        try {
            const res = await fetch(`http://127.0.0.1:${address.port}/other`, {
                method: "POST",
                body: "data",
            });

            expect(res.status).toBe(404);
        } finally {
            proc.server.close();
        }
    });
});

describe("httpServer - definition", () => {
    const pipeline = `
        @prefix rdfc: <https://w3id.org/rdf-connect#>.

        <http://example.com/ns#processor> a rdfc:HttpServer;
            rdfc:port 8080;
            rdfc:writer <jw>.
    `;

    test("is defined", async () => {
        const helper = new ProcHelper<HttpServer>();
        await helper.importFile(resolve("./processors.ttl"));

        const config = helper.getConfig("HttpServer");

        expect(config.location).toBeDefined();
        expect(config.file).toBeDefined();
        expect(config.clazz).toEqual("HttpServer");
    });

    test("definition", async () => {
        const helper = new ProcHelper<HttpServer>();
        await helper.importFile(resolve("./processors.ttl"));
        await helper.importInline(resolve("./pipeline.ttl"), pipeline);

        helper.getConfig("HttpServer");
        const proc = await helper.getProcessor(
            "http://example.com/ns#processor",
        );

        // Port must be parsed as a number.
        expect(proc.port).toEqual(8080);

        expect(proc.writer.constructor.name).toBe("WriterInstance");
    });
});
