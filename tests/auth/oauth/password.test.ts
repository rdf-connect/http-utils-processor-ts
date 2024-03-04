import {beforeAll, beforeEach, describe, test} from "@jest/globals";
import {OAuth2PasswordAuth} from "../../../src/auth";
import {Fetch} from "../../util/fetch";
import { HttpFetch } from "../..";

const mockFetch = new Fetch();

beforeAll(() => {
    mockFetch.default();
});

beforeEach(() => {
    mockFetch.clear();
    mockFetch.default();
});

describe("httpFetch - runtime", () => {
    const serverUrl = "http://localhost:8080";

    test("oauth2 - successful", async () => {
        const credentials = new OAuth2PasswordAuth(
            "admin",
            "password",
            serverUrl,
        );

        mockFetch.set({
            credentials,
        });

        const func = await HttpFetch({ auth: credentials });
        await func();
    });
});
