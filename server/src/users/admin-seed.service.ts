import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { hash } from 'bcryptjs';
import { Repository } from 'typeorm';
import { UserEntity, UserRole } from './entities/user.entity';

@Injectable()
export class AdminSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeedService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const isTest = this.configService.get<string>('NODE_ENV') === 'test';
    const seedEnabled =
      this.configService.get<string>('SEED_ADMIN_ON_STARTUP') ?? 'true';

    if (isTest || seedEnabled === 'false') {
      return;
    }

    const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
    const adminPassword = this.configService.get<string>('ADMIN_PASSWORD');

    if (!adminEmail || !adminPassword) {
      throw new Error(
        'ADMIN_EMAIL and ADMIN_PASSWORD must be set to seed default admin user.',
      );
    }

    const normalizedEmail = adminEmail.trim().toLowerCase();
    const existingUser = await this.usersRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      if (existingUser.role !== UserRole.ADMIN || !existingUser.isActive) {
        await this.usersRepository.update(
          { id: existingUser.id },
          { role: UserRole.ADMIN, isActive: true },
        );
      }
      return;
    }

    const passwordHash = await hash(adminPassword, 12);
    const admin = this.usersRepository.create({
      email: normalizedEmail,
      password: passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
    });

    await this.usersRepository.save(admin);
    this.logger.log(`Default admin user created: ${normalizedEmail}`);
  }
}
