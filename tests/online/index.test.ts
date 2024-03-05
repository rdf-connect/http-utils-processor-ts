import { describe, test, expect } from "@jest/globals";
import { SimpleStream } from "@ajuvercr/js-runner";
import { HttpUtilsError } from "../../src/error";
import { httpFetch } from "../../src";
import { writer } from "../writer";

describe("Real world datasets", () => {
    test(
        "RINF - success",
        async () => {
            // Retrieve credentials.
            const username = process.env["RINF_USERNAME"];
            const password = process.env["RINF_PASSWORD"];

            if (!username || !password) {
                throw new Error("RINF_USERNAME and RINF_PASSWORD must be set");
            }

            // Output stream which we'll check for correctness.
            const writeStream = writer((output) => {
                const json = JSON.parse(output);
                expect(json["@odata.context"]).toEqual(
                    "https://rinf.era.europa.eu/API/$metadata#DatasetImports",
                );
            });

            // Execute the function.
            const func = await httpFetch(
                "https://rinf.era.europa.eu/api/DatasetImports",
                writeStream,
                {
                    auth: {
                        type: "oauth2",
                        username,
                        password,
                        endpoint: "https://rinf.era.europa.eu/api/token",
                    },
                },
            );

            await func();
        },
        10 * 1000,
    );

    test(
        "RINF - missing credentials",
        async () => {
            const func = await httpFetch(
                "https://rinf.era.europa.eu/api/DatasetImports",
                new SimpleStream<Buffer>(),
            );

            return expect(func()).rejects.toThrow(
                HttpUtilsError.unauthorizedError(),
            );
        },
        10 * 1000,
    );

    test(
        "RINF - invalid credentials",
        async () => {
            const func = await httpFetch(
                "https://rinf.era.europa.eu/api/DatasetImports",
                new SimpleStream<Buffer>(),
                {
                    auth: {
                        type: "oauth2",
                        username: "invalid",
                        password: "invalid",
                        endpoint: "https://rinf.era.europa.eu/api/token",
                    },
                },
            );

            return expect(func()).rejects.toThrow(
                HttpUtilsError.oAuth2TokenError(400),
            );
        },
        10 * 1000,
    );

    test(
        "WoRMS - success",
        async () => {
            const username = process.env["WoRMS_USERNAME"];
            const password = process.env["WoRMS_PASSWORD"];

            if (!username || !password) {
                throw new Error(
                    "WoRMS_USERNAME and WoRMS_PASSWORD must be set",
                );
            }

            const func = await httpFetch(
                "https://www.marinespecies.org/download/",
                new SimpleStream<string>(),
                {
                    auth: {
                        type: "basic",
                        username,
                        password,
                    },
                },
            );

            return expect(func()).resolves.toBeUndefined();
        },
        10 * 1000,
    );

    test(
        "WoRMS - missing credentials",
        async () => {
            const func = await httpFetch(
                "https://www.marinespecies.org/download/",
                new SimpleStream<string>(),
            );

            return expect(func()).rejects.toThrow(
                HttpUtilsError.unauthorizedError(),
            );
        },
        10 * 1000,
    );

    test(
        "WoRMS - invalid credentials",
        async () => {
            const func = await httpFetch(
                "https://www.marinespecies.org/download/",
                new SimpleStream<string>(),
                {
                    auth: {
                        type: "basic",
                        username: "invalid",
                        password: "invalid",
                    },
                },
            );

            return expect(func()).rejects.toThrow(
                HttpUtilsError.credentialIssue(),
            );
        },
        10 * 1000,
    );

    test("BlueBike - success", async () => {
        const writeStream = writer((output) => {
            expect(JSON.parse(output).length).toBeGreaterThan(100);
        });

        const func = await httpFetch(
            "https://api.blue-bike.be/pub/location",
            writeStream,
        );

        return expect(func()).resolves.toBeUndefined();
    });
});
