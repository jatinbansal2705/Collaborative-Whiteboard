import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { UserRepository } from '../auth/repositories/user.repository';
import { MemberRepository } from '../boards/member.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  COMMENT_MENTION_MAX,
  COMMENT_MENTION_TOKEN_PATTERN,
  MENTION_BODY_PREVIEW_MAX,
} from './comments.constants';
import { commentThreadNotFound } from './comments.errors';
import { CommentThreadRepository } from './comment-thread.repository';
import {
  CommentRepository,
  type CommentMentionRecord,
} from './comment.repository';
import {
  toComment,
  toCommentThread,
  type CommentResponseDto,
  type CommentThreadResponseDto,
} from './dto/comment.response.dto';
import type { CreateCommentThreadDto } from './dto/create-comment-thread.dto';
import type { CreateCommentDto } from './dto/create-comment.dto';
import type { ResolveThreadDto } from './dto/resolve-thread.dto';

interface MentionResolution {
  userId: string;
  username: string;
  email: string;
  name: string | null;
}

@Injectable()
export class CommentsService {
  constructor(
    private readonly commentThreadRepository: CommentThreadRepository,
    private readonly commentRepository: CommentRepository,
    private readonly memberRepository: MemberRepository,
    private readonly userRepository: UserRepository,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => RealtimeService))
    private readonly realtimeService: RealtimeService,
  ) {}

  async listThreads(
    user: AuthenticatedUser,
    boardId: string,
  ): Promise<CommentThreadResponseDto[]> {
    const threads = await this.commentThreadRepository.listByBoard(boardId);
    return threads.map(toCommentThread);
  }

  async createThread(
    user: AuthenticatedUser,
    boardId: string,
    dto: CreateCommentThreadDto,
  ): Promise<CommentThreadResponseDto> {
    const resolutions = await this.resolveMentionsForBoard(
      boardId,
      dto.body,
      user.id,
    );
    const thread = await this.commentThreadRepository.create({
      boardId,
      x: dto.x,
      y: dto.y,
    });
    const comment = await this.commentRepository.create({
      threadId: thread.id,
      authorId: user.id,
      body: dto.body,
      mentions: toMentionRecords(resolutions),
    });

    await this.notifyMentions({
      boardId,
      threadId: thread.id,
      commentId: comment.id,
      authorId: user.id,
      resolutions,
      bodyPreview: comment.body.slice(0, MENTION_BODY_PREVIEW_MAX),
    });
    this.realtimeService.broadcastCommentCreated(boardId, {
      boardId,
      threadId: thread.id,
      commentId: comment.id,
      userId: user.id,
    });

    const loaded = await this.commentThreadRepository.findByIdWithComments(
      thread.id,
    );
    if (loaded === null) {
      throw commentThreadNotFound();
    }
    return toCommentThread(loaded);
  }

  async addReply(
    user: AuthenticatedUser,
    boardId: string,
    threadId: string,
    dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    const thread = await this.commentThreadRepository.findById(threadId);
    if (thread === null || thread.boardId !== boardId) {
      throw commentThreadNotFound();
    }

    const resolutions = await this.resolveMentionsForBoard(
      boardId,
      dto.body,
      user.id,
    );
    const comment = await this.commentRepository.create({
      threadId,
      authorId: user.id,
      body: dto.body,
      mentions: toMentionRecords(resolutions),
    });

    await this.notifyMentions({
      boardId,
      threadId,
      commentId: comment.id,
      authorId: user.id,
      resolutions,
      bodyPreview: comment.body.slice(0, MENTION_BODY_PREVIEW_MAX),
    });
    this.realtimeService.broadcastCommentCreated(boardId, {
      boardId,
      threadId,
      commentId: comment.id,
      userId: user.id,
    });
    return toComment(comment);
  }

  async setResolved(
    user: AuthenticatedUser,
    boardId: string,
    threadId: string,
    dto: ResolveThreadDto,
  ): Promise<CommentThreadResponseDto> {
    const thread = await this.commentThreadRepository.findById(threadId);
    if (thread === null || thread.boardId !== boardId) {
      throw commentThreadNotFound();
    }

    if (dto.resolved) {
      await this.commentThreadRepository.setResolved(threadId, user.id);
    } else {
      await this.commentThreadRepository.clearResolved(threadId);
    }

    this.realtimeService.broadcastCommentResolved(boardId, {
      boardId,
      threadId,
      userId: user.id,
      resolved: dto.resolved,
      resolvedAt: dto.resolved ? new Date().toISOString() : null,
    });

    const loaded =
      await this.commentThreadRepository.findByIdWithComments(threadId);
    if (loaded === null) {
      throw commentThreadNotFound();
    }
    return toCommentThread(loaded);
  }

  private async resolveMentionsForBoard(
    boardId: string,
    body: string,
    authorId: string,
  ): Promise<MentionResolution[]> {
    const tokens = extractMentionTokens(body);
    if (tokens.length === 0) {
      return [];
    }
    const members = await this.memberRepository.findByBoard(boardId);
    return resolveMentions(tokens, members, authorId);
  }

  private async notifyMentions(args: {
    boardId: string;
    threadId: string;
    commentId: string;
    authorId: string;
    resolutions: MentionResolution[];
    bodyPreview: string;
  }): Promise<void> {
    if (args.resolutions.length === 0) {
      return;
    }
    const actorUser = await this.userRepository.findById(args.authorId);
    if (actorUser === null) {
      return;
    }
    const actorName = actorUser.name ?? actorUser.email;
    const frontendUrl =
      this.configService.get<string>('app.frontendUrl') ??
      'http://localhost:3001';

    await Promise.all(
      args.resolutions.map(async (resolution) => {
        const payload = {
          boardId: args.boardId,
          threadId: args.threadId,
          commentId: args.commentId,
          actorUserId: actorUser.id,
          actorName,
          bodyPreview: args.bodyPreview,
        };
        await this.notificationsService.createInApp({
          userId: resolution.userId,
          type: 'MENTION',
          payload,
        });
        await this.notificationsService.enqueueMentionEmail({
          to: resolution.email,
          recipientName: resolution.name,
          actorName,
          boardId: args.boardId,
          threadId: args.threadId,
          commentId: args.commentId,
          bodyPreview: args.bodyPreview,
          frontendUrl,
        });
      }),
    );
  }
}

