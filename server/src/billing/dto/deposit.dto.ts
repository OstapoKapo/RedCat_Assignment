import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class DepositDto {
  @ApiProperty({
    example: '100.50',
    description: 'Deposit amount (decimal string with up to 2 fraction digits)',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'Amount must be a valid decimal with up to 2 fraction digits',
  })
  amount!: string;
}
