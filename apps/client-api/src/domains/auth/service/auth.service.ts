import { CreateJwtPayload, JwtPayload, TokenRepository } from '@app/shared';
import {
    BadRequestException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { GamificationService } from '../../gamification/service/gamification.service';
import { ChangePasswordDto, LoginDto, LogoutDto, RefreshTokenDto, RegisterDto } from '../dto';
import { AuthRepository } from '../repository';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly tokenRepository: TokenRepository,
    private readonly gamificationService: GamificationService,
  ) {}

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
    if (user.role !== UserRole.student)
      throw new BadRequestException('Invalid credentials');
    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) throw new BadRequestException('Invalid credentials');

    const payload = {
      sub: user.id,
      email: user.email ?? undefined,
      role: UserRole.student,
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
  forgotPassword() {
    return true;
  }

  resetPassword() {
    return true;
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

    // Get gamification stats from UserStats (already included in findById)
    const gamificationStats = user?.UserStats || {
      xp: 0,
      level: 1,
      coins: 0,
      streakDays: 0,
    };

    // Get daily quests and leaderboard for the user
    let dailyQuests = [];
    let leaderboard = [];
    try {
      dailyQuests = await this.gamificationService.getDailyQuests(userId);
      // Get current week's leaderboard
      const now = new Date();
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      leaderboard = await this.gamificationService.getLeaderboard('weekly', weekStart, weekEnd);
    } catch (error) {
      console.log('Error fetching gamification data:', error.message);
    }

    // Return user with gamification stats
    return {
      ...user,
      ...gamificationStats,
      // Map streakDays to streak for frontend compatibility
      streak: gamificationStats.streakDays,
      // Include gamification data
      dailyQuests,
      leaderboard: leaderboard.map(entry => ({
        id: entry.userId,
        displayName: entry.user.displayName || `${entry.user.firstName} ${entry.user.lastName}`.trim(),
        xp: entry.xp,
      })),
    };
  }
}
