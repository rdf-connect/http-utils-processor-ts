import { Auth } from ".";

export class HttpBasicAuth implements Auth {
    private readonly username: string;
    private readonly password: string;

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
