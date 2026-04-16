import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { TransactionEntity } from '../billing/entities/transaction.entity';

type WebhookPayload = {
  eventId: string;
  type: string;
  status: string;
  amount: string;
  senderEmail?: string;
  receiverEmail: string;
  timestamp: string;
};

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async sendTransactionCreated(
    transaction: TransactionEntity,
  ): Promise<number | null> {
    const destinationUrl = this.configService.get<string>(
      'WEBHOOK_DESTINATION_URL',
    );

    if (!destinationUrl) {
      this.logger.warn(
        'WEBHOOK_DESTINATION_URL is not configured; skipping webhook send',
      );
      return null;
    }

    const payload = this.buildPayload(transaction);
    const response = await firstValueFrom(
      this.httpService.post(destinationUrl, payload),
    );
    return response.status;
  }

  private buildPayload(transaction: TransactionEntity): WebhookPayload {
    if (!transaction.receiver?.email) {
      throw new Error(
        'Transaction receiver email is required for webhook payload',
      );
    }

    return {
      eventId: transaction.id,
      type: transaction.type,
      status: transaction.status,
      amount: transaction.amount,
      senderEmail: transaction.sender?.email,
      receiverEmail: transaction.receiver.email,
      timestamp: transaction.createdAt.toISOString(),
    };
  }
}
