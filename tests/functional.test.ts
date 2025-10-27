import {
    describe,
    expect,
    test,
    beforeEach,
    beforeAll,
    afterAll,
} from "vitest";
import { HttpUtilsError } from "../src/error";
import { Fetch } from "./fetch";
import { HttpFetch, HttpFetchArgs } from "../src";
import { createLogger, transports } from "winston";
import { FullProc, Writer } from "@rdfc/js-runner";
import { channel, createRunner } from "@rdfc/js-runner/lib/testUtils";
import { HttpBasicAuth } from "../src/auth/basic";

const mockFetch = new Fetch();

beforeAll(() => {
    mockFetch.default();
});

beforeEach(() => {
    mockFetch.clear();
    mockFetch.default();
});

afterAll(() => {
    mockFetch.restore();
});

const logger = createLogger({
    transports: new transports.Console({
        level: process.env["DEBUG"] || "info",
    }),
});

async function fromOptions(
    options: Partial<HttpFetchArgs["options"]>,
): Promise<FullProc<HttpFetch>> {
    const runner = createRunner();
    const [outputWriter, outputReader] = channel(runner, "output");
    const o = <FullProc<HttpFetch>>new HttpFetch(
        {
            url: "https://example.com",
            writer: outputWriter,
            options,
        },
        logger,
    );
    await o.init();
    return o;
}

describe("httpFetch - sanity checks", () => {
    test("status code - malformed range", async () => {
        return expect(
            fromOptions({
                acceptStatusCodes: ["2oo-3oo"],
            }),
        ).rejects.toThrow(HttpUtilsError.invalidStatusCodeRange());
    });

    test("headers - malformed", async () => {
        return expect(
            fromOptions({
                headers: ["a: b", "c"],
            }),
        ).rejects.toThrow(HttpUtilsError.invalidHeaders());
    });

    test("empty body - illegal head method", async () => {
        return expect(
            fromOptions({
                method: "HEAD",
                bodyCanBeEmpty: false,
            }),
        ).rejects.toThrow(
            HttpUtilsError.illegalParameters(
                "Cannot use HEAD method with bodyCanBeEmpty set to false",
            ),
        );
    });
});

describe("httpFetch - runtime", () => {
    test("status code - unsuccessful default", async () => {
        mockFetch.set({ status: 500 });
        const func = await fromOptions({});

        return expect(func.produce()).rejects.toThrow(
            HttpUtilsError.statusCodeNotAccepted(500),
        );
    });

    test("status code - unsuccessful overwritten", async () => {
        const func = await fromOptions({
            acceptStatusCodes: ["201"],
        });

        return expect(func.produce()).rejects.toThrow(
            HttpUtilsError.statusCodeNotAccepted(200),
        );
    });

    test("status code - successful range", async () => {
        mockFetch.set({ status: 501 });

        const func = await fromOptions({
            acceptStatusCodes: ["500-502"],
        });

        await func.produce();
    });

    test("status code - successful single", async () => {
        mockFetch.set({ status: 500 });

        const func = await fromOptions({
            acceptStatusCodes: ["500"],
        });

        await func.produce();
    });

    test("headers - successful", async () => {
        const func = await fromOptions({
            headers: ["Content-Type: text/plain", "Accept: text/plain"],
        });

        await func.produce();

        const req = mockFetch.getArgs()[0]! as Request;
        expect(req).toBeDefined();

        // Check varia.
        expect(req.method).toEqual("GET");

        // Check headers.
        expect(req.headers.get("content-type")).toEqual("text/plain");
        expect(req.headers.get("accept")).toEqual("text/plain");
    });

    test("empty body - error", async () => {
        mockFetch.set({ nullBody: true });
        const func = await fromOptions({
            bodyCanBeEmpty: false,
        });

        return expect(func.produce()).rejects.toThrow(
            HttpUtilsError.noBodyInResponse(),
        );
    });

    test("timeout - successful", async () => {
        mockFetch.set({ timeout: 100 });
        const func = await fromOptions({
            timeOutMilliseconds: 500,
        });

        await func.produce();
    });

    test("timeout - exceeded", async () => {
        mockFetch.set({ timeout: 500 });

        const func = await fromOptions({
            timeOutMilliseconds: 100,
        });

        return expect(func.produce()).rejects.toThrow(
            HttpUtilsError.timeOutError(100),
        );
    });

    test("invalid type", async () => {
        return expect(
            fromOptions({
                auth: {
                    type: <"basic">"invalid",
                    username: "admin",
                    password: "password",
                },
            }),
        ).rejects.toThrow(
            HttpUtilsError.illegalParameters("Unknown auth type: 'invalid'"),
        );
    });

    test("successful", async () => {
        mockFetch.set({ credentials: new HttpBasicAuth("admin", "password") });

        const func = await fromOptions({
            auth: {
                type: "basic",
                username: "admin",
                password: "password",
            },
        });

        return expect(func.produce()).resolves.toBeUndefined();
    });

    test("invalid credentials", async () => {
        mockFetch.set({ credentials: new HttpBasicAuth("admin", "password") });

        const func = await fromOptions({
            auth: {
                type: "basic",
                username: "admin",
                password: "invalid",
            },
        });

        return expect(func.produce()).rejects.toThrow(
            HttpUtilsError.credentialIssue(),
        );
    });

    test("no credentials", async () => {
        mockFetch.set({ credentials: new HttpBasicAuth("admin", "password") });

        const func = await fromOptions({});

        return expect(func.produce()).rejects.toThrow(
            HttpUtilsError.unauthorizedError(),
        );
    });

    test("incomplete config", async () => {
        await expect(
            fromOptions({
                auth: {
                    type: "basic",
                    password: "password",
                },
            }),
        ).rejects.toThrow(
            HttpUtilsError.illegalParameters(
                "Username is required for HTTP Basic Auth.",
            ),
        );

        await expect(
            fromOptions({
                auth: {
                    type: "basic",
                    username: "username",
                },
            }),
        ).rejects.toThrow(
            HttpUtilsError.illegalParameters(
                "Password is required for HTTP Basic Auth.",
            ),
        );
    });
});
