import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CookieOptions, Request, Response } from 'express';
import {
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
} from './constants/auth.constants';
import { AUTH_RESPONSE_MESSAGE } from './constants/auth-response.constants';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAccessAuthGuard } from './guards/jwt-access-auth.guard';
import { JwtRefreshAuthGuard } from './guards/jwt-refresh-auth.guard';
import { AuthService } from './auth.service';
import { AuthUserResponseDto } from './dto/auth-user-response.dto';
import { AuthMessageResponseDto } from './dto/auth-message-response.dto';
import { LoginDto } from './dto/login.dto';
import { MeResponseDto } from './dto/me-response.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './types/jwt-payload.type';
import { AuthTokensResponseDto } from './dto/auth-tokens-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @ApiOperation({
    summary: 'Register',
    description:
      'Registers user, sets access/refresh tokens in HttpOnly cookies, and returns a success message.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiOkResponse({ type: AuthMessageResponseDto })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthMessageResponseDto> {
    const result = await this.authService.register(dto);
    this.setAuthCookies(response, result.tokens);

    return {
      message: AUTH_RESPONSE_MESSAGE.REGISTER_SUCCESS,
    };
  }

  @Post('login')
  @ApiOperation({
    summary: 'Login',
    description:
      'Logs user in, sets access/refresh tokens in HttpOnly cookies, and returns a success message.',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: AuthMessageResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthMessageResponseDto> {
    const result = await this.authService.login(dto);
    this.setAuthCookies(response, result.tokens);

    return {
      message: AUTH_RESPONSE_MESSAGE.LOGIN_SUCCESS,
    };
  }

  @Get('me')
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiBearerAuth()
  @UseGuards(JwtAccessAuthGuard)
  @ApiOperation({
    summary: 'Get current user',
    description: 'Returns current authenticated user from JWT access token.',
  })
  @ApiOkResponse({ type: MeResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async me(@CurrentUser() currentUser: JwtPayload): Promise<MeResponseDto> {
    const user = await this.authService.me(currentUser);

    return {
      user: AuthUserResponseDto.fromEntity(user),
    };
  }

  @Post('refresh')
  @ApiCookieAuth(REFRESH_TOKEN_COOKIE_NAME)
  @UseGuards(JwtRefreshAuthGuard)
  @ApiOperation({
    summary: 'Refresh tokens',
    description:
      'Issues new access/refresh tokens by valid refresh token from HttpOnly cookie.',
  })
  @ApiOkResponse({ type: AuthMessageResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid refresh token' })
  async refresh(
    @CurrentUser() currentUser: JwtPayload,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthMessageResponseDto> {
    const refreshToken = request.cookies?.[REFRESH_TOKEN_COOKIE_NAME] as
      | string
      | undefined;
    const result = await this.authService.refresh(refreshToken, currentUser);
    this.setAuthCookies(response, result.tokens);

    return {
      message: AUTH_RESPONSE_MESSAGE.REFRESH_SUCCESS,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiBearerAuth()
  @UseGuards(JwtAccessAuthGuard)
  @ApiOperation({
    summary: 'Logout',
    description: 'Clears auth cookies and removes stored refresh token.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async logout(
    @CurrentUser() currentUser: JwtPayload,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(currentUser);
    this.clearAuthCookies(response);
  }

  private setAuthCookies(
    response: Response,
    tokens: AuthTokensResponseDto,
  ): void {
    response.cookie(
      ACCESS_TOKEN_COOKIE_NAME,
      tokens.accessToken,
      this.buildCookieOptions(
        Number(
          this.configService.get<string>(
            'JWT_ACCESS_COOKIE_MAX_AGE_MS',
            '900000',
          ),
        ),
      ),
    );

    response.cookie(
      REFRESH_TOKEN_COOKIE_NAME,
      tokens.refreshToken,
      this.buildCookieOptions(
        Number(
          this.configService.get<string>(
            'JWT_REFRESH_COOKIE_MAX_AGE_MS',
            '604800000',
          ),
        ),
      ),
    );
  }

  private clearAuthCookies(response: Response): void {
    const accessCookieOptions = this.buildCookieOptions(0);
    const refreshCookieOptions = this.buildCookieOptions(0);

    response.clearCookie(ACCESS_TOKEN_COOKIE_NAME, accessCookieOptions);
    response.clearCookie(REFRESH_TOKEN_COOKIE_NAME, refreshCookieOptions);
  }

  private buildCookieOptions(maxAge: number): CookieOptions {
    const sameSite = this.getCookieSameSite();
    const secure =
      this.configService.get<string>('JWT_COOKIE_SECURE', 'false') === 'true';
    const domain = this.configService.get<string>('JWT_COOKIE_DOMAIN');

    return {
      httpOnly: true,
      sameSite,
      secure,
      path: '/',
      maxAge: Number.isFinite(maxAge) ? maxAge : 0,
      ...(domain ? { domain } : {}),
    };
  }

  private getCookieSameSite(): CookieOptions['sameSite'] {
    const value = this.configService
      .get<string>('JWT_COOKIE_SAME_SITE', 'lax')
      .toLowerCase();

    if (value === 'strict' || value === 'none' || value === 'lax') {
      return value;
    }

    return 'lax';
  }
}
