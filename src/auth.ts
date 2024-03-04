import { HttpUtilsError } from "./error";

export enum AuthType {
    HttpBasicAuth,
    OAuth2PasswordAuth,
}

export interface Auth {
    readonly type: AuthType;
    authorize(req: Request): Promise<void>;
    check(req: Request): boolean;
}

export class HttpBasicAuth implements Auth {
    private readonly username: string;
    private readonly password: string;
    public readonly type: AuthType = AuthType.HttpBasicAuth;

    constructor(username: string, password: string) {
        this.username = username;
        this.password = password;
    }

    encode(): string {
        return (
            "Basic " +
            Buffer.from(`${this.username}:${this.password}`).toString("base64")
        );
    }

    async authorize(req: Request): Promise<void> {
        req.headers.set("Authorization", this.encode());
    }

    check(req: Request): boolean {
        return req.headers.get("Authorization") == this.encode();
    }
}

export class OAuth2PasswordAuth implements Auth {
    private readonly username: string;
    private readonly password: string;
    private readonly endpoint: string;

    public readonly type: AuthType = AuthType.OAuth2PasswordAuth;

    constructor(username: string, password: string, endpoint: string) {
        this.username = username;
        this.password = password;
        this.endpoint = endpoint;
    }

    async authorize(req: Request): Promise<void> {
        const authRequest = new Request(this.endpoint, {
            body: new URLSearchParams({
                grant_type: "password",
                username: this.username,
                password: this.password,
            }),
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
        });

        const authResponse = await fetch(authRequest);

        // Check if request was successful.
        if (!authResponse.ok) {
            throw HttpUtilsError.oAuth2TokenError(authResponse.status);
        }

        // Append the access token to the original request.
        const authData = await authResponse.json();
        const token = authData["access_token"];

        if (!token) {
            throw HttpUtilsError.unauthorizedError();
        }

        req.headers.set("Authorization", `Bearer ${authData.access_token}`);
    }

    check(): boolean {
        throw new Error("Method not implemented.");
    }
}
