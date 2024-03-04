import {
    describe,
    expect,
    test,
    beforeEach,
    beforeAll,
    afterAll,
} from "@jest/globals";
import { HttpUtilsError } from "../../src/error";
import { Fetch } from "../fetch";
import { HttpBasicAuth } from "../../src/auth/basic";
import { HttpFetch } from "..";

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

describe("basic.ts auth", () => {
    test("successful", async () => {
        const credentials = new HttpBasicAuth("admin", "password");
        mockFetch.set({ credentials });
        const func = await HttpFetch({ auth: credentials });
        await func();
    });

    test("invalid credentials", async () => {
        const credentials = new HttpBasicAuth("admin", "password");
        const invalidCredentials = new HttpBasicAuth("admin", "invalid");
        mockFetch.set({ credentials });
        const func = await HttpFetch({ auth: invalidCredentials });
        return expect(func()).rejects.toThrow(HttpUtilsError.credentialIssue());
    });

    test("no credentials", async () => {
        const credentials = new HttpBasicAuth("admin", "password");
        mockFetch.set({ credentials });

        const func = await HttpFetch({
            headers: ["Content-Type: text/plain", "Accept: text/plain"],
        });

        return expect(func()).rejects.toThrow(
            HttpUtilsError.unauthorizedError(),
        );
    });
});
