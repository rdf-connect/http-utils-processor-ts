import OAuth2Server, { PasswordModel } from "@node-oauth/oauth2-server";

export class MockPasswordModel implements PasswordModel {
    private tokenById: Map<string, OAuth2Server.Token>;

    private admin: OAuth2Server.User = {
        id: 123,
        name: "admin",
    };

    getAccessToken(
        accessToken: string,
    ): Promise<OAuth2Server.Token | OAuth2Server.Falsey> {
        return Promise.resolve(this.tokenById.get(accessToken));
    }

    getClient(
        _clientId: string,
        _clientSecret: string,
    ): Promise<OAuth2Server.Client | OAuth2Server.Falsey> {
        throw new Error("Method not implemented.");
    }

    getUser(
        username: string,
        password: string,
        _client: OAuth2Server.Client,
    ): Promise<OAuth2Server.User | OAuth2Server.Falsey> {
        if (username === "admin" && password === "password") {
            return Promise.resolve(this.admin);
        } else {
            return Promise.resolve(undefined);
        }
    }

    saveToken(
        token: OAuth2Server.Token,
        _client: OAuth2Server.Client,
        _user: OAuth2Server.User,
    ): Promise<OAuth2Server.Token | OAuth2Server.Falsey> {
        this.tokenById.set(token.accessToken, token);
        return Promise.resolve(undefined);
    }
}
