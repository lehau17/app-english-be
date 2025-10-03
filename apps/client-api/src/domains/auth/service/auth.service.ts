import { CreateJwtPayload, JwtPayload, TokenRepository } from '@app/shared';
import { KafkaService } from '@app/shared/kafka/kafka.service';
import {
    BadRequestException,
    Injectable,
    Logger,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import {
    ChangePasswordDto,
    ForgotPasswordDto,
    LoginDto,
    LogoutDto,
    RefreshTokenDto,
    RegisterDto,
    ResetPasswordDto,
    UpdateProfileDto,
} from '../dto';
import { AuthRepository } from '../repository';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly tokenRepository: TokenRepository,
    private readonly kafkaService: KafkaService,
    private readonly configService: ConfigService,
  ) {}

  private readonly logger = new Logger(AuthService.name);

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

    return { ...token, user };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const existUser = await this.authRepository.findUserForLogin(userId);
    if (!existUser) throw new BadRequestException('User not found');
    const isPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      existUser.passwordHash,
    );
    if (!isPasswordValid)
      throw new BadRequestException('Current password invalid');
    return this.authRepository.changePassword(userId, dto);
  }

  /**
   * Đăng nhập
   */
  async login(dto: LoginDto) {
    const user = await this.authRepository.findUserForLogin(dto.email);
    if (!user) throw new BadRequestException('Invalid credentials');

    if (!user.passwordHash)
      throw new BadRequestException('No password set for this account');
    if (user.role !== UserRole.student && user.role !== UserRole.teacher)
      throw new BadRequestException('Invalid credentials');
    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) throw new BadRequestException('Invalid credentials');

    const payload = {
      sub: user.id,
      email: user.email ?? undefined,
      role: user.role,
    };

    const token = await this.tokenRepository.generateToken(payload);

    return { ...token, user };
  }

  /**
   * Làm mới access token từ refresh token
   */
  async refreshToken(payload: RefreshTokenDto) {
    const decoded: JwtPayload = this.tokenRepository.decodeToken(
      payload.refreshToken,
    );

    const newTokens = await this.authRepository.refreshToken(decoded.jti);
    if (!newTokens)
      throw new UnauthorizedException('Refresh token invalid or expired');

    return newTokens;
  }

  /**
   * Đăng xuất
   */
  async logout(refreshToken: LogoutDto) {
    const decoded: JwtPayload = this.tokenRepository.decodeToken(
      refreshToken.refreshToken,
    );

    await this.authRepository.revokeRefreshToken(decoded.jti);
    return { success: true };
  }
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.authRepository.findByEmail(
      dto.email.trim().toLowerCase(),
    );

    if (!user) {
      return { success: true };
    }

    await this.authRepository.invalidateUserResetTokens(user.id);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.authRepository.createPasswordResetToken(
      user.id,
      tokenHash,
      expiresAt,
    );

    const appUrl =
      this.configService.get<string>('APP_URL') ?? 'http://localhost:3000';
    const resetLink = `${appUrl}/reset-password?token=${rawToken}`;

    this.kafkaService.send('notifications', {
      id: `password-reset-${user.id}-${Date.now()}`,
      userId: user.id,
      channel: 'email',
      type: 'system',
      title: 'Yêu cầu đặt lại mật khẩu',
      body:
        `Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản tại English Learning. ` +
        `Sử dụng mã sau hoặc nhấp vào liên kết để tiếp tục: ${rawToken}\n${resetLink}`,
      data: {
        action: 'password_reset',
        token: rawToken,
        resetLink,
        expiresAt: expiresAt.toISOString(),
      },
      priority: 'high',
    });

    this.logger.log(`Password reset token dispatched for ${user.email}`);

    return { success: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = crypto
      .createHash('sha256')
      .update(dto.token)
      .digest('hex');
    const record =
      await this.authRepository.findValidPasswordResetToken(tokenHash);

    if (!record) {
      throw new BadRequestException('Reset token invalid or expired');
    }

    await this.authRepository.updatePassword(record.userId, dto.newPassword);
    await this.authRepository.markResetTokenUsed(record.id);
    await this.authRepository.invalidateUserResetTokens(record.userId);

    return { success: true };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.email) {
      const normalizedEmail = dto.email.trim().toLowerCase();
      const existing = await this.authRepository.findByEmail(normalizedEmail);
      if (existing && existing.id !== userId) {
        throw new BadRequestException('Email already in use');
      }
      dto.email = normalizedEmail;
    }

    return this.authRepository.updateProfile(userId, dto);
  }

  async adminLogin(dto: LoginDto) {
    const user = await this.authRepository.findUserForLogin(dto.email);
    if (!user || user.role !== UserRole.admin) {
      throw new BadRequestException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
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

  async parentLogin(dto: LoginDto) {
    const user = await this.authRepository.findUserForLogin(dto.email);
    if (!user || user.role !== UserRole.parent) {
      throw new BadRequestException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new BadRequestException('Invalid credentials');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: UserRole.parent,
    };

    const token = await this.tokenRepository.generateToken(payload);

    return { ...token, user };
  }

  async adminRegister(dto: RegisterDto) {
    const user = await this.authRepository.register({ ...dto });
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

  async me(userId: string) {
    const user = await this.authRepository.findById(userId);

    return {
      ...user,
    };
  }

  /**
   * Check if student has parent
   */
  async hasParent(userId: string) {
    const parentRelation = await this.authRepository.findParentRelation(userId);
    return {
      hasParent: !!parentRelation,
      parentInfo: parentRelation ? {
        id: parentRelation.parent.id,
        displayName: parentRelation.parent.displayName,
        email: parentRelation.parent.email
      } : null
    };
  }
}
