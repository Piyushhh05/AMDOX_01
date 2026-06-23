import { Controller, Post, Get, Body, UseGuards, Patch, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { LoginDto, RegisterDto, RefreshTokenDto, ChangePasswordDto } from './auth.dto';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser, Public } from '../../common/decorators';

@ApiTags('Auth')
@UseGuards(JwtAuthGuard)
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private mfaService: MfaService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register new user' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body() dto: RefreshTokenDto, @CurrentUser('sub') userId: string) {
    return this.authService.refreshTokens(userId, dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Logout current user' })
  logout(@CurrentUser('id') userId: string) {
    return this.authService.logout(userId);
  }

  @Get('me')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@CurrentUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }

  @Patch('change-password')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Change password' })
  changePassword(@CurrentUser('id') userId: string, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(userId, dto);
  }

  // ── MFA Endpoints ─────────────────────────────────────────────────────

  @Post('mfa/setup')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Setup MFA — returns secret + otpauth URL' })
  setupMfa(@CurrentUser('id') userId: string) {
    return this.mfaService.setupMfa(userId);
  }

  @Post('mfa/verify')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Verify TOTP token and enable MFA' })
  verifyMfa(@CurrentUser('id') userId: string, @Body('token') token: string) {
    return this.mfaService.verifyAndEnableMfa(userId, token);
  }

  @Post('mfa/disable')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Disable MFA (requires valid TOTP token)' })
  disableMfa(@CurrentUser('id') userId: string, @Body('token') token: string) {
    return this.mfaService.disableMfa(userId, token);
  }
}
