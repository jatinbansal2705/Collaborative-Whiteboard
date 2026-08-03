import { forwardRef, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EmailModule } from '../email/email.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { EmailQueueProcessor } from './email-queue.processor';
import { NotificationRepository } from './notification.repository';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { EMAIL_QUEUE_NAME } from './notifications.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: EMAIL_QUEUE_NAME }),
    EmailModule,
    forwardRef(() => RealtimeModule),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationRepository,
    EmailQueueProcessor,
  ],
  exports: [NotificationsService, NotificationRepository],
})
export class NotificationsModule {}
