import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class UpdateUserPasswordDto {
  @ApiProperty({
    example: 'NewStrongPass123!',
    minLength: 8,
    description: 'New user password',
  })
  @IsString()
  @MinLength(8)
  password!: string;
}
