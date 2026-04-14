import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({
    example: 'updated@example.com',
    description: 'New user email',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsOptional()
  @IsEmail()
  email?: string;
}
