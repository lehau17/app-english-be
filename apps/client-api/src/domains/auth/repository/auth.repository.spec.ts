import { PrismaRepository } from '@app/database';
import { TokenRepository } from '@app/shared';
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

import { AuthRepository } from './auth.repository';

// Mock implementations for dependencies
const makeMocks = () => {
  const prisma: any = {
    user: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    parentChild: {
      findFirst: jest.fn(),
    },
    passwordResetToken: {
      create: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const tokenRepository: any = {
    generateToken: jest.fn(),
  };

  return { prisma, tokenRepository };
};

describe('AuthRepository', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('register', () => {
    it('should create a new user with hashed password', async () => {
      const { prisma, tokenRepository } = makeMocks();

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

      prisma.user.create.mockResolvedValue(mockUser);

      const repository = new AuthRepository(prisma, tokenRepository);

      const result = await repository.register(registerDto);

      expect(result).toEqual(mockUser);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: registerDto.email,
          phone: registerDto.phone,
          passwordHash: expect.any(String),
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
        },
      });

      // Verify password was hashed
      const createCall = prisma.user.create.mock.calls[0][0];
      const passwordHash = createCall.data.passwordHash;
      const isPasswordHashed = await bcrypt.compare(registerDto.password, passwordHash);
      expect(isPasswordHashed).toBe(true);
    });
  });

  describe('changePassword', () => {
    it('should update user password with hashed new password', async () => {
      const { prisma, tokenRepository } = makeMocks();

      const userId = 'user-1';
      const changePasswordDto = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
      };

      const updatedUser = {
        id: userId,
        passwordHash: 'new-hashed-password',
      };

      prisma.user.update.mockResolvedValue(updatedUser);

      const repository = new AuthRepository(prisma, tokenRepository);

      const result = await repository.changePassword(userId, changePasswordDto);

      expect(result).toEqual(updatedUser);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          passwordHash: expect.any(String),
        },
      });

      // Verify password was hashed
      const updateCall = prisma.user.update.mock.calls[0][0];
      const passwordHash = updateCall.data.passwordHash;
      const isPasswordHashed = await bcrypt.compare(changePasswordDto.newPassword, passwordHash);
      expect(isPasswordHashed).toBe(true);
    });
  });

  describe('findUserForLogin', () => {
    it('should find user by email', async () => {
      const { prisma, tokenRepository } = makeMocks();

      const email = 'test@example.com';
      const mockUser = {
        id: 'user-1',
        email: email,
      };

      prisma.user.findFirst.mockResolvedValue(mockUser);

      const repository = new AuthRepository(prisma, tokenRepository);

      const result = await repository.findUserForLogin(email);

      expect(result).toEqual(mockUser);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ email: email }, { phone: email }],
        },
      });
    });

    it('should find user by phone', async () => {
      const { prisma, tokenRepository } = makeMocks();

      const phone = '+84901234567';
      const mockUser = {
        id: 'user-1',
        phone: phone,
      };

      prisma.user.findFirst.mockResolvedValue(mockUser);

      const repository = new AuthRepository(prisma, tokenRepository);

      const result = await repository.findUserForLogin(phone);

      expect(result).toEqual(mockUser);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ email: phone }, { phone: phone }],
        },
      });
    });

    it('should return null if user not found', async () => {
      const { prisma, tokenRepository } = makeMocks();

      prisma.user.findFirst.mockResolvedValue(null);

      const repository = new AuthRepository(prisma, tokenRepository);

      const result = await repository.findUserForLogin('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('storeRefreshToken', () => {
    it('should create a new refresh token record', async () => {
      const { prisma, tokenRepository } = makeMocks();

      const userId = 'user-1';
      const jti = 'jwt-id-123';
      const expiresAt = new Date(Date.now() + 3600000);

      const mockToken = {
        id: jti,
        userId: userId,
        expiresAt: expiresAt,
      };

      prisma.refreshToken.create.mockResolvedValue(mockToken);

      const repository = new AuthRepository(prisma, tokenRepository);

      const result = await repository.storeRefreshToken(userId, jti, expiresAt);

      expect(result).toEqual(mockToken);
      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: {
          id: jti,
          userId: userId,
          expiresAt: expiresAt,
        },
      });
    });
  });

  describe('revokeRefreshToken', () => {
    it('should revoke refresh token by setting revokedAt', async () => {
      const { prisma, tokenRepository } = makeMocks();

      const jti = 'jwt-id-123';

      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      const repository = new AuthRepository(prisma, tokenRepository);

      const result = await repository.revokeRefreshToken(jti);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: jti, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('refreshToken', () => {
    it('should generate new tokens for valid refresh token', async () => {
      const { prisma, tokenRepository } = makeMocks();

      const jti = 'jwt-id-123';
      const mockToken = {
        id: jti,
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 3600000),
        revokedAt: null,
      };

      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
      };

      const newTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      prisma.refreshToken.findUnique.mockResolvedValue(mockToken);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      tokenRepository.generateToken.mockResolvedValue(newTokens);

      const repository = new AuthRepository(prisma, tokenRepository);

      const result = await repository.refreshToken(jti);

      expect(result).toEqual(newTokens);
      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { id: jti },
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockToken.userId },
      });
      expect(tokenRepository.generateToken).toHaveBeenCalledWith({
        role: 'student',
        jti: jti,
        sub: mockUser.id,
        email: mockUser.email,
      });
    });

    it('should return null if refresh token not found', async () => {
      const { prisma, tokenRepository } = makeMocks();

      const jti = 'invalid-jwt-id';

      prisma.refreshToken.findUnique.mockResolvedValue(null);

      const repository = new AuthRepository(prisma, tokenRepository);

      const result = await repository.refreshToken(jti);

      expect(result).toBeNull();
    });

    it('should return null if refresh token is revoked', async () => {
      const { prisma, tokenRepository } = makeMocks();

      const jti = 'jwt-id-123';
      const mockToken = {
        id: jti,
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 3600000),
        revokedAt: new Date(),
      };

      prisma.refreshToken.findUnique.mockResolvedValue(mockToken);

      const repository = new AuthRepository(prisma, tokenRepository);

      const result = await repository.refreshToken(jti);

      expect(result).toBeNull();
    });

    it('should return null if refresh token is expired', async () => {
      const { prisma, tokenRepository } = makeMocks();

      const jti = 'jwt-id-123';
      const mockToken = {
        id: jti,
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 3600000),
        revokedAt: null,
      };

      prisma.refreshToken.findUnique.mockResolvedValue(mockToken);

      const repository = new AuthRepository(prisma, tokenRepository);

      const result = await repository.refreshToken(jti);

      expect(result).toBeNull();
    });

    it('should return null if user not found', async () => {
      const { prisma, tokenRepository } = makeMocks();

      const jti = 'jwt-id-123';
      const mockToken = {
        id: jti,
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 3600000),
        revokedAt: null,
      };

      prisma.refreshToken.findUnique.mockResolvedValue(mockToken);
      prisma.user.findUnique.mockResolvedValue(null);

      const repository = new AuthRepository(prisma, tokenRepository);

      const result = await repository.refreshToken(jti);

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      const { prisma, tokenRepository } = makeMocks();

      const userId = 'user-1';
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const repository = new AuthRepository(prisma, tokenRepository);

      const result = await repository.findById(userId);

      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
    });

    it('should return null if user not found', async () => {
      const { prisma, tokenRepository } = makeMocks();

      prisma.user.findUnique.mockResolvedValue(null);

      const repository = new AuthRepository(prisma, tokenRepository);

      const result = await repository.findById('nonexistent-user');

      expect(result).toBeNull();
    });
  });

  describe('findParentRelation', () => {
    it('should find parent relation for a child', async () => {
      const { prisma, tokenRepository } = makeMocks();

      const childId = 'child-1';
      const mockRelation = {
        parent: {
          id: 'parent-1',
          displayName: 'Parent Name',
          email: 'parent@example.com',
          firstName: 'Parent',
          lastName: 'Name',
        },
      };

      prisma.parentChild.findFirst.mockResolvedValue(mockRelation);

      const repository = new AuthRepository(prisma, tokenRepository);

      const result = await repository.findParentRelation(childId);

      expect(result).toEqual(mockRelation);
      expect(prisma.parentChild.findFirst).toHaveBeenCalledWith({
        where: {
          childId: childId,
        },
        include: {
          parent: {
            select: {
              id: true,
              displayName: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    });

    it('should return null if no parent relation exists', async () => {
      const { prisma, tokenRepository } = makeMocks();

      prisma.parentChild.findFirst.mockResolvedValue(null);

      const repository = new AuthRepository(prisma, tokenRepository);

      const result = await repository.findParentRelation('child-without-parent');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const { prisma, tokenRepository } = makeMocks();

      const email = 'test@example.com';
      const mockUser = {
        id: 'user-1',
        email: email,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const repository = new AuthRepository(prisma, tokenRepository);

      const result = await repository.findByEmail(email);

      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: email },
      });
    });

    it('should return null if email is not provided', async () => {
      const { prisma, tokenRepository } = makeMocks();

      const repository = new AuthRepository(prisma, tokenRepository);

      const result = await repository.findByEmail('');

      expect(result).toBeNull();
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should return null if user not found', async () => {
      const { prisma, tokenRepository } = makeMocks();

      prisma.user.findUnique.mockResolvedValue(null);

      const repository = new AuthRepository(prisma, tokenRepository);

      const result = await repository.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const { prisma, tokenRepository } = makeMocks();

      const userId = 'user-1';
      const updateDto = {
        displayName: 'New Display Name',
        email: 'new@example.com',
        firstName: 'John',
        lastName: 'Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
      };

      const updatedUser = {
        id: userId,
        ...updateDto,
        role: 'student',
        status: 'active',
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.user.update.mockResolvedValue(updatedUser);

      const repository = new AuthRepository(prisma, tokenRepository);

      const result = await repository.updateProfile(userId, updateDto);

      expect(result).toEqual(updatedUser);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          displayName: updateDto.displayName,
          email: updateDto.email,
          firstName: updateDto.firstName,
          lastName: updateDto.lastName,
          avatarUrl: updateDto.avatarUrl,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          displayName: true,
          avatarUrl: true,
          role: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });
  });

  describe('invalidateUserResetTokens', () => {
    it('should invalidate all unused reset tokens for a user', async () => {
      const { prisma, tokenRepository } = makeMocks();

      const userId = 'user-1';

      prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 2 });

      const repository = new AuthRepository(prisma, tokenRepository);

      await repository.invalidateUserResetTokens(userId);

      expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: { userId: userId, usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
    });
  });

  describe('createPasswordResetToken', () => {
    it('should create a password reset token', async () => {
      const { prisma, tokenRepository } = makeMocks();

      const userId = 'user-1';
      const tokenHash = 'hashed-token-123';
      const expiresAt = new Date(Date.now() + 3600000);

      const mockToken = {
        id: 'token-1',
        userId: userId,
      };

      prisma.passwordResetToken.create.mockResolvedValue(mockToken);

      const repository = new AuthRepository(prisma, tokenRepository);

      const result = await repository.createPasswordResetToken(userId, tokenHash, expiresAt);

      expect(result).toEqual(mockToken);
      expect(prisma.passwordResetToken.create).toHaveBeenCalledWith({
        data: {
          userId: userId,
          tokenHash: tokenHash,
          expiresAt: expiresAt,
        },
        select: { id: true, userId: true },
      });
    });
  });

  describe('findValidPasswordResetToken', () => {
    it('should find valid reset token', async () => {
      const { prisma, tokenRepository } = makeMocks();

      const tokenHash = 'valid-token-hash';
      const mockToken = {
        id: 'token-1',
        userId: 'user-1',
        tokenHash: tokenHash,
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
        user: {
          id: 'user-1',
          email: 'test@example.com',
        },
      };

      prisma.passwordResetToken.findFirst.mockResolvedValue(mockToken);

      const repository = new AuthRepository(prisma, tokenRepository);

      const result = await repository.findValidPasswordResetToken(tokenHash);

      expect(result).toEqual(mockToken);
      expect(prisma.passwordResetToken.findFirst).toHaveBeenCalledWith({
        where: {
          tokenHash: tokenHash,
          usedAt: null,
          expiresAt: { gt: expect.any(Date) },
        },
        include: {
          user: true,
        },
      });
    });

    it('should return null if no valid token found', async () => {
      const { prisma, tokenRepository } = makeMocks();

      prisma.passwordResetToken.findFirst.mockResolvedValue(null);

      const repository = new AuthRepository(prisma, tokenRepository);

      const result = await repository.findValidPasswordResetToken('invalid-token-hash');

      expect(result).toBeNull();
    });
  });

  describe('markResetTokenUsed', () => {
    it('should mark reset token as used', async () => {
      const { prisma, tokenRepository } = makeMocks();

      const tokenId = 'token-1';

      prisma.passwordResetToken.update.mockResolvedValue({
        id: tokenId,
        usedAt: new Date(),
      });

      const repository = new AuthRepository(prisma, tokenRepository);

      await repository.markResetTokenUsed(tokenId);

      expect(prisma.passwordResetToken.update).toHaveBeenCalledWith({
        where: { id: tokenId },
        data: { usedAt: expect.any(Date) },
      });
    });
  });

  describe('updatePassword', () => {
    it('should update user password with hashed password', async () => {
      const { prisma, tokenRepository } = makeMocks();

      const userId = 'user-1';
      const newPassword = 'NewPassword123!';

      prisma.user.update.mockResolvedValue({
        id: userId,
        passwordHash: 'new-hashed-password',
      });

      const repository = new AuthRepository(prisma, tokenRepository);

      await repository.updatePassword(userId, newPassword);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          passwordHash: expect.any(String),
        },
      });

      // Verify password was hashed
      const updateCall = prisma.user.update.mock.calls[0][0];
      const passwordHash = updateCall.data.passwordHash;
      const isPasswordHashed = await bcrypt.compare(newPassword, passwordHash);
      expect(isPasswordHashed).toBe(true);
    });
  });
});
