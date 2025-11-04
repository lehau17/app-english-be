import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Set required environment variables before imports
process.env.KAFKA_BROKERS = 'localhost:9092';

// Mock the Kafka module to prevent initialization issues
jest.mock('@app/shared/kafka/kafka.module', () => ({
  KafkaModule: {
    register: jest.fn(() => ({
      module: class MockKafkaModule {},
      providers: [],
      exports: [],
    })),
  },
}));

import { AuthService } from './auth.service';

// Minimal mock implementations for dependencies
const makeMocks = () => {
  const authRepository: any = {
    findUserForLogin: jest.fn(),
    register: jest.fn(),
    changePassword: jest.fn(),
    refreshToken: jest.fn(),
    revokeRefreshToken: jest.fn(),
    findById: jest.fn(),
    findParentRelation: jest.fn(),
    findByEmail: jest.fn(),
    updateProfile: jest.fn(),
    invalidateUserResetTokens: jest.fn(),
    createPasswordResetToken: jest.fn(),
    findValidPasswordResetToken: jest.fn(),
    markResetTokenUsed: jest.fn(),
    updatePassword: jest.fn(),
  };

  const tokenRepository: any = {
    generateToken: jest.fn(),
    decodeToken: jest.fn(),
  };

  const kafkaService: any = {
    send: jest.fn(),
  };

  const configService: any = {
    get: jest.fn((key: string, defaultValue?: any) => {
      if (key === 'APP_URL') return 'http://localhost:3000';
      return defaultValue;
    }),
  };

  return { authRepository, tokenRepository, kafkaService, configService };
};

