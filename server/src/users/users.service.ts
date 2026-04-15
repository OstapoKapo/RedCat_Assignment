import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { hash } from 'bcryptjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { logAndThrowInternal } from '../shared/error-handling/error-handling.util';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserEntity, UserRole } from './entities/user.entity';

type SensitiveFields = Partial<
  Record<'role' | 'password' | 'isActive', unknown>
>;

type PaginatedUsersResult = {
  items: UserEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async createUser(input: CreateUserDto): Promise<UserEntity> {
    const user = this.usersRepository.create({
      email: input.email,
      password: input.password,
      role: input.role ?? UserRole.CLIENT,
      isActive: input.isActive ?? true,
    });

    try {
      return await this.usersRepository.save(user);
    } catch (error: unknown) {
      this.handleRepositoryError(error, 'Failed to create user');
    }
  }

  async getUserById(id: string): Promise<UserEntity> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async getUserByEmail(email: string): Promise<UserEntity> {
    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async listUsersPaginated(
    page: number,
    limit: number,
  ): Promise<PaginatedUsersResult> {
    const [items, total] = await this.usersRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: {
        createdAt: 'DESC',
      },
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async updateUser(
    id: string,
    input: UpdateUserDto & SensitiveFields,
  ): Promise<void> {
    if ('role' in input || 'password' in input || 'isActive' in input) {
      throw new BadRequestException(
        'Fields role, password, and isActive cannot be changed via updateUser',
      );
    }

    const user = await this.getUserById(id);
    const merged = this.usersRepository.merge(user, {
      email: input.email,
    });

    try {
      await this.usersRepository.save(merged);
    } catch (error: unknown) {
      this.handleRepositoryError(error, 'Failed to update user');
    }
  }

  async updateUserRole(id: string, input: UpdateUserRoleDto): Promise<void> {
    const result = await this.usersRepository.update(
      { id },
      { role: input.role },
    );
    if (!result.affected) {
      throw new NotFoundException('User not found');
    }
  }

  async updatePassword(
    id: string,
    input: UpdateUserPasswordDto,
  ): Promise<void> {
    const passwordHash = await hash(input.password, 12);

    const result = await this.usersRepository.update(
      { id },
      { password: passwordHash },
    );
    if (!result.affected) {
      throw new NotFoundException('User not found');
    }
  }

  async activateUser(id: string): Promise<void> {
    const result = await this.usersRepository.update(
      { id },
      { isActive: true },
    );
    if (!result.affected) {
      throw new NotFoundException('User not found');
    }
  }

  async deactivateUser(id: string): Promise<void> {
    const result = await this.usersRepository.update(
      { id },
      { isActive: false },
    );
    if (!result.affected) {
      throw new NotFoundException('User not found');
    }
  }

  async deleteUser(id: string): Promise<void> {
    const result = await this.usersRepository.delete({ id });
    if (!result.affected) {
      throw new NotFoundException('User not found');
    }
  }

  private handleRepositoryError(error: unknown, message: string): never {
    if (this.isUniqueViolation(error)) {
      throw new ConflictException('A user with this email already exists');
    }

    logAndThrowInternal(this.logger, message, message, error);
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    );
  }
}
