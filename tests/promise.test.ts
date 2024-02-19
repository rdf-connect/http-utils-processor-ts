import { describe, expect, test } from "bun:test";
import { timeout } from "../src/promise";

/**
 * A simple promise that resolves after `ms` milliseconds.
 * @param ms The number of milliseconds to wait.
 * @return A promise that resolves after `ms` milliseconds.
 */
function wait(ms: number): Promise<boolean> {
    return new Promise((resolve) => setTimeout(() => resolve(true), ms));
}

describe("Promise utility tests", () => {
    test("timeout: successful", async () => {
        return expect(timeout(500, wait(100))).resolves.toBeTruthy();
    });

    test("timeout: unsuccessful", async () => {
        return expect(timeout(100, wait(500))).rejects.toThrow();
    });
});
