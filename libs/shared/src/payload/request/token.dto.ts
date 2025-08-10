export interface JwtPayload {
    jti: string;

    sub: string;

    email?: string;

    deviceToken?: string;

    iat?: number;

    exp?: number;


    userAgent?: string;
}


export class CreateJwtPayload {
    sub: string;
    email?: string;
}
