import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

export class TransferDto {
  @ApiProperty({
    example: 'client2@example.com',
    description: 'Receiver email or user id',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  receiverEmailOrId!: string;

  @ApiProperty({
    example: '25.00',
    description:
      'Transfer amount (decimal string with up to 2 fraction digits)',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'Amount must be a valid decimal with up to 2 fraction digits',
  })
  amount!: string;
}
