import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { WebhookListener } from './webhook.listener';
import { WebhookService } from './webhook.service';

@Module({
  imports: [HttpModule],
  providers: [WebhookService, WebhookListener],
})
export class WebhookModule {}
