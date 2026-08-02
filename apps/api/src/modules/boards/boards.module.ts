import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { BoardRepository } from './board.repository';
import { BoardsController } from './boards.controller';
import { BoardsService } from './boards.service';
import { FavouriteRepository } from './favourite.repository';
import { BoardAccessGuard } from './guards/board-access.guard';
import { InviteRepository } from './invite.repository';
import { MemberRepository } from './member.repository';

@Module({
  imports: [AuthModule, forwardRef(() => RealtimeModule)],
  controllers: [BoardsController],
  providers: [
    BoardsService,
    BoardRepository,
    MemberRepository,
    FavouriteRepository,
    InviteRepository,
    BoardAccessGuard,
  ],
  exports: [BoardRepository, MemberRepository],
})
export class BoardsModule {}
