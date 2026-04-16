import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { BillingService } from './billing.service';
import {
  TransactionEntity,
  TransactionStatus,
  TransactionType,
} from './entities/transaction.entity';
import { UserEntity, UserRole } from '../users/entities/user.entity';

describe('BillingService', () => {
  let service: BillingService;

  const dataSourceMock = {
    transaction: jest.fn(),
  };

  const eventEmitterMock = {
    emit: jest.fn(),
  };

  const transactionsRepositoryMock = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const managerMock = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };

  const sender: UserEntity = {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    email: 'sender@example.com',
    password: 'hash',
    refreshToken: null,
    role: UserRole.CLIENT,
    isActive: true,
    balance: '100.00',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const receiver: UserEntity = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    email: 'receiver@example.com',
    password: 'hash',
    refreshToken: null,
    role: UserRole.CLIENT,
    isActive: true,
    balance: '50.00',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const completedTransfer: TransactionEntity = {
    id: 'tx-transfer-1',
    idempotencyKey: null,
    amount: '20.00',
    type: TransactionType.TRANSFER,
    status: TransactionStatus.COMPLETED,
    sender,
    receiver,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    dataSourceMock.transaction.mockImplementation(
      async (callback: (manager: EntityManager) => Promise<unknown>) =>
        callback(managerMock as unknown as EntityManager),
    );
    managerMock.create.mockImplementation(
      (_entity: unknown, payload: unknown) => payload,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        {
          provide: DataSource,
          useValue: dataSourceMock,
        },
        {
          provide: EventEmitter2,
          useValue: eventEmitterMock,
        },
        {
          provide: getRepositoryToken(TransactionEntity),
          useValue: transactionsRepositoryMock,
        },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('deposit', () => {
    it('creates deposit transaction and emits transaction.created', async () => {
      const user = { ...receiver, id: receiver.id, balance: '10.00' };
      const createdTransaction: TransactionEntity = {
        id: 'dep-1',
        idempotencyKey: 'dep-key',
        amount: '15.50',
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.COMPLETED,
        sender: null,
        receiver: { ...user, balance: '25.50' },
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
      };

      transactionsRepositoryMock.findOne.mockResolvedValue(null);
      managerMock.findOne.mockResolvedValueOnce(user);
      managerMock.save
        .mockResolvedValueOnce({ ...user, balance: '25.50' })
        .mockResolvedValueOnce(createdTransaction);

      const result = await service.deposit(user.id, '15.50', 'dep-key');

      expect(result).toBe(createdTransaction);
      expect(eventEmitterMock.emit).toHaveBeenCalledWith(
        'transaction.created',
        createdTransaction,
      );
    });

    it('returns existing transaction when idempotency key already exists', async () => {
      const existing: TransactionEntity = {
        ...completedTransfer,
        idempotencyKey: 'same-key',
      };
      transactionsRepositoryMock.findOne.mockResolvedValue(existing);

      const result = await service.deposit(sender.id, '10.00', 'same-key');

      expect(result).toBe(existing);
      expect(dataSourceMock.transaction).not.toHaveBeenCalled();
      expect(eventEmitterMock.emit).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for invalid amount', async () => {
      await expect(service.deposit(sender.id, '-1.00')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('transfer', () => {
    it('transfers funds with deterministic lock ordering and emits event', async () => {
      transactionsRepositoryMock.findOne.mockResolvedValue(null);
      managerMock.findOne
        .mockResolvedValueOnce(receiver)
        .mockResolvedValueOnce(receiver)
        .mockResolvedValueOnce(sender);

      const savedTransaction: TransactionEntity = {
        ...completedTransfer,
        idempotencyKey: 'transfer-key',
      };
      managerMock.save
        .mockResolvedValueOnce({ ...sender, balance: '80.00' })
        .mockResolvedValueOnce({ ...receiver, balance: '70.00' })
        .mockResolvedValueOnce(savedTransaction);

      const result = await service.transfer(
        sender.id,
        receiver.email,
        '20.00',
        'transfer-key',
      );

      expect(result).toBe(savedTransaction);
      expect(eventEmitterMock.emit).toHaveBeenCalledWith(
        'transaction.created',
        savedTransaction,
      );

      expect(managerMock.findOne).toHaveBeenNthCalledWith(2, UserEntity, {
        where: { id: receiver.id },
        lock: { mode: 'pessimistic_write' },
      });
      expect(managerMock.findOne).toHaveBeenNthCalledWith(3, UserEntity, {
        where: { id: sender.id },
        lock: { mode: 'pessimistic_write' },
      });
    });

    it('throws BadRequestException when sender balance is insufficient', async () => {
      transactionsRepositoryMock.findOne.mockResolvedValue(null);
      managerMock.findOne
        .mockResolvedValueOnce(receiver)
        .mockResolvedValueOnce(receiver)
        .mockResolvedValueOnce({ ...sender, balance: '1.00' });

      await expect(
        service.transfer(sender.id, receiver.id, '20.00'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when idempotency key belongs to another type', async () => {
      transactionsRepositoryMock.findOne.mockResolvedValue({
        ...completedTransfer,
        type: TransactionType.DEPOSIT,
        idempotencyKey: 'wrong-type-key',
      });

      await expect(
        service.transfer(sender.id, receiver.id, '10.00', 'wrong-type-key'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('returns existing transaction for same transaction id by idempotency key', async () => {
      const existing: TransactionEntity = {
        ...completedTransfer,
        id: 'same-id',
        idempotencyKey: 'cancel-key',
      };
      transactionsRepositoryMock.findOne.mockResolvedValue(existing);

      const result = await service.cancel('same-id', 'cancel-key');

      expect(result).toBe(existing);
      expect(dataSourceMock.transaction).not.toHaveBeenCalled();
      expect(eventEmitterMock.emit).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when key is used for another transaction', async () => {
      const existing: TransactionEntity = {
        ...completedTransfer,
        id: 'another-id',
        idempotencyKey: 'cancel-key',
      };
      transactionsRepositoryMock.findOne.mockResolvedValue(existing);

      await expect(
        service.cancel('target-id', 'cancel-key'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('cancels deposit transaction and emits transaction.cancelled', async () => {
      const lockedTx: TransactionEntity = {
        ...completedTransfer,
        id: 'dep-tx',
        type: TransactionType.DEPOSIT,
        sender: null,
      };
      const relationTx: TransactionEntity = {
        ...lockedTx,
        receiver: { ...receiver, balance: '60.00' },
      };
      const cancelledTx: TransactionEntity = {
        ...relationTx,
        status: TransactionStatus.CANCELLED,
        idempotencyKey: 'cancel-dep-key',
      };

      transactionsRepositoryMock.findOne.mockResolvedValue(null);
      managerMock.findOne
        .mockResolvedValueOnce(lockedTx)
        .mockResolvedValueOnce(relationTx)
        .mockResolvedValueOnce(relationTx.receiver);
      managerMock.save
        .mockResolvedValueOnce({ ...relationTx.receiver, balance: '40.00' })
        .mockResolvedValueOnce(cancelledTx);

      const result = await service.cancel('dep-tx', 'cancel-dep-key');

      expect(result.status).toBe(TransactionStatus.CANCELLED);
      expect(eventEmitterMock.emit).toHaveBeenCalledWith(
        'transaction.cancelled',
        cancelledTx,
      );
    });
  });

  describe('getTransactionById', () => {
    it('returns transaction when found', async () => {
      transactionsRepositoryMock.findOne.mockResolvedValue(completedTransfer);

      const result = await service.getTransactionById(completedTransfer.id);

      expect(result).toBe(completedTransfer);
    });

    it('throws NotFoundException when missing', async () => {
      transactionsRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.getTransactionById('missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getTransactions', () => {
    it('returns all transactions for admin', async () => {
      transactionsRepositoryMock.find.mockResolvedValue([completedTransfer]);

      const result = await service.getTransactions('ignored', true);

      expect(result).toEqual([completedTransfer]);
      expect(transactionsRepositoryMock.find).toHaveBeenCalledWith({
        relations: {
          sender: true,
          receiver: true,
        },
        order: {
          createdAt: 'DESC',
        },
      });
    });

    it('returns only user-related transactions for non-admin', async () => {
      transactionsRepositoryMock.find.mockResolvedValue([completedTransfer]);

      const result = await service.getTransactions(sender.id, false);

      expect(result).toEqual([completedTransfer]);
      expect(transactionsRepositoryMock.find).toHaveBeenCalledWith({
        where: [{ sender: { id: sender.id } }, { receiver: { id: sender.id } }],
        relations: {
          sender: true,
          receiver: true,
        },
        order: {
          createdAt: 'DESC',
        },
      });
    });
  });
});
