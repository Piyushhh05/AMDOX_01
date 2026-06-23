import { Injectable, UnauthorizedException, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { LoginDto, RegisterDto, ChangePasswordDto } from './auth.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
      include: { tenant: { select: { id: true, name: true, slug: true, plan: true } } },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === 'SUSPENDED') throw new UnauthorizedException('Account suspended');
    if (user.status === 'INACTIVE') throw new UnauthorizedException('Account inactive');

    // MFA check — if enabled, require mfaCode
    if (user.mfaEnabled && user.mfaSecret) {
      if (!dto.mfaCode) {
        throw new UnauthorizedException('MFA code required. Please provide your 6-digit authenticator code.');
      }
      const speakeasy = require('speakeasy');
      const valid = speakeasy.totp.verify({ secret: user.mfaSecret, encoding: 'base32', token: dto.mfaCode, window: 1 });
      if (!valid) throw new UnauthorizedException('Invalid MFA code.');
    }

    const tokens = await this.generateTokens(user);

    // Update last login & store refresh token hash
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        refreshToken: await bcrypt.hash(tokens.refreshToken, 10),
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        tenant: user.tenant,
      },
      ...tokens,
    };
  }

  async register(dto: RegisterDto) {
    // Find or create tenant
    let tenant = await this.prisma.tenant.findUnique({ where: { slug: dto.tenantSlug || 'default' } });

    if (!tenant) {
      tenant = await this.prisma.tenant.create({
        data: {
          name: `${dto.firstName}'s Company`,
          slug: dto.tenantSlug || `tenant-${Date.now()}`,
        },
      });
    }

    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email, tenantId: tenant.id },
    });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: 'VIEWER',
      },
    });

    const tokens = await this.generateTokens(user);
    return {
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
      ...tokens,
    };
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.refreshToken) throw new UnauthorizedException('Access denied');

    const matches = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!matches) throw new UnauthorizedException('Invalid refresh token');

    const tokens = await this.generateTokens(user);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: await bcrypt.hash(tokens.refreshToken, 10) },
    });
    return tokens;
  }

  async logout(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { refreshToken: null } });
    return { message: 'Logged out successfully' };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, status: true, avatar: true, phone: true,
        lastLoginAt: true, mfaEnabled: true, createdAt: true,
        tenant: { select: { id: true, name: true, slug: true, plan: true, settings: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    return { message: 'Password changed successfully' };
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId, status: 'ACTIVE', deletedAt: null },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, tenantId: true, status: true },
    });
  }

  private async generateTokens(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role, tenantId: user.tenantId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: this.config.get('JWT_EXPIRES_IN', '7d'),
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '30d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
