import {
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { compare, hash } from 'bcryptjs';
import { AuthJwtService } from './auth-jwt.service';
import { AuthService } from './auth.service';
import { AuthTokensResponseDto } from './dto/auth-tokens-response.dto';
import { JwtPayload } from './types/jwt-payload.type';
import { UserEntity, UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;

  const usersServiceMock = {
    createUser: jest.fn(),
    getUserByEmail: jest.fn(),
    getUserById: jest.fn(),
  };

  const authJwtServiceMock = {
    signAccessToken: jest.fn(),
    signRefreshToken: jest.fn(),
  };

  const queryBuilderMock = {
    addSelect: jest.fn(),
    where: jest.fn(),
    getOne: jest.fn(),
  };

  const usersRepositoryMock = {
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const hashMock = hash as unknown as jest.Mock;
  const compareMock = compare as unknown as jest.Mock;

  const userEntity: UserEntity = {
    id: 'a36dc0ee-9d85-4e8a-8d30-5f07db9a2c24',
    email: 'client@example.com',
    password: 'password-hash',
    refreshToken: null,
    role: UserRole.CLIENT,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const tokens: AuthTokensResponseDto = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
  };

  const payload: JwtPayload = {
    sub: userEntity.id,
    email: userEntity.email,
    role: userEntity.role,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    queryBuilderMock.addSelect.mockReturnValue(queryBuilderMock);
    queryBuilderMock.where.mockReturnValue(queryBuilderMock);
    usersRepositoryMock.createQueryBuilder.mockReturnValue(queryBuilderMock);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersServiceMock,
        },
        {
          provide: AuthJwtService,
          useValue: authJwtServiceMock,
        },
        {
          provide: getRepositoryToken(UserEntity),
          useValue: usersRepositoryMock,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('registers user and returns tokens', async () => {
      hashMock
        .mockResolvedValueOnce('password-hash')
        .mockResolvedValueOnce('refresh-token-hash');
      usersServiceMock.createUser.mockResolvedValue(userEntity);
      authJwtServiceMock.signAccessToken.mockResolvedValue(tokens.accessToken);
      authJwtServiceMock.signRefreshToken.mockResolvedValue(
        tokens.refreshToken,
      );
      usersRepositoryMock.update.mockResolvedValue({ affected: 1 });

      const result = await service.register({
        email: userEntity.email,
        password: 'StrongPass123!',
      });

      expect(usersServiceMock.createUser).toHaveBeenCalledWith({
        email: userEntity.email,
        password: 'password-hash',
      });
      expect(usersRepositoryMock.update).toHaveBeenCalledWith(
        { id: userEntity.id },
        { refreshToken: 'refresh-token-hash' },
      );
      expect(result).toEqual({ tokens });
    });

    it('throws InternalServerErrorException when refresh hash store fails', async () => {
      hashMock
        .mockResolvedValueOnce('password-hash')
        .mockResolvedValueOnce('refresh-token-hash');
      usersServiceMock.createUser.mockResolvedValue(userEntity);
      authJwtServiceMock.signAccessToken.mockResolvedValue(tokens.accessToken);
      authJwtServiceMock.signRefreshToken.mockResolvedValue(
        tokens.refreshToken,
      );
      usersRepositoryMock.update.mockRejectedValue(new Error('db error'));

      await expect(
        service.register({
          email: userEntity.email,
          password: 'StrongPass123!',
        }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException when user not found', async () => {
      usersServiceMock.getUserByEmail.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(
        service.login({ email: userEntity.email, password: 'StrongPass123!' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when user is inactive', async () => {
      usersServiceMock.getUserByEmail.mockResolvedValue({
        ...userEntity,
        isActive: false,
      });

      await expect(
        service.login({ email: userEntity.email, password: 'StrongPass123!' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when password does not match', async () => {
      usersServiceMock.getUserByEmail.mockResolvedValue(userEntity);
      compareMock.mockResolvedValue(false);

      await expect(
        service.login({ email: userEntity.email, password: 'WrongPass123!' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('logs user in and rotates refresh token', async () => {
      usersServiceMock.getUserByEmail.mockResolvedValue(userEntity);
      compareMock.mockResolvedValue(true);
      authJwtServiceMock.signAccessToken.mockResolvedValue(tokens.accessToken);
      authJwtServiceMock.signRefreshToken.mockResolvedValue(
        tokens.refreshToken,
      );
      hashMock.mockResolvedValue('refresh-token-hash');
      usersRepositoryMock.update.mockResolvedValue({ affected: 1 });

      const result = await service.login({
        email: userEntity.email,
        password: 'StrongPass123!',
      });

      expect(result).toEqual({ tokens });
      expect(usersRepositoryMock.update).toHaveBeenCalledWith(
        { id: userEntity.id },
        { refreshToken: 'refresh-token-hash' },
      );
    });
  });

  describe('me', () => {
    it('throws UnauthorizedException when payload is missing', async () => {
      await expect(service.me(undefined)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when user from token does not exist', async () => {
      usersServiceMock.getUserById.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(service.me(payload)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('refresh', () => {
    it('throws UnauthorizedException when refresh token is missing', async () => {
      await expect(service.refresh(undefined, payload)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when saved refresh token is missing', async () => {
      usersServiceMock.getUserById.mockResolvedValue(userEntity);
      queryBuilderMock.getOne.mockResolvedValue({
        ...userEntity,
        refreshToken: null,
      });

      await expect(
        service.refresh('refresh-token', payload),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when refresh token hash does not match', async () => {
      usersServiceMock.getUserById.mockResolvedValue(userEntity);
      queryBuilderMock.getOne.mockResolvedValue({
        ...userEntity,
        refreshToken: 'stored-hash',
      });
      compareMock.mockResolvedValue(false);

      await expect(
        service.refresh('refresh-token', payload),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('issues fresh tokens and persists new refresh hash', async () => {
      usersServiceMock.getUserById.mockResolvedValue(userEntity);
      queryBuilderMock.getOne.mockResolvedValue({
        ...userEntity,
        refreshToken: 'stored-hash',
      });
      compareMock.mockResolvedValue(true);
      authJwtServiceMock.signAccessToken.mockResolvedValue(tokens.accessToken);
      authJwtServiceMock.signRefreshToken.mockResolvedValue(
        tokens.refreshToken,
      );
      hashMock.mockResolvedValue('new-refresh-hash');
      usersRepositoryMock.update.mockResolvedValue({ affected: 1 });

      const result = await service.refresh('refresh-token', payload);

      expect(result).toEqual({ tokens });
      expect(usersRepositoryMock.update).toHaveBeenCalledWith(
        { id: userEntity.id },
        { refreshToken: 'new-refresh-hash' },
      );
    });
  });

  describe('logout', () => {
    it('throws UnauthorizedException when payload is missing', async () => {
      await expect(service.logout(undefined)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('clears refresh token in storage', async () => {
      usersRepositoryMock.update.mockResolvedValue({ affected: 1 });

      await service.logout(payload);

      expect(usersRepositoryMock.update).toHaveBeenCalledWith(
        { id: payload.sub },
        { refreshToken: null },
      );
    });
  });
});
