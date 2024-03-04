import { describe, expect, test } from "bun:test";
import { statusCodeAccepted } from "../src/util/status";
import { HttpUtilsError } from "../src/error";
import { parseHeaders } from "../src/util/headers";

describe("parseHeaders", () => {
    test("empty", () => {
        const headers: string[] = [];
        const obj = parseHeaders(headers);
        expect(obj.count).toBe(0);
    });

    test("valid", () => {
        const headers = ["a: b", "c: d"];
        const obj = parseHeaders(headers);
        expect(obj.get("a")).toBe("b");
        expect(obj.get("c")).toBe("d");
        expect(obj.count).toBe(2);
    });

    test("invalid", () => {
        const headers = ["a: b", "c"];
        expect(() => parseHeaders(headers)).toThrow(
            HttpUtilsError.invalidHeaders(),
        );
    });
});

describe("statusCodeAccepted", () => {
    const validInput = ["100", "200-300", "400"];

    test("contained as literal", () => {
        expect(statusCodeAccepted(100, validInput)).toBe(true);
    });

    test("contained as range", () => {
        expect(statusCodeAccepted(299, validInput)).toBe(true);
    });

    test("not contained", () => {
        expect(statusCodeAccepted(150, validInput)).toBe(false);
    });

    test("not contained as end of range", () => {
        expect(statusCodeAccepted(300, validInput)).toBe(false);
    });

    test("no accepted status codes", () => {
        expect(statusCodeAccepted(200, [])).toBe(false);
    });

    test("invalid literal - non numerical", () => {
        expect(() => statusCodeAccepted(200, ["200-300", "a"])).toThrow(
            HttpUtilsError.invalidStatusCodeRange(),
        );
    });

    test("invalid range - delimiter", () => {
        expect(() => statusCodeAccepted(0, ["200_300"])).toThrow(
            HttpUtilsError.invalidStatusCodeRange(),
        );
    });

    test("invalid range - non numerical", () => {
        expect(() => statusCodeAccepted(0, ["a-b"])).toThrow(
            HttpUtilsError.invalidStatusCodeRange(),
        );
    });
});
