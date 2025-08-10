import { JwtPayload } from '@app/shared';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignOptions, sign, verify } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { PrismaRepository } from '../prisma.repository';

export class TokenRepository {
    private readonly jwtSecret: string;
    private readonly accessTokenTtl: string;
    private readonly refreshTokenTtl: string;

    constructor(
        private readonly configService: ConfigService,
        private readonly prisma: PrismaRepository,
    ) {
        this.jwtSecret = this.configService.get<string>('JWT_SECRET', 'default_secret');
        this.accessTokenTtl = this.configService.get<string>('ACCESS_TOKEN_EXPIRES_IN', '15m');
        this.refreshTokenTtl = this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN', '7d');
    }

    async generateToken(payload: Omit<JwtPayload, 'jti' | 'iat' | 'exp'>) {
        const accessToken = sign(payload, this.jwtSecret, {
            expiresIn: this.accessTokenTtl,
        } as SignOptions);

        const jti = uuidv4();
        const refreshPayload: JwtPayload = {
            ...payload,
            jti,
        };
        const refreshToken = sign(refreshPayload, this.jwtSecret, {
            expiresIn: this.refreshTokenTtl,
        } as SignOptions);

        const expiresAt = new Date(Date.now() + this.parseTtlToMs(this.refreshTokenTtl));
        await this.prisma.refreshToken.create({
            data: {
                id: jti,
                userId: payload.sub,
                expiresAt,
            },
        });

        return { accessToken, refreshToken };
    }

    decodeToken(token: string): JwtPayload {
        try {
            return verify(token, this.jwtSecret) as JwtPayload;
        } catch {
            throw new UnauthorizedException('Invalid or expired token');
        }
    }

    async revokeToken(jti: string) {
        await this.prisma.refreshToken.updateMany({
            where: { id: jti, revokedAt: null },
            data: { revokedAt: new Date() },
        });
    }

    async refreshToken(oldRefreshToken: string) {
        let payload: JwtPayload;
        try {
            payload = verify(oldRefreshToken, this.jwtSecret) as JwtPayload;
        } catch {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }

        if (!payload.jti || !payload.sub) {
            throw new UnauthorizedException('Malformed refresh token');
        }

        const tokenRecord = await this.prisma.refreshToken.findUnique({
            where: { id: payload.jti },
        });

        if (!tokenRecord || tokenRecord.revokedAt || tokenRecord.expiresAt <= new Date()) {
            throw new UnauthorizedException('Refresh token is no longer valid');
        }

        await this.revokeToken(payload.jti);

        return this.generateToken({
            sub: payload.sub,
            email: payload.email,
            deviceToken: payload.deviceToken,
            userAgent: payload.userAgent,
        });
    }

    private parseTtlToMs(ttl: string): number {
        const match = ttl.match(/^(\d+)([smhd])$/);
        if (!match) {
            throw new BadRequestException('Invalid TTL format, expected e.g. 15m, 7d');
        }

        const value = parseInt(match[1], 10);
        const unit = match[2];
        switch (unit) {
            case 's': return value * 1000;
            case 'm': return value * 60 * 1000;
            case 'h': return value * 60 * 60 * 1000;
            case 'd': return value * 24 * 60 * 60 * 1000;
            default:
                throw new BadRequestException('Invalid TTL unit, must be s/m/h/d');
        }
    }
}
