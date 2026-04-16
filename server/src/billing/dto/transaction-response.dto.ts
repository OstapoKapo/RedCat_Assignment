import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TransactionEntity,
  TransactionStatus,
  TransactionType,
} from '../entities/transaction.entity';

export class TransactionResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: 'f4b5a8e8-d44c-4f21-a2c3-09f6d35795ae',
  })
  id!: string;

  @ApiProperty({ example: '100.50' })
  amount!: string;

  @ApiProperty({ enum: TransactionType })
  type!: TransactionType;

  @ApiProperty({ enum: TransactionStatus })
  status!: TransactionStatus;

  @ApiPropertyOptional({
    format: 'uuid',
    example: '0c7b4dbf-6bc8-443d-96be-7f14f90b79d3',
  })
  senderId!: string | null;

  @ApiPropertyOptional({ example: 'sender@example.com' })
  senderEmail!: string | null;

  @ApiProperty({
    format: 'uuid',
    example: '5cbe7998-4d61-4b20-8985-f4084b8fa8ee',
  })
  receiverId!: string;

  @ApiProperty({ example: 'receiver@example.com' })
  receiverEmail!: string;

  @ApiPropertyOptional({ example: 'deposit-req-001' })
  idempotencyKey!: string | null;

  @ApiProperty({ example: '2026-04-16T00:00:00.000Z' })
  createdAt!: Date;

  static fromEntity(entity: TransactionEntity): TransactionResponseDto {
    return {
      id: entity.id,
      amount: entity.amount,
      type: entity.type,
      status: entity.status,
      senderId: entity.sender?.id ?? null,
      senderEmail: entity.sender?.email ?? null,
      receiverId: entity.receiver.id,
      receiverEmail: entity.receiver.email,
      idempotencyKey: entity.idempotencyKey,
      createdAt: entity.createdAt,
    };
  }
}
