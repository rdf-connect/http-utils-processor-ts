export interface Auth {
    readonly headerKey: string;
    authorize(headers: Headers): void;
    encode(): string;
    check(header: string): boolean;
}

export class HttpBasicAuth implements Auth {
    private readonly username: string;
    private readonly password: string;
    public readonly headerKey: string = "Authorization";

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

    authorize(headers: Headers): void {
        headers.set("Authorization", this.encode());
    }

    check(header: string): boolean {
        return header == this.encode();
    }
}
