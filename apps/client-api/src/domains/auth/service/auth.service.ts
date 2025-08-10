import { JwtPayload, TokenRepository } from '@app/shared';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { LoginDto, LogoutDto, RefreshTokenDto, RegisterDto } from '../dto';
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
            this.authRepository.findUserForLogin(dto.username),
        ]);
        if (arrayExist && arrayExist.length > 0) {
            throw new BadRequestException('Email/Phone/Username already exists');
        }

        const user = await this.authRepository.register(dto);

        const payload = {
            sub: user.id,
            email: user.email ?? undefined,
        };
        const token = await this.tokenRepository.generateToken(payload);


        return { ...token, user }
    }

    /**
     * Đăng nhập
     */
    async login(dto: LoginDto) {
        const user = await this.authRepository.findUserForLogin(dto.email);
        if (!user) throw new UnauthorizedException('Invalid credentials');

        if (!user.passwordHash) throw new UnauthorizedException('No password set for this account');

        const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

        const payload = {
            sub: user.id,
            email: user.email ?? undefined,
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
}
