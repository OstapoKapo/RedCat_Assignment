import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserEntity } from './entities/user.entity';
import { UsersService } from './users.service';
import { UserRole } from './entities/user.entity';

describe('UsersService', () => {
  let service: UsersService;

  const usersRepositoryMock = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    merge: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const userEntity: UserEntity = {
    id: 'b1e95d84-a80e-4a02-9f0a-6ccf8f748fcf',
    email: 'user@example.com',
    password: 'StrongPass123!',
    role: UserRole.CLIENT,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: usersRepositoryMock,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createUser', () => {
    it('creates user with default role and active flag', async () => {
      usersRepositoryMock.create.mockReturnValue(userEntity);
      usersRepositoryMock.save.mockResolvedValue(userEntity);

      const result = await service.createUser({
        email: 'user@example.com',
        password: 'StrongPass123!',
      });

      expect(usersRepositoryMock.create).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'StrongPass123!',
        role: UserRole.CLIENT,
        isActive: true,
      });
      expect(result).toBe(userEntity);
    });

    it('throws ConflictException on unique violation', async () => {
      usersRepositoryMock.create.mockReturnValue(userEntity);
      usersRepositoryMock.save.mockRejectedValue({ code: '23505' });

      await expect(
        service.createUser({
          email: 'user@example.com',
          password: 'StrongPass123!',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws InternalServerErrorException on unknown save error', async () => {
      usersRepositoryMock.create.mockReturnValue(userEntity);
      usersRepositoryMock.save.mockRejectedValue(new Error('db down'));

      await expect(
        service.createUser({
          email: 'user@example.com',
          password: 'StrongPass123!',
        }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('getUserById', () => {
    it('returns user when found', async () => {
      usersRepositoryMock.findOne.mockResolvedValue(userEntity);

      const result = await service.getUserById(userEntity.id);

      expect(usersRepositoryMock.findOne).toHaveBeenCalledWith({
        where: { id: userEntity.id },
      });
      expect(result).toBe(userEntity);
    });

    it('throws NotFoundException when user does not exist', async () => {
      usersRepositoryMock.findOne.mockResolvedValue(null);

      await expect(service.getUserById('missing-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('getUserByEmail', () => {
    it('returns user when found', async () => {
      usersRepositoryMock.findOne.mockResolvedValue(userEntity);

      const result = await service.getUserByEmail(userEntity.email);

      expect(usersRepositoryMock.findOne).toHaveBeenCalledWith({
        where: { email: userEntity.email },
      });
      expect(result).toBe(userEntity);
    });

    it('throws NotFoundException when email does not exist', async () => {
      usersRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.getUserByEmail('missing@example.com'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('listUsersPaginated', () => {
    it('returns paginated users and totalPages', async () => {
      usersRepositoryMock.findAndCount.mockResolvedValue([[userEntity], 21]);

      const result = await service.listUsersPaginated(2, 10);

      expect(usersRepositoryMock.findAndCount).toHaveBeenCalledWith({
        skip: 10,
        take: 10,
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual({
        items: [userEntity],
        total: 21,
        page: 2,
        limit: 10,
        totalPages: 3,
      });
    });
  });

  describe('updateUser', () => {
    it('blocks sensitive fields', async () => {
      await expect(
        service.updateUser('user-id', {
          email: 'user@example.com',
          role: 'ADMIN',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates allowed fields', async () => {
      const merged = { ...userEntity, email: 'updated@example.com' };
      usersRepositoryMock.findOne.mockResolvedValue(userEntity);
      usersRepositoryMock.merge.mockReturnValue(merged);
      usersRepositoryMock.save.mockResolvedValue(merged);

      await service.updateUser(userEntity.id, { email: 'updated@example.com' });

      expect(usersRepositoryMock.merge).toHaveBeenCalledWith(userEntity, {
        email: 'updated@example.com',
      });
      expect(usersRepositoryMock.save).toHaveBeenCalledWith(merged);
    });

    it('throws ConflictException on unique violation', async () => {
      usersRepositoryMock.findOne.mockResolvedValue(userEntity);
      usersRepositoryMock.merge.mockReturnValue(userEntity);
      usersRepositoryMock.save.mockRejectedValue({ code: '23505' });

      await expect(
        service.updateUser(userEntity.id, { email: 'dup@example.com' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws InternalServerErrorException on save error', async () => {
      usersRepositoryMock.findOne.mockResolvedValue(userEntity);
      usersRepositoryMock.merge.mockReturnValue(userEntity);
      usersRepositoryMock.save.mockRejectedValue(new Error('unexpected'));

      await expect(
        service.updateUser(userEntity.id, { email: 'updated@example.com' }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('throws NotFoundException when user does not exist', async () => {
      usersRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.updateUser('missing-id', { email: 'updated@example.com' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateUserRole', () => {
    it('updates role when user exists', async () => {
      usersRepositoryMock.update.mockResolvedValue({ affected: 1 });

      await service.updateUserRole(userEntity.id, { role: UserRole.ADMIN });

      expect(usersRepositoryMock.update).toHaveBeenCalledWith(
        { id: userEntity.id },
        { role: UserRole.ADMIN },
      );
    });

    it('throws NotFoundException when user does not exist', async () => {
      usersRepositoryMock.update.mockResolvedValue({ affected: 0 });

      await expect(
        service.updateUserRole('missing-id', { role: UserRole.ADMIN }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updatePassword', () => {
    it('updates password when user exists', async () => {
      usersRepositoryMock.update.mockResolvedValue({ affected: 1 });

      await service.updatePassword(userEntity.id, { password: 'newPass123!' });

      expect(usersRepositoryMock.update).toHaveBeenCalledWith(
        { id: userEntity.id },
        { password: 'newPass123!' },
      );
    });

    it('throws NotFoundException when user does not exist', async () => {
      usersRepositoryMock.update.mockResolvedValue({ affected: 0 });

      await expect(
        service.updatePassword('missing-id', { password: 'newPass123!' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('activateUser', () => {
    it('activates user when user exists', async () => {
      usersRepositoryMock.update.mockResolvedValue({ affected: 1 });

      await service.activateUser(userEntity.id);

      expect(usersRepositoryMock.update).toHaveBeenCalledWith(
        { id: userEntity.id },
        { isActive: true },
      );
    });

    it('throws NotFoundException when user does not exist', async () => {
      usersRepositoryMock.update.mockResolvedValue({ affected: 0 });

      await expect(service.activateUser('missing-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('deactivateUser', () => {
    it('deactivates user when user exists', async () => {
      usersRepositoryMock.update.mockResolvedValue({ affected: 1 });

      await service.deactivateUser(userEntity.id);

      expect(usersRepositoryMock.update).toHaveBeenCalledWith(
        { id: userEntity.id },
        { isActive: false },
      );
    });

    it('throws NotFoundException when user does not exist', async () => {
      usersRepositoryMock.update.mockResolvedValue({ affected: 0 });

      await expect(service.deactivateUser('missing-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('deleteUser', () => {
    it('deletes user when user exists', async () => {
      usersRepositoryMock.delete.mockResolvedValue({ affected: 1 });

      await service.deleteUser(userEntity.id);

      expect(usersRepositoryMock.delete).toHaveBeenCalledWith({
        id: userEntity.id,
      });
    });

    it('throws NotFoundException when user does not exist', async () => {
      usersRepositoryMock.delete.mockResolvedValue({ affected: 0 });

      await expect(service.deleteUser('missing-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
