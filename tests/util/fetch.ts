import { jest } from "@jest/globals";
export import Mock = jest.Mock;

export type FetchArgs = {
    status?: number;
    timeout?: number;
    nullBody?: boolean;
};

export class Fetch {
    private fetch: Mock<typeof fetch> = jest.fn(Fetch.build());

    private static build(args: FetchArgs = {}): typeof fetch {
        return (async () => {
            await new Promise((resolve) =>
                setTimeout(resolve, args.timeout ?? 0),
            );
            return new Response(args.nullBody ? null : "Hello, World!", {
                status: args.status ?? 200,
            });
        }) satisfies typeof fetch;
    }

    public constructor() {
        global.fetch = this.fetch;
    }

    public getArgs(): Parameters<typeof fetch> {
        if (this.fetch.mock.calls.length == 0) {
            throw new Error("fetch was not called");
        }

        return this.fetch.mock.calls[0];
    }

    public set(args: FetchArgs = {}): Fetch {
        this.fetch.mockImplementation(Fetch.build(args));
        return this;
    }

    public default(): Fetch {
        this.fetch.mockImplementation(Fetch.build({}));
        return this;
    }

    public clear(): Fetch {
        this.fetch.mockClear();
        return this;
    }
}
