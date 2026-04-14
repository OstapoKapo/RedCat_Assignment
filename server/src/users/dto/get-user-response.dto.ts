import { ApiProperty } from '@nestjs/swagger';
import { UserEntity, UserRole } from '../entities/user.entity';

export class GetUserResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: 'e1c44752-151a-4cc8-a5d7-2bb9a4a65cc4',
  })
  id!: string;

  @ApiProperty({
    example: 'client@example.com',
  })
  email!: string;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.CLIENT,
  })
  role!: UserRole;

  @ApiProperty({
    example: true,
  })
  isActive!: boolean;

  @ApiProperty({
    type: String,
    format: 'date-time',
  })
  createdAt!: Date;

  @ApiProperty({
    type: String,
    format: 'date-time',
  })
  updatedAt!: Date;

  static fromEntity(entity: UserEntity): GetUserResponseDto {
    return {
      id: entity.id,
      email: entity.email,
      role: entity.role,
      isActive: entity.isActive,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