describe('AuthService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('register', () => {
    it('should successfully register a new user and return token', async () => {
      const { authRepository, tokenRepository, kafkaService, configService } =
        makeMocks();

      const registerDto = {
        email: 'test@example.com',
        phone: '+84901234567',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
      };

      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        phone: '+84901234567',
        firstName: 'John',
        lastName: 'Doe',
      };

      const mockToken = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      authRepository.findUserForLogin.mockResolvedValue(null);
      authRepository.register.mockResolvedValue(mockUser);
      tokenRepository.generateToken.mockResolvedValue(mockToken);

      const service = new AuthService(
        authRepository,
        tokenRepository,
        kafkaService,
        configService,
      );

      const result = await service.register(registerDto);

      expect(result).toEqual({ ...mockToken, user: mockUser });
      expect(authRepository.findUserForLogin).toHaveBeenCalledTimes(2);
      expect(authRepository.findUserForLogin).toHaveBeenCalledWith(
        registerDto.email,
      );
      expect(authRepository.findUserForLogin).toHaveBeenCalledWith(
        registerDto.phone,
      );
      expect(authRepository.register).toHaveBeenCalledWith(registerDto);
      expect(tokenRepository.generateToken).toHaveBeenCalledWith({
        role: 'student',
        sub: mockUser.id,
        email: mockUser.email,
      });
    });

    it('should throw BadRequestException if email already exists', async () => {
      const { authRepository, tokenRepository, kafkaService, configService } =
        makeMocks();

      const registerDto = {
        email: 'existing@example.com',
        phone: '+84901234567',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
      };

      const existingUser = {
        id: 'user-1',
        email: 'existing@example.com',
      };

      authRepository.findUserForLogin.mockImplementation(
        (identifier: string) => {
          if (identifier === registerDto.email)
            return Promise.resolve(existingUser);
          return Promise.resolve(null);
        },
      );

      const service = new AuthService(
        authRepository,
        tokenRepository,
        kafkaService,
        configService,
      );

      await expect(service.register(registerDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.register(registerDto)).rejects.toThrow(
        'Email/Phone already exists',
      );
      expect(authRepository.register).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if phone already exists', async () => {
      const { authRepository, tokenRepository, kafkaService, configService } =
        makeMocks();

      const registerDto = {
        email: 'new@example.com',
        phone: '+84901234567',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
      };

      const existingUser = {
        id: 'user-1',
        phone: '+84901234567',
      };

      authRepository.findUserForLogin.mockImplementation(
        (identifier: string) => {
          if (identifier === registerDto.phone)
            return Promise.resolve(existingUser);
          return Promise.resolve(null);
        },
      );

      const service = new AuthService(
        authRepository,
        tokenRepository,
        kafkaService,
        configService,
      );

      await expect(service.register(registerDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(authRepository.register).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const { authRepository, tokenRepository, kafkaService, configService } =
        makeMocks();

      const loginDto = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: await bcrypt.hash('Password123!', 10),
        role: UserRole.student,
      };

      const mockToken = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      authRepository.findUserForLogin.mockResolvedValue(mockUser);
      tokenRepository.generateToken.mockResolvedValue(mockToken);

      const service = new AuthService(
        authRepository,
        tokenRepository,
        kafkaService,
        configService,
      );

      const result = await service.login(loginDto);

      expect(result).toEqual({ ...mockToken, user: mockUser });
      expect(authRepository.findUserForLogin).toHaveBeenCalledWith(
        loginDto.email,
      );
      expect(tokenRepository.generateToken).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
    });

    it('should throw BadRequestException if user not found', async () => {
      const { authRepository, tokenRepository, kafkaService, configService } =
        makeMocks();

      const loginDto = {
        email: 'nonexistent@example.com',
        password: 'Password123!',
      };

      authRepository.findUserForLogin.mockResolvedValue(null);

      const service = new AuthService(
        authRepository,
        tokenRepository,
        kafkaService,
        configService,
      );

      await expect(service.login(loginDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should throw BadRequestException if password is invalid', async () => {
      const { authRepository, tokenRepository, kafkaService, configService } =
        makeMocks();

      const loginDto = {
        email: 'test@example.com',
        password: 'WrongPassword',
      };

      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: await bcrypt.hash('Password123!', 10),
        role: UserRole.student,
      };

      authRepository.findUserForLogin.mockResolvedValue(mockUser);

      const service = new AuthService(
        authRepository,
        tokenRepository,
        kafkaService,
        configService,
      );

      await expect(service.login(loginDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should throw BadRequestException if user has no password set', async () => {
      const { authRepository, tokenRepository, kafkaService, configService } =
        makeMocks();

      const loginDto = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: null,
        role: UserRole.student,
      };

      authRepository.findUserForLogin.mockResolvedValue(mockUser);

      const service = new AuthService(
        authRepository,
        tokenRepository,
        kafkaService,
        configService,
      );

      await expect(service.login(loginDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'No password set for this account',
      );
    });

    it('should throw BadRequestException if user role is invalid', async () => {
      const { authRepository, tokenRepository, kafkaService, configService } =
        makeMocks();

      const loginDto = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: await bcrypt.hash('Password123!', 10),
        role: UserRole.admin,
      };

      authRepository.findUserForLogin.mockResolvedValue(mockUser);

      const service = new AuthService(
        authRepository,
        tokenRepository,
        kafkaService,
        configService,
      );

      await expect(service.login(loginDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
    });
  });

  describe('changePassword', () => {
    it('should successfully change password with valid current password', async () => {
      const { authRepository, tokenRepository, kafkaService, configService } =
        makeMocks();

      const userId = 'user-1';
      const changePasswordDto = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
      };

      const mockUser = {
        id: userId,
        email: 'test@example.com',
        passwordHash: await bcrypt.hash('OldPassword123!', 10),
      };

      authRepository.findUserForLogin.mockResolvedValue(mockUser);
      authRepository.changePassword.mockResolvedValue({ success: true });

      const service = new AuthService(
        authRepository,
        tokenRepository,
        kafkaService,
        configService,
      );

      const result = await service.changePassword(userId, changePasswordDto);

      expect(result).toEqual({ success: true });
      expect(authRepository.findUserForLogin).toHaveBeenCalledWith(userId);
      expect(authRepository.changePassword).toHaveBeenCalledWith(
        userId,
        changePasswordDto,
      );
    });

    it('should throw BadRequestException if user not found', async () => {
      const { authRepository, tokenRepository, kafkaService, configService } =
        makeMocks();

      const userId = 'nonexistent-user';
      const changePasswordDto = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
      };

      authRepository.findUserForLogin.mockResolvedValue(null);

      const service = new AuthService(
        authRepository,
        tokenRepository,
        kafkaService,
        configService,
      );

      await expect(
        service.changePassword(userId, changePasswordDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.changePassword(userId, changePasswordDto),
      ).rejects.toThrow('User not found');
    });

    it('should throw BadRequestException if current password is invalid', async () => {
      const { authRepository, tokenRepository, kafkaService, configService } =
        makeMocks();

      const userId = 'user-1';
      const changePasswordDto = {
        currentPassword: 'WrongPassword',
        newPassword: 'NewPassword123!',
      };

      const mockUser = {
        id: userId,
        email: 'test@example.com',
        passwordHash: await bcrypt.hash('OldPassword123!', 10),
      };

      authRepository.findUserForLogin.mockResolvedValue(mockUser);

      const service = new AuthService(
        authRepository,
        tokenRepository,
        kafkaService,
        configService,
      );

      await expect(
        service.changePassword(userId, changePasswordDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.changePassword(userId, changePasswordDto),
      ).rejects.toThrow('Current password invalid');
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh token with valid refresh token', async () => {
      const { authRepository, tokenRepository, kafkaService, configService } =
        makeMocks();

      const refreshTokenDto = {
        refreshToken: 'valid-refresh-token',
      };

      const decodedToken = {
        jti: 'jwt-id',
        sub: 'user-1',
        email: 'test@example.com',
        role: 'student',
      };

      const newTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      tokenRepository.decodeToken.mockReturnValue(decodedToken);
      authRepository.refreshToken.mockResolvedValue(newTokens);

      const service = new AuthService(
        authRepository,
        tokenRepository,
        kafkaService,
        configService,
      );

      const result = await service.refreshToken(refreshTokenDto);

      expect(result).toEqual(newTokens);
      expect(tokenRepository.decodeToken).toHaveBeenCalledWith(
        refreshTokenDto.refreshToken,
      );
      expect(authRepository.refreshToken).toHaveBeenCalledWith(
        decodedToken.jti,
      );
    });

    it('should throw UnauthorizedException if refresh token is invalid', async () => {
      const { authRepository, tokenRepository, kafkaService, configService } =
        makeMocks();

      const refreshTokenDto = {
        refreshToken: 'invalid-refresh-token',
      };

      const decodedToken = {
        jti: 'jwt-id',
        sub: 'user-1',
        email: 'test@example.com',
        role: 'student',
      };

      tokenRepository.decodeToken.mockReturnValue(decodedToken);
      authRepository.refreshToken.mockResolvedValue(null);

      const service = new AuthService(
        authRepository,
        tokenRepository,
        kafkaService,
        configService,
      );

      await expect(service.refreshToken(refreshTokenDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshToken(refreshTokenDto)).rejects.toThrow(
        'Refresh token invalid or expired',
      );
    });
  });

  describe('logout', () => {
    it('should successfully logout and revoke refresh token', async () => {
      const { authRepository, tokenRepository, kafkaService, configService } =
        makeMocks();

      const logoutDto = {
        refreshToken: 'valid-refresh-token',
      };

      const decodedToken = {
        jti: 'jwt-id',
        sub: 'user-1',
        email: 'test@example.com',
        role: 'student',
      };

      tokenRepository.decodeToken.mockReturnValue(decodedToken);
      authRepository.revokeRefreshToken.mockResolvedValue(undefined);

      const service = new AuthService(
        authRepository,
        tokenRepository,
        kafkaService,
        configService,
      );

      const result = await service.logout(logoutDto);

      expect(result).toEqual({ success: true });
      expect(tokenRepository.decodeToken).toHaveBeenCalledWith(
        logoutDto.refreshToken,
      );
      expect(authRepository.revokeRefreshToken).toHaveBeenCalledWith(
        decodedToken.jti,
      );
    });
  });

  describe('forgotPassword', () => {
    it('should send password reset email for existing user', async () => {
      const { authRepository, tokenRepository, kafkaService, configService } =
        makeMocks();

      const forgotPasswordDto = {
        email: 'test@example.com',
      };

      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
      };

      authRepository.findByEmail.mockResolvedValue(mockUser);
      authRepository.invalidateUserResetTokens.mockResolvedValue(undefined);
      authRepository.createPasswordResetToken.mockResolvedValue({
        id: 'token-1',
        userId: mockUser.id,
      });

      const service = new AuthService(
        authRepository,
        tokenRepository,
        kafkaService,
        configService,
      );

      const result = await service.forgotPassword(forgotPasswordDto);

      expect(result).toEqual({ success: true });
      expect(authRepository.findByEmail).toHaveBeenCalledWith(
        'test@example.com',
      );
      expect(authRepository.invalidateUserResetTokens).toHaveBeenCalledWith(
        mockUser.id,
      );
      expect(authRepository.createPasswordResetToken).toHaveBeenCalled();
      expect(kafkaService.send).toHaveBeenCalledWith(
        'notifications',
        expect.objectContaining({
          userId: mockUser.id,
          channel: 'email',
          type: 'system',
          title: 'Yêu cầu đặt lại mật khẩu',
        }),
      );
    });

    it('should return success even if user not found (security)', async () => {
      const { authRepository, tokenRepository, kafkaService, configService } =
        makeMocks();

      const forgotPasswordDto = {
        email: 'nonexistent@example.com',
      };

      authRepository.findByEmail.mockResolvedValue(null);

      const service = new AuthService(
        authRepository,
        tokenRepository,
        kafkaService,
        configService,
      );

      const result = await service.forgotPassword(forgotPasswordDto);

      expect(result).toEqual({ success: true });
      expect(authRepository.invalidateUserResetTokens).not.toHaveBeenCalled();
      expect(authRepository.createPasswordResetToken).not.toHaveBeenCalled();
      expect(kafkaService.send).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should successfully reset password with valid token', async () => {
      const { authRepository, tokenRepository, kafkaService, configService } =
        makeMocks();

      const resetPasswordDto = {
        token: 'valid-reset-token',
        newPassword: 'NewPassword123!',
      };

      const mockResetRecord = {
        id: 'reset-1',
        userId: 'user-1',
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() + 3600000),
      };

      authRepository.findValidPasswordResetToken.mockResolvedValue(
        mockResetRecord,
      );
      authRepository.updatePassword.mockResolvedValue(undefined);
      authRepository.markResetTokenUsed.mockResolvedValue(undefined);
      authRepository.invalidateUserResetTokens.mockResolvedValue(undefined);

      const service = new AuthService(
        authRepository,
        tokenRepository,
        kafkaService,
        configService,
      );

      const result = await service.resetPassword(resetPasswordDto);

      expect(result).toEqual({ success: true });
      expect(authRepository.findValidPasswordResetToken).toHaveBeenCalled();
      expect(authRepository.updatePassword).toHaveBeenCalledWith(
        mockResetRecord.userId,
        resetPasswordDto.newPassword,
      );
      expect(authRepository.markResetTokenUsed).toHaveBeenCalledWith(
        mockResetRecord.id,
      );
      expect(authRepository.invalidateUserResetTokens).toHaveBeenCalledWith(
        mockResetRecord.userId,
      );
    });

    it('should throw BadRequestException if reset token is invalid', async () => {
      const { authRepository, tokenRepository, kafkaService, configService } =
        makeMocks();

      const resetPasswordDto = {
        token: 'invalid-reset-token',
        newPassword: 'NewPassword123!',
      };

      authRepository.findValidPasswordResetToken.mockResolvedValue(null);

      const service = new AuthService(
        authRepository,
        tokenRepository,
        kafkaService,
        configService,
      );

      await expect(service.resetPassword(resetPasswordDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.resetPassword(resetPasswordDto)).rejects.toThrow(
        'Reset token invalid or expired',
      );
    });
  });

  describe('updateProfile', () => {
    it('should successfully update profile', async () => {
      const { authRepository, tokenRepository, kafkaService, configService } =
        makeMocks();

      const userId = 'user-1';
      const updateProfileDto = {
        displayName: 'New Display Name',
        firstName: 'John',
        lastName: 'Doe',
      };

      const updatedUser = {
        id: userId,
        ...updateProfileDto,
      };

      authRepository.updateProfile.mockResolvedValue(updatedUser);

      const service = new AuthService(
        authRepository,
        tokenRepository,
        kafkaService,
        configService,
      );

      const result = await service.updateProfile(userId, updateProfileDto);

      expect(result).toEqual(updatedUser);
      expect(authRepository.updateProfile).toHaveBeenCalledWith(
        userId,
        updateProfileDto,
      );
    });

    it('should normalize email and check for duplicates', async () => {
      const { authRepository, tokenRepository, kafkaService, configService } =
        makeMocks();

      const userId = 'user-1';
      const updateProfileDto = {
        email: 'New@Example.COM  ',
      };

      const updatedUser = {
        id: userId,
        email: 'new@example.com',
      };

      authRepository.findByEmail.mockResolvedValue(null);
      authRepository.updateProfile.mockResolvedValue(updatedUser);

      const service = new AuthService(
        authRepository,
        tokenRepository,
        kafkaService,
        configService,
      );

      const result = await service.updateProfile(userId, updateProfileDto);

      expect(authRepository.findByEmail).toHaveBeenCalledWith(
        'new@example.com',
      );
      expect(authRepository.updateProfile).toHaveBeenCalledWith(userId, {
        email: 'new@example.com',
      });
    });

    it('should throw BadRequestException if email is already in use', async () => {
      const { authRepository, tokenRepository, kafkaService, configService } =
        makeMocks();

      const userId = 'user-1';
      const updateProfileDto = {
        email: 'existing@example.com',
      };

      const existingUser = {
        id: 'other-user',
        email: 'existing@example.com',
      };

      authRepository.findByEmail.mockResolvedValue(existingUser);

      const service = new AuthService(
        authRepository,
        tokenRepository,
        kafkaService,
        configService,
      );

      await expect(
        service.updateProfile(userId, updateProfileDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateProfile(userId, updateProfileDto),
      ).rejects.toThrow('Email already in use');
    });
  });

  describe('me', () => {
    it('should return user info', async () => {
      const { authRepository, tokenRepository, kafkaService, configService } =
        makeMocks();

      const userId = 'user-1';
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      authRepository.findById.mockResolvedValue(mockUser);

      const service = new AuthService(
        authRepository,
        tokenRepository,
        kafkaService,
        configService,
      );

      const result = await service.me(userId);

      expect(result).toEqual(mockUser);
      expect(authRepository.findById).toHaveBeenCalledWith(userId);
    });
  });

  describe('hasParent', () => {
    it('should return true with parent info when parent relation exists', async () => {
      const { authRepository, tokenRepository, kafkaService, configService } =
        makeMocks();

      const userId = 'user-1';
      const mockParentRelation = {
        parent: {
          id: 'parent-1',
          displayName: 'Parent Name',
          email: 'parent@example.com',
        },
      };

      authRepository.findParentRelation.mockResolvedValue(mockParentRelation);

      const service = new AuthService(
        authRepository,
        tokenRepository,
        kafkaService,
        configService,
      );

      const result = await service.hasParent(userId);

      expect(result).toEqual({
        hasParent: true,
        parentInfo: {
          id: 'parent-1',
          displayName: 'Parent Name',
          email: 'parent@example.com',
        },
      });
      expect(authRepository.findParentRelation).toHaveBeenCalledWith(userId);
    });

    it('should return false when no parent relation exists', async () => {
      const { authRepository, tokenRepository, kafkaService, configService } =
        makeMocks();

      const userId = 'user-1';

      authRepository.findParentRelation.mockResolvedValue(null);

      const service = new AuthService(
        authRepository,
        tokenRepository,
        kafkaService,
        configService,
      );

      const result = await service.hasParent(userId);

      expect(result).toEqual({
        hasParent: false,
        parentInfo: null,
      });
    });
  });

  describe('adminLogin', () => {
    it('should successfully login admin user', async () => {
      const { authRepository, tokenRepository, kafkaService, configService } =
        makeMocks();

      const loginDto = {
        email: 'admin@example.com',
        password: 'AdminPassword123!',
      };

      const mockUser = {
        id: 'admin-1',
        email: 'admin@example.com',
        passwordHash: await bcrypt.hash('AdminPassword123!', 10),
        role: UserRole.admin,
      };

      const mockToken = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      authRepository.findUserForLogin.mockResolvedValue(mockUser);
      tokenRepository.generateToken.mockResolvedValue(mockToken);

      const service = new AuthService(
        authRepository,
        tokenRepository,
        kafkaService,
        configService,
      );

      const result = await service.adminLogin(loginDto);

      expect(result).toEqual({ ...mockToken, user: mockUser });
      expect(tokenRepository.generateToken).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: UserRole.admin,
      });
    });

    it('should throw BadRequestException if user is not admin', async () => {
      const { authRepository, tokenRepository, kafkaService, configService } =
        makeMocks();

      const loginDto = {
        email: 'student@example.com',
        password: 'Password123!',
      };

      const mockUser = {
        id: 'user-1',
        email: 'student@example.com',
        passwordHash: await bcrypt.hash('Password123!', 10),
        role: UserRole.student,
      };

      authRepository.findUserForLogin.mockResolvedValue(mockUser);

      const service = new AuthService(
        authRepository,
        tokenRepository,
        kafkaService,
        configService,
      );

      await expect(service.adminLogin(loginDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('parentLogin', () => {
    it('should successfully login parent user', async () => {
      const { authRepository, tokenRepository, kafkaService, configService } =
        makeMocks();

      const loginDto = {
        email: 'parent@example.com',
        password: 'ParentPassword123!',
      };

      const mockUser = {
        id: 'parent-1',
        email: 'parent@example.com',
        passwordHash: await bcrypt.hash('ParentPassword123!', 10),
        role: UserRole.parent,
      };

      const mockToken = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      authRepository.findUserForLogin.mockResolvedValue(mockUser);
      tokenRepository.generateToken.mockResolvedValue(mockToken);

      const service = new AuthService(
        authRepository,
        tokenRepository,
        kafkaService,
        configService,
      );

      const result = await service.parentLogin(loginDto);

      expect(result).toEqual({ ...mockToken, user: mockUser });
      expect(tokenRepository.generateToken).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: UserRole.parent,
      });
    });
  });

  describe('adminRegister', () => {
    it('should successfully register admin user', async () => {
      const { authRepository, tokenRepository, kafkaService, configService } =
        makeMocks();

      const registerDto = {
        email: 'admin@example.com',
        password: 'AdminPassword123!',
        firstName: 'Admin',
        lastName: 'User',
      };

      const mockUser = {
        id: 'admin-1',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
      };

      const mockToken = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      authRepository.register.mockResolvedValue(mockUser);
      tokenRepository.generateToken.mockResolvedValue(mockToken);

      const service = new AuthService(
        authRepository,
        tokenRepository,
        kafkaService,
        configService,
      );

      const result = await service.adminRegister(registerDto);

      expect(result).toEqual({ ...mockToken, user: mockUser });
      expect(tokenRepository.generateToken).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: UserRole.admin,
      });
    });

    it('should throw BadRequestException if registration fails', async () => {
      const { authRepository, tokenRepository, kafkaService, configService } =
        makeMocks();

      const registerDto = {
        email: 'admin@example.com',
        password: 'AdminPassword123!',
        firstName: 'Admin',
        lastName: 'User',
      };

      authRepository.register.mockResolvedValue(null);

      const service = new AuthService(
        authRepository,
        tokenRepository,
        kafkaService,
        configService,
      );

      await expect(service.adminRegister(registerDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.adminRegister(registerDto)).rejects.toThrow(
        'Failed to register admin user',
      );
    });
  });
});
