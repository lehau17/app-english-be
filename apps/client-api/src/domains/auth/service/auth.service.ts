import { CreateJwtPayload, JwtPayload, TokenRepository } from '@app/shared';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ChangePasswordDto, ForgotPasswordDto, LoginDto, LogoutDto, RefreshTokenDto, RegisterDto, ResetPasswordDto } from '../dto';
import { AuthRepository } from '../repository';

@Injectable()
export class AuthService {
    constructor(
        private readonly authRepository: AuthRepository,
        private readonly tokenRepository: TokenRepository,
    ) { }

    /**
     * Đăng ký tài khoản mới + trả về token
     */
    async register(dto: RegisterDto) {
        const arrayExist = await Promise.all([
            this.authRepository.findUserForLogin(dto.email),
            this.authRepository.findUserForLogin(dto.phone),
        ]);
        if (arrayExist && arrayExist.some((user) => !!user)) {
            throw new BadRequestException('Email/Phone already exists');
        }
        const user = await this.authRepository.register(dto);

        const payload: CreateJwtPayload = {
            role: 'student',
            sub: user.id,
            email: user.email ?? undefined,
        };
        const token = await this.tokenRepository.generateToken(payload);


        return { ...token, user }
    }


    async changePassword(userId: string, dto: ChangePasswordDto) {
        const existUser = await this.authRepository.findUserForLogin(userId);
        if (!existUser) throw new BadRequestException('User not found');
        const isPasswordValid = await bcrypt.compare(dto.currentPassword, existUser.passwordHash);
        if (!isPasswordValid) throw new BadRequestException('Current password invalid');
        return this.authRepository.changePassword(userId, dto);
    }

    /**
     * Đăng nhập
     */
    async login(dto: LoginDto) {
        const user = await this.authRepository.findUserForLogin(dto.email);
        if (!user) throw new BadRequestException('Invalid credentials');

        if (!user.passwordHash) throw new BadRequestException('No password set for this account');
        if(user.role !== UserRole.student) throw new BadRequestException('Invalid credentials');
        const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!isPasswordValid) throw new BadRequestException('Invalid credentials');

        const payload = {
            sub: user.id,
            email: user.email ?? undefined,
            role: UserRole.student,
        };

        const token = await this.tokenRepository.generateToken(payload);


        return { ...token, user }
    }

    /**
     * Làm mới access token từ refresh token
     */
    async refreshToken(payload: RefreshTokenDto) {
        let decoded: JwtPayload;
        decoded = this.tokenRepository.decodeToken(payload.refreshToken);

        const newTokens = await this.authRepository.refreshToken(decoded.jti);
        if (!newTokens) throw new UnauthorizedException('Refresh token invalid or expired');

        return newTokens;
    }

    /**
     * Đăng xuất
     */
    async logout(refreshToken: LogoutDto) {
        let decoded: JwtPayload;
        decoded = this.tokenRepository.decodeToken(refreshToken.refreshToken);

        await this.authRepository.revokeRefreshToken(decoded.jti);
        return { success: true };
    }
    forgotPassword(dto: ForgotPasswordDto) {
        return true
    }


    resetPassword(dto: ResetPasswordDto) {
        return true
    }


    async adminLogin(dto: LoginDto) {
        const user = await this.authRepository.findUserForLogin(dto.email);
        if (!user || user.role !== UserRole.admin) {
            throw new BadRequestException('Invalid credentials');
        }

        const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!isPasswordValid) {
            throw new BadRequestException('Invalid credentials');
        }

        const payload = {
            sub: user.id,
            email: user.email,
            role: UserRole.admin,
        };

        const token = await this.tokenRepository.generateToken(payload);

        return { ...token, user };
    }

    async adminRegister(dto: RegisterDto) {
        const user = await this.authRepository.register({...dto});
        if (!user) {
            throw new BadRequestException('Failed to register admin user');
        }

        const payload = {
            sub: user.id,
            email: user.email,
            role: UserRole.admin,
        };

        const token = await this.tokenRepository.generateToken(payload);

        return { ...token, user };
    }
}
