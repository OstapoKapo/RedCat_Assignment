import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  TRANSACTION_STATUS_CANCELLED,
  TRANSACTION_STATUS_COMPLETED,
  TRANSACTION_STATUS_PENDING,
  TRANSACTION_TYPE_CANCEL,
  TRANSACTION_TYPE_DEPOSIT,
  TRANSACTION_TYPE_TRANSFER,
} from '../constraints/transaction.constants';
import { UserEntity } from '../../users/entities/user.entity';

export enum TransactionType {
  DEPOSIT = TRANSACTION_TYPE_DEPOSIT,
  TRANSFER = TRANSACTION_TYPE_TRANSFER,
  CANCEL = TRANSACTION_TYPE_CANCEL,
}

export enum TransactionStatus {
  PENDING = TRANSACTION_STATUS_PENDING,
  COMPLETED = TRANSACTION_STATUS_COMPLETED,
  CANCELLED = TRANSACTION_STATUS_CANCELLED,
}

@Entity('transactions')
export class TransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  idempotencyKey!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type!: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
  })
  status!: TransactionStatus;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'senderId' })
  sender!: UserEntity | null;

  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'receiverId' })
  receiver!: UserEntity;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;
}
