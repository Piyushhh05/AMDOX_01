import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import * as speakeasy from 'speakeasy';

@Injectable()
export class MfaService {
  constructor(private prisma: PrismaService) {}

  async setupMfa(userId: string) {
    const secret = speakeasy.generateSecret({
      name: 'Amdox ERP',
      length: 20,
    });

    // Store secret (not yet enabled — user must verify first)
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret.base32 },
    });

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
      message: 'Scan this QR code with your authenticator app, then call /auth/mfa/verify to enable',
    };
  }

  async verifyAndEnableMfa(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret) throw new BadRequestException('MFA setup not initiated. Call /auth/mfa/setup first.');

    const valid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!valid) throw new BadRequestException('Invalid MFA code. Please try again.');

    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
    return { message: 'MFA enabled successfully', mfaEnabled: true };
  }

  async disableMfa(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaEnabled) throw new BadRequestException('MFA is not enabled.');

    const valid = speakeasy.totp.verify({ secret: user.mfaSecret!, encoding: 'base32', token, window: 1 });
    if (!valid) throw new UnauthorizedException('Invalid MFA code.');

    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: false, mfaSecret: null } });
    return { message: 'MFA disabled', mfaEnabled: false };
  }

  validateToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({ secret, encoding: 'base32', token, window: 1 });
  }
}
