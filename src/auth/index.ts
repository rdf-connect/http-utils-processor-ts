export interface Auth {
    authorize(req: Request): Promise<void>;
    check(req: Request): boolean;
}
