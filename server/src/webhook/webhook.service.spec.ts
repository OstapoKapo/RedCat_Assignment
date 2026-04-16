import { HttpService } from '@nestjs/axios';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import {
  TransactionEntity,
  TransactionStatus,
  TransactionType,
} from '../billing/entities/transaction.entity';
import { UserEntity, UserRole } from '../users/entities/user.entity';
import { WebhookService } from './webhook.service';

describe('WebhookService', () => {
  let service: WebhookService;

  const httpServiceMock = {
    post: jest.fn(),
  };

  const configServiceMock = {
    get: jest.fn(),
  };

  const sender: UserEntity = {
    id: 'sender-id',
    email: 'sender@example.com',
    password: 'hash',
    refreshToken: null,
    role: UserRole.CLIENT,
    isActive: true,
    balance: '10.00',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const receiver: UserEntity = {
    id: 'receiver-id',
    email: 'receiver@example.com',
    password: 'hash',
    refreshToken: null,
    role: UserRole.CLIENT,
    isActive: true,
    balance: '20.00',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const transaction: TransactionEntity = {
    id: 'tx-id',
    idempotencyKey: null,
    amount: '15.50',
    type: TransactionType.DEPOSIT,
    status: TransactionStatus.COMPLETED,
    sender,
    receiver,
    createdAt: new Date('2026-01-03T12:00:00.000Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: HttpService,
          useValue: httpServiceMock,
        },
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('sends webhook with expected payload and returns status code', async () => {
    configServiceMock.get.mockReturnValue('https://example.com/webhook');
    httpServiceMock.post.mockReturnValue(of({ status: 204 }));

    const status = await service.sendTransactionCreated(transaction);

    expect(status).toBe(204);
    expect(httpServiceMock.post).toHaveBeenCalledWith(
      'https://example.com/webhook',
      {
        eventId: transaction.id,
        type: transaction.type,
        status: transaction.status,
        amount: transaction.amount,
        senderEmail: transaction.sender?.email,
        receiverEmail: transaction.receiver.email,
        timestamp: transaction.createdAt.toISOString(),
      },
    );
  });

  it('returns null and skips send when webhook URL is missing', async () => {
    configServiceMock.get.mockReturnValue(undefined);
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    const status = await service.sendTransactionCreated(transaction);

    expect(status).toBeNull();
    expect(httpServiceMock.post).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('throws when receiver email is missing for payload', async () => {
    configServiceMock.get.mockReturnValue('https://example.com/webhook');

    const invalidTransaction = {
      ...transaction,
      receiver: undefined as unknown as UserEntity,
    };

    await expect(
      service.sendTransactionCreated(
        invalidTransaction as unknown as TransactionEntity,
      ),
    ).rejects.toThrow(
      'Transaction receiver email is required for webhook payload',
    );
  });
});
