import { describe, test, expect } from "@jest/globals";
import { HttpBasicAuth, OAuth2PasswordAuth } from "../../src/auth";
import { HttpFetch } from "../index";
import { SimpleStream } from "@ajuvercr/js-runner";
import { HttpUtilsError } from "../../src/error";

describe("Real world datasets", () => {
    test(
        "RINF - success",
        async () => {
            const username = process.env["RINF_USERNAME"];
            const password = process.env["RINF_PASSWORD"];

            if (!username || !password) {
                throw new Error("RINF_USERNAME and RINF_PASSWORD must be set");
            }

            const credentials = new OAuth2PasswordAuth(
                username,
                password,
                "https://rinf.era.europa.eu/api/token",
            );

            // Output stream which we'll check for correctness.
            const writeStream = new SimpleStream<Buffer>();

            let output = "";
            writeStream
                .data((data) => {
                    output += data;
                })
                .on("end", () => {
                    const json = JSON.parse(output);
                    expect(json["@odata.context"]).toEqual(
                        "https://rinf.era.europa.eu/API/$metadata#DatasetImports",
                    );
                });

            // Execute the function.
            const func = await HttpFetch({
                url: "https://rinf.era.europa.eu/api/DatasetImports",
                auth: credentials,
                writeStream,
            });

            await func();
        },
        10 * 1000,
    );

    test(
        "RINF - missing credentials",
        async () => {
            const func = await HttpFetch({
                url: "https://rinf.era.europa.eu/api/DatasetImports",
            });

            return expect(func()).rejects.toThrow(
                HttpUtilsError.unauthorizedError(),
            );
        },
        10 * 1000,
    );

    test(
        "RINF - invalid credentials",
        async () => {
            const credentials = new OAuth2PasswordAuth(
                "invalid",
                "invalid",
                "https://rinf.era.europa.eu/api/token",
            );

            const func = await HttpFetch({
                url: "https://rinf.era.europa.eu/api/DatasetImports",
                auth: credentials,
            });

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

            const credentials = new HttpBasicAuth(username, password);

            const func = await HttpFetch({
                url: "https://www.marinespecies.org/download/",
                auth: credentials,
            });

            await func();
        },
        10 * 1000,
    );

    test(
        "WoRMS - missing credentials",
        async () => {
            const func = await HttpFetch({
                url: "https://www.marinespecies.org/download/",
            });

            return expect(func()).rejects.toThrow(
                HttpUtilsError.unauthorizedError(),
            );
        },
        10 * 1000,
    );

    test(
        "WoRMS - invalid credentials",
        async () => {
            const func = await HttpFetch({
                url: "https://www.marinespecies.org/download/",
                auth: new HttpBasicAuth("invalid", "invalid"),
            });

            return expect(func()).rejects.toThrow(
                HttpUtilsError.credentialIssue(),
            );
        },
        10 * 1000,
    );

    test(
        "BlueBike - success",
        async () => {
            // Output stream which we'll check for correctness.
            const writeStream = new SimpleStream<Buffer>();

            let output = "";
            writeStream
                .data((data) => {
                    output += data;
                })
                .on("end", () => {
                    expect(JSON.parse(output).length).toBeGreaterThan(100);
                });

            const func = await HttpFetch({
                url: "https://api.blue-bike.be/pub/location",
                writeStream,
            });

            await func();
        }
    )
});
