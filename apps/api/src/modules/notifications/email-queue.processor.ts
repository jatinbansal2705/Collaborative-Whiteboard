import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EmailService } from '../email/email.service';
import { EMAIL_JOB_MENTION, EMAIL_QUEUE_NAME } from './notifications.constants';
import type { EmailJobData, MentionEmailJobData } from './notification.types';

/**
 * BullMQ worker for the `email` queue. Each job name maps to an EmailService
 * dispatch; failures are retried by BullMQ per the queue backoff policy.
 */
@Processor(EMAIL_QUEUE_NAME)
@Injectable()
export class EmailQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailQueueProcessor.name);

  constructor(private readonly emailService: EmailService) {
    super();
  }

  async process(job: Job<EmailJobData, void, string>): Promise<void> {
    switch (job.name) {
      case EMAIL_JOB_MENTION:
        await this.sendMentionEmail(job.data);
        return;
      default:
        this.logger.warn(`Unknown email job name: ${job.name}`);
    }
  }

  private async sendMentionEmail(data: MentionEmailJobData): Promise<void> {
    const link = `${data.frontendUrl}/boards/${data.boardId}?thread=${data.threadId}`;
    await this.emailService.sendMentionEmail({
      to: data.to,
      name: data.recipientName ?? undefined,
      actorName: data.actorName,
      bodyPreview: data.bodyPreview,
      commentLink: link,
    });
  }
}