function extractMentionTokens(body: string): string[] {
  const tokens: string[] = [];
  const regex = new RegExp(COMMENT_MENTION_TOKEN_PATTERN.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(body)) !== null) {
    tokens.push(match[1]);
  }
  return tokens;
}

function resolveMentions(
  tokens: string[],
  members: {
    userId: string;
    user: { id: string; email: string; name: string | null };
  }[],
  authorId: string,
): MentionResolution[] {
  const seen = new Set<string>();
  const result: MentionResolution[] = [];
  for (const token of tokens) {
    if (result.length >= COMMENT_MENTION_MAX) {
      break;
    }
    const lower = token.toLowerCase();
    const member = members.find((candidate) => {
      if (candidate.userId === authorId) {
        return false;
      }
      const name = candidate.user.name?.toLowerCase();
      const email = candidate.user.email.toLowerCase();
      const local = email.split('@')[0];
      return lower === name || lower === email || lower === local;
    });
    if (member === undefined || seen.has(member.userId)) {
      continue;
    }
    seen.add(member.userId);
    result.push({
      userId: member.userId,
      username: member.user.name ?? member.user.email,
      email: member.user.email,
      name: member.user.name,
    });
  }
  return result;
}

function toMentionRecords(
  resolutions: MentionResolution[],
): CommentMentionRecord[] {
  return resolutions.map((resolution) => ({
    userId: resolution.userId,
    username: resolution.username,
  }));
}
