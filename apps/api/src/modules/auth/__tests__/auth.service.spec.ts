import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../../config/prisma.service';
import * as bcrypt from 'bcryptjs';

// ── Mock Prisma ───────────────────────────────────────────────────────────
const mockPrisma = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  tenant: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

const mockJwt = {
  signAsync: jest.fn().mockResolvedValue('mock-token'),
};

const mockConfig = {
  get: jest.fn((key: string, def?: any) => def ?? 'mock-value'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  // ── Login tests ──────────────────────────────────────────────────────────

  describe('login', () => {
    it('should throw UnauthorizedException for unknown email', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      await expect(service.login({ email: 'nobody@test.com', password: 'pass' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const hash = await bcrypt.hash('correct-password', 12);
      mockPrisma.user.findFirst.mockResolvedValue({
        id: '1', email: 'user@test.com', passwordHash: hash,
        status: 'ACTIVE', mfaEnabled: false, role: 'VIEWER', tenantId: 't1',
        tenant: { id: 't1', name: 'Test', slug: 'test', plan: 'starter' },
      });
      await expect(service.login({ email: 'user@test.com', password: 'wrong-password' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should return tokens and user on valid credentials', async () => {
      const password = 'Admin@123';
      const hash = await bcrypt.hash(password, 12);
      const mockUser = {
        id: 'user-1', email: 'admin@test.com', passwordHash: hash,
        status: 'ACTIVE', mfaEnabled: false, role: 'SUPER_ADMIN',
        tenantId: 'tenant-1', firstName: 'Admin', lastName: 'User',
        tenant: { id: 'tenant-1', name: 'Test Co', slug: 'test', plan: 'enterprise' },
      };
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);
      mockJwt.signAsync.mockResolvedValue('access-token');

      const result = await service.login({ email: 'admin@test.com', password });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('admin@test.com');
      expect(result.user.role).toBe('SUPER_ADMIN');
    });

    it('should throw UnauthorizedException for suspended account', async () => {
      const hash = await bcrypt.hash('pass123', 12);
      mockPrisma.user.findFirst.mockResolvedValue({
        id: '1', email: 'user@test.com', passwordHash: hash,
        status: 'SUSPENDED', mfaEnabled: false,
      });
      await expect(service.login({ email: 'user@test.com', password: 'pass123' }))
        .rejects.toThrow('Account suspended');
    });
  });

  // ── Register tests ───────────────────────────────────────────────────────

  describe('register', () => {
    it('should throw ConflictException if email already exists', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 't1', slug: 'test' });
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(service.register({
        email: 'existing@test.com', password: 'pass123',
        firstName: 'Test', lastName: 'User',
      })).rejects.toThrow(ConflictException);
    });

    it('should create user and return tokens on successful registration', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.create.mockResolvedValue({ id: 't2', slug: 'new-tenant' });
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-user', email: 'new@test.com',
        firstName: 'New', lastName: 'User', role: 'VIEWER', tenantId: 't2',
      });
      mockJwt.signAsync.mockResolvedValue('token');

      const result = await service.register({
        email: 'new@test.com', password: 'SecurePass@123',
        firstName: 'New', lastName: 'User',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result.user.email).toBe('new@test.com');
    });
  });

  // ── validateUser tests ───────────────────────────────────────────────────

  describe('validateUser', () => {
    it('should return null for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const result = await service.validateUser('non-existent-id');
      expect(result).toBeNull();
    });

    it('should return user data for valid user', async () => {
      const mockUser = { id: 'u1', email: 'test@test.com', role: 'VIEWER', tenantId: 't1', status: 'ACTIVE' };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      const result = await service.validateUser('u1');
      expect(result?.email).toBe('test@test.com');
    });
  });
});
