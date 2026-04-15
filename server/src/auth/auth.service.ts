import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UserEntity } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { logAndThrowInternal } from '../shared/error-handling/error-handling.util';
import { AuthJwtService } from './auth-jwt.service';
import { AuthTokensResponseDto } from './dto/auth-tokens-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './types/jwt-payload.type';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly authJwtService: AuthJwtService,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async register(dto: RegisterDto): Promise<{
    tokens: AuthTokensResponseDto;
  }> {
    const passwordHash = await hash(dto.password, 12);

    const createUserDto: CreateUserDto = {
      email: dto.email,
      password: passwordHash,
    };

    const user = await this.usersService.createUser(createUserDto);
    const tokens = await this.issueTokens(user);
    await this.saveRefreshTokenHash(user.id, tokens.refreshToken);

    return { tokens };
  }

  async login(dto: LoginDto): Promise<{
    tokens: AuthTokensResponseDto;
  }> {
    let user: UserEntity;
    try {
      user = await this.usersService.getUserByEmail(dto.email);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw new UnauthorizedException('Invalid credentials');
      }
      throw error;
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    const passwordMatches = await compare(dto.password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokens(user);
    await this.saveRefreshTokenHash(user.id, tokens.refreshToken);
    return { tokens };
  }

  async me(payload: JwtPayload | undefined): Promise<UserEntity> {
    if (!payload) {
      throw new UnauthorizedException('Access token is missing');
    }

    let user: UserEntity;
    try {
      user = await this.usersService.getUserById(payload.sub);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw new UnauthorizedException('Invalid access token');
      }
      throw error;
    }

    return user;
  }

  async refresh(
    refreshToken: string | undefined,
    payload: JwtPayload | undefined,
  ): Promise<{
    tokens: AuthTokensResponseDto;
  }> {
    if (!payload || !refreshToken) {
      throw new UnauthorizedException('Refresh token is missing');
    }

    const user = await this.getUserForAuth(payload.sub);
    const userWithRefreshToken = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.refreshToken')
      .where('user.id = :id', { id: user.id })
      .getOne();

    if (!userWithRefreshToken?.refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const refreshTokenMatches = await compare(
      refreshToken,
      userWithRefreshToken.refreshToken,
    );
    if (!refreshTokenMatches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.issueTokens(user);
    await this.saveRefreshTokenHash(user.id, tokens.refreshToken);

    return { tokens };
  }

  async logout(payload: JwtPayload | undefined): Promise<void> {
    if (!payload) {
      throw new UnauthorizedException('Access token is missing');
    }

    await this.usersRepository.update(
      { id: payload.sub },
      { refreshToken: null },
    );
  }

  private async getUserForAuth(userId: string): Promise<UserEntity> {
    let user: UserEntity;
    try {
      user = await this.usersService.getUserById(userId);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw new UnauthorizedException('Invalid token subject');
      }
      throw error;
    }

    return user;
  }

  private async saveRefreshTokenHash(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    try {
      const refreshTokenHash = await hash(refreshToken, 12);
      await this.usersRepository.update(
        { id: userId },
        { refreshToken: refreshTokenHash },
      );
    } catch (error: unknown) {
      logAndThrowInternal(
        this.logger,
        `Failed to store refresh token hash for user ${userId}`,
        'Failed to store refresh token',
        error,
      );
    }
  }

  private async issueTokens(user: UserEntity): Promise<AuthTokensResponseDto> {
    try {
      const [accessToken, refreshToken] = await Promise.all([
        this.authJwtService.signAccessToken(user),
        this.authJwtService.signRefreshToken(user),
      ]);

      return { accessToken, refreshToken };
    } catch (error: unknown) {
      logAndThrowInternal(
        this.logger,
        `Failed to issue auth tokens for user ${user.id}`,
        'Failed to issue auth tokens',
        error,
      );
    }
  }
}
