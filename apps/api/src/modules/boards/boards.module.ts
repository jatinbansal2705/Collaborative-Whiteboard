import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BoardRepository } from './board.repository';
import { BoardsController } from './boards.controller';
import { BoardsService } from './boards.service';
import { FavouriteRepository } from './favourite.repository';
import { BoardAccessGuard } from './guards/board-access.guard';
import { InviteRepository } from './invite.repository';
import { MemberRepository } from './member.repository';

@Module({
  imports: [AuthModule],
  controllers: [BoardsController],
  providers: [
    BoardsService,
    BoardRepository,
    MemberRepository,
    FavouriteRepository,
    InviteRepository,
    BoardAccessGuard,
  ],
})
export class BoardsModule {}
