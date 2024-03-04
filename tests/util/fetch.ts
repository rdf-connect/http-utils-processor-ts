import { jest } from "@jest/globals";
export import Mock = jest.Mock;
import { Auth } from "../../src/auth";
import OAuth2Server from "@node-oauth/oauth2-server";
import { MockPasswordModel } from "../auth/passwordGrant";

export type FetchArgs = {
    status?: number;
    timeout?: number;
    nullBody?: boolean;
    credentials?: Auth;
};

export const OAuth2PasswordGrantMock: typeof fetch = (async (req: Request) => {
    const res = new Response();
    const authReq = new OAuth2Server.Request(req);
    const authRes = new OAuth2Server.Response(res);
    const server = new OAuth2Server({
        model: new MockPasswordModel(),
    });
    await server.authenticate(authReq, authRes);
    return res;
}) as typeof fetch;

export class Fetch {
    private fetch: Mock<typeof fetch> = jest.fn(Fetch.build());

    private static build(args: FetchArgs = {}): typeof fetch {
        return (async (req: Request) => {
            // If the url is the OAuth2 password grant endpoint, call the mock.
            if (req.url === "/auth/oauth2/password-grant") {
                return OAuth2PasswordGrantMock(req);
            }

            // Insert timeout if needed.
            await new Promise((resolve) =>
                setTimeout(resolve, args.timeout ?? 0),
            );

            // If credentials are supplied, check them.
            if (args.credentials && !args.credentials.check(req)) {
                return new Response("Unauthorized", {
                    status: 401,
                });
            }

            // Return response with requested body and status.
            return new Response(args.nullBody ? null : "Hello, World!", {
                status: args.status ?? 200,
            });
        }) as typeof fetch;
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
