export enum AuthType {
    HttpBasicAuth,
    OAuth2PasswordAuth,
}

export interface Auth {
    readonly type: AuthType;
    authorize(req: Request): Promise<void>;
    check(req: Request): boolean;
}
