import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  MfaVerifyDto,
  MfaEnableDto,
  MfaDisableDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ResendVerificationDto,
  MfaBackupCodeVerifyDto,
  VerifyEmailDto,
  StepUpVerifyDto,
} from './dto';
import { CurrentUser, Public } from '../../common/decorators';
import { AppConfigService } from '../../config/app-config.service';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/auth',
};

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: AppConfigService,
  ) {}

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth flow' })
  googleAuth() {}

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Handle Google OAuth callback' })
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const result = await this.authService.googleOAuthLogin(
      req.user as any,
      req,
    );
    const frontendUrl = this.configService.url.match(/:\d+/)
      ? this.configService.url.replace(/:\d+/, ':5173')
      : this.configService.url;

    if ('mfaRequired' in result && result.mfaRequired) {
      res.cookie('mfa_temp_token', result.tempToken!, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/api/auth',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 5 * 60 * 1000,
      });
      return res.redirect(
        `${frontendUrl}/auth/google/callback?mfaRequired=true`,
      );
    }

    if ('stepUpRequired' in result && result.stepUpRequired) {
      res.cookie('step_up_token', result.stepUpToken!, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/api/auth',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 10 * 60 * 1000,
      });
      return res.redirect(
        `${frontendUrl}/auth/google/callback?stepUpRequired=true`,
      );
    }

    const tokenResult = result as {
      accessToken: string;
      refreshToken: string;
      user: any;
    };
    res.cookie(
      'refresh_token',
      tokenResult.refreshToken,
      REFRESH_COOKIE_OPTIONS,
    );
    const params = new URLSearchParams({
      accessToken: tokenResult.accessToken,
      user: JSON.stringify(tokenResult.user),
    });
    return res.redirect(
      `${frontendUrl}/auth/google/callback?${params.toString()}`,
    );
  }

  @Public()
  @Post('register')
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Email already registered' })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, req);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Verify email address with code' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired code' })
  async verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: Request) {
    return this.authService.verifyEmail(dto, req);
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 3 } })
  @ApiOperation({ summary: 'Resend email verification' })
  @ApiResponse({ status: 200, description: 'Verification email resent' })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Login step 1 - email & password' })
  @ApiResponse({
    status: 200,
    description: 'Returns tokens or MFA challenge',
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Email not verified' })
  @ApiResponse({ status: 423, description: 'Account locked' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, req);
    if ('refreshToken' in result) {
      res.cookie('refresh_token', result.refreshToken, REFRESH_COOKIE_OPTIONS);
      const { refreshToken: _, ...body } = result;
      return body;
    }
    return result;
  }

  @Public()
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Login step 2 - verify MFA TOTP code' })
  @ApiResponse({
    status: 200,
    description: 'Returns access and refresh tokens',
  })
  @ApiResponse({ status: 401, description: 'Invalid TOTP code or temp token' })
  async verifyMfa(
    @Body() dto: MfaVerifyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tempToken = dto.tempToken || req.cookies?.['mfa_temp_token'];
    if (!tempToken) {
      throw new HttpException(
        'Missing temporary token',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const result = await this.authService.verifyMfa({ ...dto, tempToken }, req);
    res.cookie('refresh_token', result.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.clearCookie('mfa_temp_token', { path: '/api/auth' });
    const { refreshToken: _, ...body } = result;
    return body;
  }

  @Public()
  @Post('mfa/verify-backup')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Login step 2 - verify MFA with backup code' })
  @ApiResponse({
    status: 200,
    description: 'Returns access and refresh tokens',
  })
  async verifyMfaBackupCode(
    @Body() dto: MfaBackupCodeVerifyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tempToken = dto.tempToken || req.cookies?.['mfa_temp_token'];
    if (!tempToken) {
      throw new HttpException(
        'Missing temporary token',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const result = await this.authService.verifyMfaBackupCode(
      { ...dto, tempToken },
      req,
    );
    res.cookie('refresh_token', result.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.clearCookie('mfa_temp_token', { path: '/api/auth' });
    const { refreshToken: _, ...body } = result;
    return body;
  }

  @Public()
  @Post('step-up/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Verify step-up challenge code' })
  @ApiResponse({
    status: 200,
    description: 'Returns access and refresh tokens',
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired step-up code' })
  async verifyStepUp(
    @Body() dto: StepUpVerifyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const stepUpToken = dto.stepUpToken || req.cookies?.['step_up_token'];
    if (!stepUpToken) {
      throw new HttpException('Missing step-up token', HttpStatus.UNAUTHORIZED);
    }
    const result = await this.authService.verifyStepUp(
      { ...dto, stepUpToken },
      req,
    );
    res.cookie('refresh_token', result.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.clearCookie('step_up_token', { path: '/api/auth' });
    const { refreshToken: _, ...body } = result;
    return body;
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('mfa/setup')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set up MFA - generate secret and QR code' })
  @ApiResponse({ status: 200, description: 'Returns QR code and secret' })
  async setupMfa(@CurrentUser('id') userId: string) {
    return this.authService.setupMfa(userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('mfa/enable')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable MFA after verifying TOTP code' })
  @ApiResponse({
    status: 200,
    description: 'MFA enabled, returns backup codes',
  })
  async enableMfa(
    @CurrentUser('id') userId: string,
    @Body() dto: MfaEnableDto,
    @Req() req: Request,
  ) {
    return this.authService.enableMfa(userId, dto, req);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('mfa/disable')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable MFA' })
  @ApiResponse({ status: 200, description: 'MFA disabled' })
  async disableMfa(
    @CurrentUser('id') userId: string,
    @Body() dto: MfaDisableDto,
    @Req() req: Request,
  ) {
    return this.authService.disableMfa(userId, dto, req);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('mfa/backup-codes')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Regenerate MFA backup codes' })
  @ApiResponse({ status: 200, description: 'Returns new backup codes' })
  async regenerateBackupCodes(@CurrentUser('id') userId: string) {
    return this.authService.regenerateBackupCodes(userId);
  }

  @ApiCookieAuth()
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Returns new access token' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshTokens(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.['refresh_token'];
    if (!token) {
      throw new HttpException('Missing refresh token', HttpStatus.UNAUTHORIZED);
    }
    const result = await this.authService.refreshTokens(token, req);
    res.cookie('refresh_token', result.refreshToken, REFRESH_COOKIE_OPTIONS);
    const { refreshToken: _, ...resp } = result;
    return resp;
  }

  @ApiCookieAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(
    @Req() req: Request,
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.['refresh_token'];
    if (token) {
      await this.authService.logout(token, userId, req);
    }
    res.clearCookie('refresh_token', { path: '/api/auth' });
    return { message: 'Logged out successfully' };
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('sessions')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'List all active sessions' })
  @ApiResponse({ status: 200, description: 'Returns active sessions' })
  async listSessions(@CurrentUser('id') userId: string, @Req() req: Request) {
    const currentRefreshToken = req.cookies?.['refresh_token'];
    return this.authService.listSessions(userId, currentRefreshToken);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('sessions/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a specific session' })
  @ApiResponse({ status: 200, description: 'Session revoked' })
  async revokeSession(
    @Param('id') sessionId: string,
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ) {
    return this.authService.revokeSession(sessionId, userId, req);
  }

  @ApiCookieAuth()
  @UseGuards(AuthGuard('jwt'))
  @Delete('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke all sessions except current' })
  @ApiResponse({ status: 200, description: 'All other sessions revoked' })
  async revokeAllSessions(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ) {
    const currentRefreshToken = req.cookies?.['refresh_token'];
    return this.authService.revokeAllSessions(userId, currentRefreshToken, req);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 3 } })
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiResponse({
    status: 200,
    description: 'Reset email sent if account exists',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.authService.forgotPassword(dto, req);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Reset password with code' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    return this.authService.resetPassword(dto, req);
  }
}
