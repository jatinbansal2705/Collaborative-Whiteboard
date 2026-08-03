import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BoardsModule } from '../boards/boards.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { CommentRepository } from './comment.repository';
import { CommentThreadRepository } from './comment-thread.repository';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [
    AuthModule,
    forwardRef(() => BoardsModule),
    forwardRef(() => RealtimeModule),
    NotificationsModule,
  ],
  controllers: [CommentsController],
  providers: [CommentsService, CommentRepository, CommentThreadRepository],
  exports: [CommentsService],
})
export class CommentsModule {}
