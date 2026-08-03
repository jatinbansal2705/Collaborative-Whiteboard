import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { BoardAccess } from '../boards/board-access.decorator';
import { BoardAccessGuard } from '../boards/guards/board-access.guard';
import { CommentsService } from './comments.service';
import type {
  CommentResponseDto,
  CommentThreadResponseDto,
} from './dto/comment.response.dto';
import type { CreateCommentDto } from './dto/create-comment.dto';
import type { CreateCommentThreadDto } from './dto/create-comment-thread.dto';
import type { ResolveThreadDto } from './dto/resolve-thread.dto';

@ApiTags('comments')
@Controller('boards/:id/comments')
@UseGuards(BoardAccessGuard)
@ApiBearerAuth('access-token')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  @BoardAccess({ minRole: 'VIEWER' })
  @ApiOperation({ summary: 'List comment threads on a board' })
  listThreads(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') boardId: string,
  ): Promise<CommentThreadResponseDto[]> {
    return this.commentsService.listThreads(user, boardId);
  }

  @Post()
  @BoardAccess({ minRole: 'COMMENTER' })
  @ApiOperation({ summary: 'Create a comment thread with an initial comment' })
  createThread(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') boardId: string,
    @Body() dto: CreateCommentThreadDto,
  ): Promise<CommentThreadResponseDto> {
    return this.commentsService.createThread(user, boardId, dto);
  }

  @Post(':threadId/replies')
  @BoardAccess({ minRole: 'COMMENTER' })
  @ApiOperation({ summary: 'Add a reply to a comment thread' })
  addReply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') boardId: string,
    @Param('threadId') threadId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    return this.commentsService.addReply(user, boardId, threadId, dto);
  }

  @Post(':threadId/resolve')
  @BoardAccess({ minRole: 'COMMENTER' })
  @ApiOperation({ summary: 'Resolve or reopen a comment thread' })
  setResolved(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') boardId: string,
    @Param('threadId') threadId: string,
    @Body() dto: ResolveThreadDto,
  ): Promise<CommentThreadResponseDto> {
    return this.commentsService.setResolved(user, boardId, threadId, dto);
  }
}
