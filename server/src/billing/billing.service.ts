import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EntityManager } from 'typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../users/entities/user.entity';
import {
  TransactionEntity,
  TransactionStatus,
  TransactionType,
} from './entities/transaction.entity';

@Injectable()
export class BillingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    @InjectRepository(TransactionEntity)
    private readonly transactionsRepository: Repository<TransactionEntity>,
  ) {}

  async deposit(
    userId: string,
    amount: string,
    key?: string,
  ): Promise<TransactionEntity> {
    return this.runIdempotent(
      key,
      async () => {
        const amountInCents = this.parseAmountToCents(amount);
        if (amountInCents <= 0n) {
          throw new BadRequestException('Amount must be greater than zero');
        }

        const normalizedAmount = this.formatCents(amountInCents);

        const transaction = await this.dataSource.transaction(
          async (manager) => {
            const user = await manager.findOne(UserEntity, {
              where: { id: userId },
              lock: { mode: 'pessimistic_write' },
            });

            if (!user) {
              throw new NotFoundException('User not found');
            }

            const currentBalanceInCents = this.parseAmountToCents(user.balance);
            user.balance = this.formatCents(
              currentBalanceInCents + amountInCents,
            );
            await manager.save(user);

            const newTransaction = manager.create(TransactionEntity, {
              idempotencyKey: key ?? null,
              amount: normalizedAmount,
              type: TransactionType.DEPOSIT,
              status: TransactionStatus.COMPLETED,
              sender: null,
              receiver: user,
            });

            return manager.save(newTransaction);
          },
        );

        this.eventEmitter.emit('transaction.created', transaction);
        return transaction;
      },
      (existing) => existing,
    );
  }

  async cancel(
    transactionId: string,
    key?: string,
  ): Promise<TransactionEntity> {
    return this.runIdempotent(
      key,
      async () => {
        const transaction = await this.dataSource.transaction(
          async (manager) => {
            const lockedTransaction = await manager.findOne(TransactionEntity, {
              where: { id: transactionId },
              lock: { mode: 'pessimistic_write' },
            });

            if (!lockedTransaction) {
              throw new NotFoundException('Transaction not found');
            }

            const existingTransaction = await manager.findOne(
              TransactionEntity,
              {
                where: { id: transactionId },
                relations: {
                  sender: true,
                  receiver: true,
                },
              },
            );

            if (!existingTransaction) {
              throw new NotFoundException('Transaction not found');
            }

            if (existingTransaction.status === TransactionStatus.CANCELLED) {
              return existingTransaction;
            }

            if (existingTransaction.type === TransactionType.TRANSFER) {
              await this.cancelTransferTransaction(
                manager,
                existingTransaction,
              );
            } else if (existingTransaction.type === TransactionType.DEPOSIT) {
              await this.cancelDepositTransaction(manager, existingTransaction);
            } else {
              throw new BadRequestException(
                'Only DEPOSIT and TRANSFER transactions can be cancelled',
              );
            }

            existingTransaction.status = TransactionStatus.CANCELLED;
            if (!existingTransaction.idempotencyKey && key) {
              existingTransaction.idempotencyKey = key;
            }

            return manager.save(existingTransaction);
          },
        );

        this.eventEmitter.emit('transaction.cancelled', transaction);
        return transaction;
      },
      (existing) => (existing.id === transactionId ? existing : undefined),
    );
  }

  async transfer(
    senderId: string,
    receiverEmailOrId: string,
    amount: string,
    key?: string,
  ): Promise<TransactionEntity> {
    return this.runIdempotent(
      key,
      async () => {
        const amountInCents = this.parseAmountToCents(amount);
        if (amountInCents <= 0n) {
          throw new BadRequestException('Amount must be greater than zero');
        }

        const transaction = await this.dataSource.transaction(
          async (manager) => {
            const receiverTarget = receiverEmailOrId.trim();
            const receiver = await manager.findOne(UserEntity, {
              where: receiverTarget.includes('@')
                ? { email: receiverTarget }
                : { id: receiverTarget },
            });
            if (!receiver) {
              throw new NotFoundException('Receiver not found');
            }

            if (receiver.id === senderId) {
              throw new BadRequestException(
                'Sender and receiver must be different users',
              );
            }

            const lockedUsers = await this.lockUsersByIds(
              manager,
              senderId,
              receiver.id,
            );

            const senderBalanceInCents = this.parseAmountToCents(
              lockedUsers.sender.balance,
            );
            if (senderBalanceInCents < amountInCents) {
              throw new BadRequestException('Sender has insufficient balance');
            }

            lockedUsers.sender.balance = this.formatCents(
              senderBalanceInCents - amountInCents,
            );
            const receiverBalanceInCents = this.parseAmountToCents(
              lockedUsers.receiver.balance,
            );
            lockedUsers.receiver.balance = this.formatCents(
              receiverBalanceInCents + amountInCents,
            );

            await manager.save(lockedUsers.sender);
            await manager.save(lockedUsers.receiver);

            const newTransaction = manager.create(TransactionEntity, {
              idempotencyKey: key ?? null,
              amount: this.formatCents(amountInCents),
              type: TransactionType.TRANSFER,
              status: TransactionStatus.COMPLETED,
              sender: lockedUsers.sender,
              receiver: lockedUsers.receiver,
            });

            return manager.save(newTransaction);
          },
        );

        this.eventEmitter.emit('transaction.created', transaction);
        return transaction;
      },
      (existing) =>
        existing.type === TransactionType.TRANSFER ? existing : undefined,
    );
  }

  async getTransactionById(transactionId: string): Promise<TransactionEntity> {
    const transaction = await this.transactionsRepository.findOne({
      where: { id: transactionId },
      relations: {
        sender: true,
        receiver: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }

  async getTransactions(
    userId: string,
    isAdmin: boolean,
  ): Promise<TransactionEntity[]> {
    if (isAdmin) {
      return this.transactionsRepository.find({
        relations: {
          sender: true,
          receiver: true,
        },
        order: {
          createdAt: 'DESC',
        },
      });
    }

    return this.transactionsRepository.find({
      where: [{ sender: { id: userId } }, { receiver: { id: userId } }],
      relations: {
        sender: true,
        receiver: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  private async runIdempotent<T>(
    key: string | undefined,
    operation: () => Promise<T>,
    resolveExisting?: (existing: TransactionEntity) => T | undefined,
  ): Promise<T> {
    if (key) {
      const existing = await this.transactionsRepository.findOne({
        where: { idempotencyKey: key },
        relations: {
          sender: true,
          receiver: true,
        },
      });
      if (existing) {
        if (resolveExisting) {
          const resolved = resolveExisting(existing);
          if (resolved !== undefined) {
            return resolved;
          }
        } else {
          return existing as unknown as T;
        }

        throw new BadRequestException(
          'Idempotency key already used for another transaction',
        );
      }
    }
    return operation();
  }

  private async cancelTransferTransaction(
    manager: EntityManager,
    transaction: TransactionEntity,
  ): Promise<void> {
    if (!transaction.sender) {
      throw new BadRequestException('Transfer transaction must have sender');
    }

    const users = await this.lockUsersByIds(
      manager,
      transaction.sender.id,
      transaction.receiver.id,
    );
    const sender = users.sender;
    const receiver = users.receiver;

    const amountInCents = this.parseAmountToCents(transaction.amount);
    const receiverBalanceInCents = this.parseAmountToCents(receiver.balance);
    if (receiverBalanceInCents < amountInCents) {
      throw new BadRequestException(
        'Receiver has insufficient balance to cancel transfer',
      );
    }

    receiver.balance = this.formatCents(receiverBalanceInCents - amountInCents);
    await manager.save(receiver);

    const senderBalanceInCents = this.parseAmountToCents(sender.balance);
    sender.balance = this.formatCents(senderBalanceInCents + amountInCents);
    await manager.save(sender);
  }

  private async lockUsersByIds(
    manager: EntityManager,
    senderId: string,
    receiverId: string,
  ): Promise<{ sender: UserEntity; receiver: UserEntity }> {
    const [firstLockId, secondLockId] = [senderId, receiverId].sort((a, b) =>
      a.localeCompare(b),
    );

    const firstLockedUser = await manager.findOne(UserEntity, {
      where: { id: firstLockId },
      lock: { mode: 'pessimistic_write' },
    });
    const secondLockedUser =
      firstLockId === secondLockId
        ? firstLockedUser
        : await manager.findOne(UserEntity, {
            where: { id: secondLockId },
            lock: { mode: 'pessimistic_write' },
          });

    const sender =
      firstLockedUser?.id === senderId ? firstLockedUser : secondLockedUser;
    const receiver =
      firstLockedUser?.id === receiverId ? firstLockedUser : secondLockedUser;

    if (!sender) {
      throw new NotFoundException('Sender not found');
    }
    if (!receiver) {
      throw new NotFoundException('Receiver not found');
    }

    return { sender, receiver };
  }

  private async cancelDepositTransaction(
    manager: EntityManager,
    transaction: TransactionEntity,
  ): Promise<void> {
    const receiver = await manager.findOne(UserEntity, {
      where: { id: transaction.receiver.id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!receiver) {
      throw new NotFoundException('Receiver not found');
    }

    const amountInCents = this.parseAmountToCents(transaction.amount);
    const receiverBalanceInCents = this.parseAmountToCents(receiver.balance);
    if (receiverBalanceInCents < amountInCents) {
      throw new BadRequestException(
        'Receiver has insufficient balance to cancel deposit',
      );
    }

    receiver.balance = this.formatCents(receiverBalanceInCents - amountInCents);
    await manager.save(receiver);
  }

  private parseAmountToCents(amount: string): bigint {
    const normalizedAmount = amount.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(normalizedAmount)) {
      throw new BadRequestException(
        'Amount must be a valid decimal with up to 2 fraction digits',
      );
    }

    const [wholePart, fractionPart = ''] = normalizedAmount.split('.');
    const paddedFractionPart = (fractionPart + '00').slice(0, 2);
    return BigInt(wholePart) * 100n + BigInt(paddedFractionPart);
  }

  private formatCents(cents: bigint): string {
    const wholePart = cents / 100n;
    const fractionPart = cents % 100n;
    return `${wholePart.toString()}.${fractionPart.toString().padStart(2, '0')}`;
  }
}
