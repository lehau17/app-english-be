import { PrismaRepository } from '@app/database';
import { JwtPayload, TokenRepository } from '@app/shared';
import { Injectable } from '@nestjs/common';

import * as bcrypt from 'bcrypt';
import { ChangePasswordDto, RegisterDto } from '../dto';

@Injectable()
export class AuthRepository {
    constructor(
        private readonly prisma: PrismaRepository,
        private readonly tokenRepository: TokenRepository,
    ) { }

    /**
     * Đăng ký tài khoản mới
     */
    async register(data: RegisterDto) {
        const passwordHash = await bcrypt.hash(data.password, 10);

        const user = await this.prisma.user.create({
            data: {
                email: data.email,
                phone: data.phone,
                passwordHash,
                firstName: data.firstName,
                lastName: data.lastName,
            },
        });

        return user;
    }


    async changePassword(userId: string, dto: ChangePasswordDto) {
        const passwordHash = await bcrypt.hash(dto.newPassword, 10);
        return this.prisma.user.update({
            where: { id: userId },
            data: {
                passwordHash,
            },
        });
    }

    async findUserForLogin(identifier: string) {
        return this.prisma.user.findFirst({
            where: {
                OR: [
                    { email: identifier },
                    { phone: identifier },
                ],
            },
        });
    }

    async storeRefreshToken(userId: string, jti: string, expiresAt: Date) {
        return this.prisma.refreshToken.create({
            data: {
                id: jti,
                userId,
                expiresAt,
            },
        });
    }

    /**
     * Xoá hoặc revoke Refresh Token
     */
    async revokeRefreshToken(jti: string) {
        return this.prisma.refreshToken.updateMany({
            where: { id: jti, revokedAt: null },
            data: { revokedAt: new Date() },
        });
    }

    /**
     * Refresh Token: kiểm tra token hợp lệ, chưa hết hạn, chưa bị revoke
     */
    async refreshToken(jti: string) {
        const token = await this.prisma.refreshToken.findUnique({
            where: { id: jti },
        });

        if (!token || token.revokedAt || token.expiresAt < new Date()) {
            return null;
        }

        const user = await this.prisma.user.findUnique({
            where: { id: token.userId },
        });

        if (!user) return null;

        const payload: JwtPayload = {
            role: 'student',
            jti,
            sub: user.id,
            email: user.email ?? undefined,
        };

        return this.tokenRepository.generateToken(payload);
    }
}
