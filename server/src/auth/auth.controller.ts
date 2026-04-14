import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
  ApiTags,
} from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { AuthTokensResponseDto } from './dto/auth-tokens-response.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { MeResponseDto } from './dto/me-response.dto';
import { RegisterDto } from './dto/register.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  @Post('register')
  @ApiOperation({
    summary: 'Register',
    description: 'Registers user and returns mock access/refresh tokens.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiOkResponse({ type: RegisterResponseDto })
  register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): RegisterResponseDto {
    const userId = randomUUID();
    const tokens = this.buildMockTokens(userId);
    this.setAuthCookies(response, tokens);

    return {
      user: {
        id: userId,
        email: dto.email,
        role: UserRole.CLIENT,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      tokens,
    };
  }

  @Post('login')
  @ApiOperation({
    summary: 'Login',
    description: 'Logs user in and returns mock access/refresh tokens.',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: LoginResponseDto })
  login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): LoginResponseDto {
    const userId = randomUUID();
    const tokens = this.buildMockTokens(userId);
    this.setAuthCookies(response, tokens);

    return {
      user: {
        id: userId,
        email: dto.email,
        role: UserRole.CLIENT,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      tokens,
    };
  }

  @Get('me')
  @ApiCookieAuth('accessToken')
  @ApiOperation({
    summary: 'Me',
    description: 'Returns current user from mock access token cookie.',
  })
  @ApiOkResponse({ type: MeResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  me(@Req() request: Request): MeResponseDto {
    const accessToken = request.cookies?.accessToken as string | undefined;
    if (!accessToken) {
      throw new UnauthorizedException('Access token is missing');
    }

    const userId = this.extractUserIdFromAccessToken(accessToken);
    if (!userId) {
      throw new UnauthorizedException('Invalid access token');
    }

    return {
      user: {
        id: userId,
        email: 'mock-user@example.com',
        role: UserRole.CLIENT,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  }

  private setAuthCookies(
    response: Response,
    tokens: AuthTokensResponseDto,
  ): void {
    response.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: 15 * 60 * 1000,
    });

    response.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private buildMockTokens(userId: string): AuthTokensResponseDto {
    return {
      accessToken: `mock-access-token-${userId}`,
      refreshToken: `mock-refresh-token-${userId}`,
    };
  }

  private extractUserIdFromAccessToken(token: string): string | null {
    const prefix = 'mock-access-token-';
    if (!token.startsWith(prefix)) {
      return null;
    }

    return token.slice(prefix.length) || null;
  }
}
