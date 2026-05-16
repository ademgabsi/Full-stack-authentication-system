import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { WebAuthnService } from './webauthn.service';
import { AuthService } from './auth.service';
import {
  WebAuthnRegistrationVerifyDto,
  WebAuthnAuthenticationVerifyDto,
  WebAuthnAuthenticationOptionsDto,
  WebAuthnRenameCredentialDto,
} from './dto';
import { CurrentUser, Public } from '../../common/decorators';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/auth',
};

@ApiTags('WebAuthn / Passkeys')
@Controller('auth/webauthn')
export class WebAuthnController {
  constructor(
    private webAuthnService: WebAuthnService,
    private authService: AuthService,
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('register/options')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get passkey registration challenge' })
  async registrationOptions(@CurrentUser('id') userId: string) {
    const user = await this.authService.findUserById(userId);
    return this.webAuthnService.generateRegistrationOptions(user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('register/verify')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify passkey registration' })
  async registrationVerify(
    @CurrentUser('id') userId: string,
    @Body() dto: WebAuthnRegistrationVerifyDto,
    @Req() req: Request,
  ) {
    const user = await this.authService.findUserById(userId);
    let responseJson: RegistrationResponseJSON;
    try {
      responseJson = JSON.parse(dto.response) as RegistrationResponseJSON;
    } catch {
      throw new BadRequestException('Invalid registration response format');
    }
    const credential = await this.webAuthnService.verifyRegistration(
      user,
      responseJson,
      dto.name,
      req,
      dto.challengeKey,
    );

    const credCount = await this.webAuthnService.listCredentials(userId);
    if (credCount.length === 1) {
      await this.authService.setPasskeysEnabled(userId, true);
    }

    return {
      message: 'Passkey registered successfully',
      credential: {
        id: credential.id,
        name: credential.name,
        createdAt: credential.createdAt,
      },
    };
  }

  @Public()
  @Post('login/options')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Get passkey authentication challenge' })
  async authenticationOptions(@Body() dto: WebAuthnAuthenticationOptionsDto) {
    return this.webAuthnService.generateAuthenticationOptions(dto.email);
  }

  @Public()
  @Post('login/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Verify passkey authentication' })
  async authenticationVerify(
    @Body() dto: WebAuthnAuthenticationVerifyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    let responseJson: AuthenticationResponseJSON;
    try {
      responseJson = JSON.parse(dto.response) as AuthenticationResponseJSON;
    } catch {
      throw new BadRequestException('Invalid authentication response format');
    }
    const user = await this.webAuthnService.verifyAuthentication(
      responseJson,
      req,
      dto.challengeKey,
    );

    const result = await this.authService.generateTokensForUser(user, req);
    res.cookie('refresh_token', result.refreshToken, REFRESH_COOKIE_OPTIONS);
    const { refreshToken: _, ...body } = result;
    return body;
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('credentials')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List registered passkeys' })
  async listCredentials(@CurrentUser('id') userId: string) {
    return this.webAuthnService.listCredentials(userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('credentials/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rename a passkey' })
  async renameCredential(
    @CurrentUser('id') userId: string,
    @Param('id') credentialId: string,
    @Body() dto: WebAuthnRenameCredentialDto,
  ) {
    await this.webAuthnService.renameCredential(userId, credentialId, dto.name);
    return { message: 'Passkey renamed successfully' };
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('credentials/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a passkey' })
  async deleteCredential(
    @CurrentUser('id') userId: string,
    @Param('id') credentialId: string,
    @Req() req: Request,
  ) {
    const result = await this.webAuthnService.deleteCredential(
      userId,
      credentialId,
      req,
    );

    if (result.remaining === 0) {
      await this.authService.setPasskeysEnabled(userId, false);
    }

    return { message: 'Passkey deleted successfully' };
  }
}
