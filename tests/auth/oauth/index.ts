import { OAuth2Server } from 'oauth2-mock-server';
import * as http from "http";

export class OAuth2MockServer extends OAuth2Server {
    private static singleton: OAuth2MockServer | null = null;

    static get(): http.RequestListener {
        if (!OAuth2MockServer.singleton) {
            OAuth2MockServer.singleton = new OAuth2MockServer();
        }

        return OAuth2MockServer.singleton.service.requestHandler;
    }
}
