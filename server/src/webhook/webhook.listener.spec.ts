import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AxiosError,
  AxiosHeaders,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import {
  TransactionEntity,
  TransactionStatus,
  TransactionType,
} from '../billing/entities/transaction.entity';
import { UserEntity, UserRole } from '../users/entities/user.entity';
import { WebhookListener } from './webhook.listener';
import { WebhookService } from './webhook.service';

describe('WebhookListener', () => {
  let listener: WebhookListener;

  const webhookServiceMock = {
    sendTransactionCreated: jest.fn(),
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
    amount: '5.00',
    type: TransactionType.TRANSFER,
    status: TransactionStatus.COMPLETED,
    sender,
    receiver,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookListener,
        {
          provide: WebhookService,
          useValue: webhookServiceMock,
        },
      ],
    }).compile();

    listener = module.get<WebhookListener>(WebhookListener);
  });

  it('should be defined', () => {
    expect(listener).toBeDefined();
  });

  it('logs success for transaction.created', async () => {
    webhookServiceMock.sendTransactionCreated.mockResolvedValue(200);
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    await listener.handleTransactionCreated(transaction);

    expect(webhookServiceMock.sendTransactionCreated).toHaveBeenCalledWith(
      transaction,
    );
    expect(logSpy).toHaveBeenCalledWith(
      `Webhook sent for transaction.created (transactionId=${transaction.id}, statusCode=200)`,
    );
  });

  it('does not log success when service returns null', async () => {
    webhookServiceMock.sendTransactionCreated.mockResolvedValue(null);
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    logSpy.mockClear();

    await listener.handleTransactionCreated(transaction);

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('handles transaction.cancelled event', async () => {
    webhookServiceMock.sendTransactionCreated.mockResolvedValue(202);
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    await listener.handleTransactionCancelled(transaction);

    expect(webhookServiceMock.sendTransactionCreated).toHaveBeenCalledWith(
      transaction,
    );
    expect(logSpy).toHaveBeenCalledWith(
      `Webhook sent for transaction.cancelled (transactionId=${transaction.id}, statusCode=202)`,
    );
  });

  it('logs unknown status when generic error occurs', async () => {
    webhookServiceMock.sendTransactionCreated.mockRejectedValue(
      new Error('boom'),
    );
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    await listener.handleTransactionCreated(transaction);

    expect(errorSpy).toHaveBeenCalledWith(
      `Webhook send failed for transaction.created (transactionId=${transaction.id}, statusCode=unknown): boom`,
      expect.any(String),
    );
  });

  it('logs axios response status when AxiosError occurs', async () => {
    const axiosResponse: AxiosResponse = {
      data: {},
      status: 502,
      statusText: 'Bad Gateway',
      headers: {},
      config: {
        headers: new AxiosHeaders(),
      } as InternalAxiosRequestConfig,
    };
    const axiosError = new AxiosError(
      'gateway failed',
      'ERR_BAD_RESPONSE',
      axiosResponse.config,
      undefined,
      axiosResponse,
    );

    webhookServiceMock.sendTransactionCreated.mockRejectedValue(axiosError);
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    await listener.handleTransactionCreated(transaction);

    expect(errorSpy).toHaveBeenCalledWith(
      `Webhook send failed for transaction.created (transactionId=${transaction.id}, statusCode=502): gateway failed`,
      expect.any(String),
    );
  });
});
