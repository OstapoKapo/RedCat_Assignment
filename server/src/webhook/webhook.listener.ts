import { AxiosError } from 'axios';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TransactionEntity } from '../billing/entities/transaction.entity';
import { WebhookService } from './webhook.service';

@Injectable()
export class WebhookListener {
  private readonly logger = new Logger(WebhookListener.name);

  constructor(private readonly webhookService: WebhookService) {}

  @OnEvent('transaction.created', { async: true })
  async handleTransactionCreated(
    transaction: TransactionEntity,
  ): Promise<void> {
    await this.sendWebhook('transaction.created', transaction);
  }

  @OnEvent('transaction.cancelled', { async: true })
  async handleTransactionCancelled(
    transaction: TransactionEntity,
  ): Promise<void> {
    await this.sendWebhook('transaction.cancelled', transaction);
  }

  private async sendWebhook(
    eventName: string,
    transaction: TransactionEntity,
  ): Promise<void> {
    try {
      const statusCode =
        await this.webhookService.sendTransactionCreated(transaction);
      if (statusCode === null) {
        return;
      }

      this.logger.log(
        `Webhook sent for ${eventName} (transactionId=${transaction.id}, statusCode=${statusCode})`,
      );
    } catch (error: unknown) {
      const statusCode =
        error instanceof AxiosError ? error.response?.status : undefined;
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Webhook send failed for ${eventName} (transactionId=${transaction.id}, statusCode=${statusCode ?? 'unknown'}): ${message}`,
        stack,
      );
    }
  }
}
