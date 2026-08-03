import { ConfigService } from '@nestjs/config';
import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BoardsModule } from '../boards/boards.module';
import { ChatModule } from '../chat/chat.module';
import { PresenceService } from './presence.service';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import {
  DEFAULT_CHAT_TYPING_THROTTLE_MS,
  DEFAULT_CURSOR_MIN_INTERVAL_MS,
  DEFAULT_PRESENCE_TTL_MS,
  REALTIME_CONFIG,
  type RealtimeConfig,
} from './realtime.constants';

@Module({
  imports: [
    AuthModule,
    forwardRef(() => BoardsModule),
    forwardRef(() => ChatModule),
  ],
  providers: [
    RealtimeGateway,
    RealtimeService,
    PresenceService,
    {
      provide: REALTIME_CONFIG,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): RealtimeConfig => ({
        presenceTtlMs:
          configService.get<number>('realtime.presenceTtlMs') ??
          DEFAULT_PRESENCE_TTL_MS,
        cursorMinIntervalMs:
          configService.get<number>('realtime.cursorMinIntervalMs') ??
          DEFAULT_CURSOR_MIN_INTERVAL_MS,
        chatTypingThrottleMs:
          configService.get<number>('realtime.chatTypingThrottleMs') ??
          DEFAULT_CHAT_TYPING_THROTTLE_MS,
      }),
    },
  ],
  exports: [RealtimeService, PresenceService],
})
export class RealtimeModule {}
