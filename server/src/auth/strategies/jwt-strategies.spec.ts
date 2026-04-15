import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAccessStrategy } from './jwt-access.strategy';
import { JwtRefreshStrategy } from './jwt-refresh.strategy';
import { JwtPayload } from '../types/jwt-payload.type';
import { UserRole } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';

describe('JWT strategies', () => {
  const configServiceMock = {
    getOrThrow: jest.fn().mockReturnValue('test-secret'),
  } as unknown as ConfigService;

  const usersServiceMock = {
    getUserById: jest.fn(),
  } as unknown as UsersService;

  const payload: JwtPayload = {
    sub: 'a36dc0ee-9d85-4e8a-8d30-5f07db9a2c24',
    email: 'client@example.com',
    role: UserRole.CLIENT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('JwtAccessStrategy', () => {
    const strategy = new JwtAccessStrategy(configServiceMock, usersServiceMock);

    it('returns payload for active user', async () => {
      (usersServiceMock.getUserById as jest.Mock).mockResolvedValue({
        id: payload.sub,
        isActive: true,
      });

      await expect(strategy.validate(payload)).resolves.toEqual(payload);
    });

    it('throws UnauthorizedException for inactive user', async () => {
      (usersServiceMock.getUserById as jest.Mock).mockResolvedValue({
        id: payload.sub,
        isActive: false,
      });

      await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when user not found', async () => {
      (usersServiceMock.getUserById as jest.Mock).mockRejectedValue(
        new Error('not found'),
      );

      await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('JwtRefreshStrategy', () => {
    const strategy = new JwtRefreshStrategy(
      configServiceMock,
      usersServiceMock,
    );

    it('returns payload for active user', async () => {
      (usersServiceMock.getUserById as jest.Mock).mockResolvedValue({
        id: payload.sub,
        isActive: true,
      });

      await expect(strategy.validate(payload)).resolves.toEqual(payload);
    });

    it('throws UnauthorizedException for inactive user', async () => {
      (usersServiceMock.getUserById as jest.Mock).mockResolvedValue({
        id: payload.sub,
        isActive: false,
      });

      await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
