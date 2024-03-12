import { describe, expect, test } from "@jest/globals";
import { httpFetch } from "../../src";
import { SimpleStream } from "@ajuvercr/js-runner";
import { HttpUtilsError } from "../../src/error";

describe("auth", () => {
    test("invalid type", async () => {
        const func = httpFetch(
            "https://example.com",
            new SimpleStream<string>(),
            {
                auth: {
                    type: "invalid" as "oauth2",
                    username: "admin",
                    password: "password",
                },
            },
        );

        return expect(func).rejects.toThrow(
            HttpUtilsError.illegalParameters("Unknown auth type: 'invalid'"),
        );
    });
});
