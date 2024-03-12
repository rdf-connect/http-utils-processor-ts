import { expect, describe, jest, test } from "@jest/globals";
import { cronify } from "../../src/util/cron";
import { HttpUtilsError } from "../../src/error";

describe("cron", () => {
    test("success", async () => {
        const mock = jest.fn(() => {});
        const callsTheMock = async () => {
            mock();
        };

        // Abusing the comma notation in order to execute every second.
        const zeroToSixty = [...Array(60).keys()];
        const everySecond = `${zeroToSixty.join(",")} * * * * *`;
        await cronify(callsTheMock, everySecond)();

        // After five seconds, the function should be called five times.
        await new Promise((res) => setTimeout(res, 5_000));
        expect(mock).toHaveBeenCalledTimes(5);
    }, 10_000);

    test("invalid cron expression", () => {
        expect(cronify(async () => {}, "")()).rejects.toThrow(
            HttpUtilsError.invalidCronExpression(),
        );
    });
});
