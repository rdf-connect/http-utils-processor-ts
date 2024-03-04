export enum AuthType {
    HttpBasicAuth,
}

export interface Auth {
    readonly type: AuthType;
    readonly headerKey: string;
    authorize(headers: Headers): Promise<void>;
    check(header: string): boolean;
}

export class HttpBasicAuth implements Auth {
    private readonly username: string;
    private readonly password: string;

    public readonly headerKey: string = "Authorization";
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

    async authorize(headers: Headers): Promise<void> {
        headers.set("Authorization", this.encode());
    }

    check(header: string): boolean {
        return header == this.encode();
    }
}
