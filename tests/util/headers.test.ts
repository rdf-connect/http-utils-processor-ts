import { describe, expect, test } from "bun:test";
import { parseHeaders } from "../../src/util/headers";
import { HttpUtilsError } from "../../src/error";

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
