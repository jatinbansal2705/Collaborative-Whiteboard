import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { parseWhiteboardDocument } from '@whiteboard/shared';
import type {
  Board,
  BoardMemberRole,
  PendingInvite,
  Prisma,
} from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { UserRepository } from '../auth/repositories/user.repository';
import {
  KICK_REASON_BOARD_DELETED,
  KICK_REASON_LEFT,
  KICK_REASON_REMOVED,
} from '../realtime/realtime.constants';
import { RealtimeService } from '../realtime/realtime.service';
import {
  BOARD_COPY_SUFFIX,
  BOARD_DATA_MAX_ELEMENTS,
  BOARD_TITLE_MAX_LENGTH,
  INVITE_EXPIRES_IN_MS,
} from './board.constants';
import {
  boardAlreadyArchived,
  boardAlreadyFavourited,
  boardAlreadyRestored,
  boardNotFound,
  boardNotFavourited,
  boardAccessDenied,
  invalidBoardData,
  invalidBoardTemplate,
  invalidCursor,
  invalidMemberIdentifier,
  invalidRoleTransfer,
  invalidVersionCursor,
  memberAlreadyExists,
  memberNotFound,
  ownerCannotLeave,
  pendingInviteExists,
  staleBoardRevision,
  userNotFound,
  versionNotFound,
} from './board.errors';
import { BoardRepository } from './board.repository';
import { BoardHistoryRepository } from './board-history.repository';
import {
  decodeCursor,
  type BoardSortBy,
  type BoardSortOrder,
  type DecodedCursor,
} from './cursor-pagination';
import {
  toBoardDetail,
  toBoardSummary,
  toPageInfo,
  type BoardDetailDto,
  type BoardListResponseDto,
  type BoardSummaryDto,
  type FavouriteStatusDto,
} from './dto/board-response.dto';
import {
  toBoardActivity,
  toBoardVersion,
  toHistoryPageInfo,
  type BoardActivityListResponseDto,
  type BoardDataResponseDto,
  type BoardVersionDetailDto,
  type BoardVersionListResponseDto,
  type SaveBoardDataResponseDto,
} from './dto/board-history.response.dto';
import type { AddMemberDto } from './dto/add-member.dto';
import type {
  AddMemberResult,
  BoardRosterItem,
  MemberResponseDto,
  PendingInviteResponseDto,
} from './dto/member-response.dto';
import type { CreateBoardDto } from './dto/create-board.dto';
import type { CreateTemplateDto } from './dto/create-template.dto';
import type { CreateVersionDto } from './dto/update-board-data.dto';
import type { ListActivityQueryDto } from './dto/list-activity.query.dto';
import type { ListBoardsQueryDto } from './dto/list-boards-query.dto';
import type { ListVersionsQueryDto } from './dto/list-versions.query.dto';
import type { UpdateBoardDataDto } from './dto/update-board-data.dto';
import type { UpdateBoardDto } from './dto/update-board.dto';
import { decodeVersionCursor } from './board-history.repository';
import { decodeDateCursor } from '../../common/utils/date-cursor';
import { FavouriteRepository } from './favourite.repository';
import { InviteRepository } from './invite.repository';
import {
  MemberRepository,
  type BoardMemberWithUser,
} from './member.repository';

@Injectable()
export class BoardsService {
  constructor(
    private readonly boardRepository: BoardRepository,
    private readonly memberRepository: MemberRepository,
    private readonly favouriteRepository: FavouriteRepository,
    private readonly inviteRepository: InviteRepository,
    private readonly historyRepository: BoardHistoryRepository,
    private readonly userRepository: UserRepository,
    @Inject(forwardRef(() => RealtimeService))
    private readonly realtimeService: RealtimeService,
  ) {}

  async list(
    user: AuthenticatedUser,
    query: ListBoardsQueryDto,
  ): Promise<BoardListResponseDto> {
    const sortBy = (query.sortBy ?? 'updatedAt') as BoardSortBy;
    const order = (query.order ?? 'desc') as BoardSortOrder;

    const cursor = this.resolveCursor(query.cursor, sortBy);

    const page = await this.boardRepository.listForUser({
      userId: user.id,
      tab: query.tab ?? 'recent',
      search: query.search,
      sortBy,
      order,
      archived: query.archived ?? false,
      template: query.template,
      ownedByMe: query.ownedByMe,
      cursor,
      limit: query.limit ?? 20,
    });

    return {
      data: page.items.map((row) => toBoardSummary(row)),
      meta: toPageInfo(page.pageInfo),
    };
  }

  async getDetail(
    user: AuthenticatedUser,
    boardId: string,
  ): Promise<BoardDetailDto> {
    const [board, membership, favourite] = await Promise.all([
      this.boardRepository.findByIdWithDetails(boardId),
      this.memberRepository.findMembership(boardId, user.id),
      this.favouriteRepository.find(boardId, user.id),
    ]);

    if (board === null || membership === null) {
      throw boardNotFound();
    }

    return toBoardDetail(board, membership.role, favourite !== null);
  }

  async getData(
    user: AuthenticatedUser,
    boardId: string,
  ): Promise<BoardDataResponseDto> {
    const board = await this.requireBoard(boardId);
    return { revision: board.revision, data: board.data };
  }

  async saveData(
    user: AuthenticatedUser,
    boardId: string,
    dto: UpdateBoardDataDto,
  ): Promise<SaveBoardDataResponseDto> {
    await this.requireBoard(boardId);

    const document = parseWhiteboardDocument(dto.data);
    if (
      document === null ||
      document.elements.length > BOARD_DATA_MAX_ELEMENTS
    ) {
      throw invalidBoardData();
    }

    const result = await this.historyRepository.saveData({
      boardId,
      baseRevision: dto.baseRevision ?? null,
      data: dto.data as Prisma.InputJsonValue,
      schemaVersion: document.schemaVersion,
      elementCount: document.elements.length,
      actorId: user.id,
      kind: 'AUTO',
      activityType: 'EDIT',
    });

    switch (result.status) {
      case 'missing':
        throw boardNotFound();
      case 'conflict':
        throw staleBoardRevision(result.currentRevision, result.data);
      default:
        this.realtimeService.broadcastRevision(boardId, result.revision);
        return { revision: result.revision };
    }
  }

  async createVersion(
    user: AuthenticatedUser,
    boardId: string,
    dto: CreateVersionDto,
  ): Promise<SaveBoardDataResponseDto> {
    const board = await this.requireBoard(boardId);

    const result = await this.historyRepository.saveData({
      boardId,
      baseRevision: board.revision,
      data: board.data as Prisma.InputJsonValue,
      schemaVersion: 1,
      elementCount: countDocumentElements(board.data),
      actorId: user.id,
      kind: 'MANUAL',
      note: dto.note,
      activityType: 'MANUAL_VERSION',
      forceCreate: true,
    });

    switch (result.status) {
      case 'missing':
        throw boardNotFound();
      case 'conflict':
        throw staleBoardRevision(result.currentRevision, result.data);
      default:
        this.realtimeService.broadcastRevision(boardId, result.revision);
        return { revision: result.revision };
    }
  }

  async listVersions(
    user: AuthenticatedUser,
    boardId: string,
    query: ListVersionsQueryDto,
  ): Promise<BoardVersionListResponseDto> {
    await this.requireBoard(boardId);

    const cursor = decodeVersionCursor(query.cursor);
    if (query.cursor !== undefined && cursor === null) {
      throw invalidVersionCursor();
    }

    const page = await this.historyRepository.listVersions(
      boardId,
      cursor,
      query.limit ?? 20,
    );
    return {
      data: page.items.map((row) => toBoardVersion(row)),
      meta: toHistoryPageInfo(page.pageInfo),
    };
  }

  async getVersion(
    user: AuthenticatedUser,
    boardId: string,
    versionNo: number,
  ): Promise<BoardVersionDetailDto> {
    await this.requireBoard(boardId);
    const version = await this.historyRepository.findVersion(
      boardId,
      versionNo,
    );
    if (version === null) {
      throw versionNotFound();
    }
    return toBoardVersion(version, { includeData: true });
  }

  async restoreVersion(
    user: AuthenticatedUser,
    boardId: string,
    versionNo: number,
  ): Promise<BoardVersionDetailDto> {
    await this.requireBoard(boardId);
    const result = await this.historyRepository.restoreVersion(
      boardId,
      versionNo,
      user.id,
    );
    if (result === null) {
      throw versionNotFound();
    }

    this.realtimeService.broadcastRevision(boardId, result.board.revision);
    this.realtimeService.broadcastBoardRestored(boardId, {
      boardId,
      versionNo,
      revision: result.board.revision,
      data: toPlainData(result.board.data),
    });

    return toBoardVersion(
      {
        ...result.targetVersion,
        createdBy: { id: user.id, name: null, avatarUrl: null },
      },
      { includeData: true },
    );
  }

  async listActivity(
    user: AuthenticatedUser,
    boardId: string,
    query: ListActivityQueryDto,
  ): Promise<BoardActivityListResponseDto> {
    await this.requireBoard(boardId);

    const cursor =
      query.before === undefined ? null : decodeDateCursor(query.before);
    if (query.before !== undefined && cursor === null) {
      throw invalidCursor();
    }

    const page = await this.historyRepository.listActivity(
      boardId,
      cursor,
      query.limit ?? 30,
    );
    return {
      data: page.items.map(toBoardActivity),
      meta: toHistoryPageInfo(page.pageInfo),
    };
  }

  async create(
    user: AuthenticatedUser,
    dto: CreateBoardDto,
  ): Promise<BoardSummaryDto> {
    let data: Prisma.InputJsonValue =
      dto.data === undefined ? {} : (dto.data as Prisma.InputJsonValue);
    let title = dto.title;

    if (dto.templateId !== undefined) {
      const template = await this.boardRepository.findTemplateById(
        dto.templateId,
      );
      if (template === null) {
        throw invalidBoardTemplate();
      }
      data = template.data as Prisma.InputJsonValue;
      title = title ?? `${template.title}${BOARD_COPY_SUFFIX}`;
    }

    if (title === undefined || title.length === 0) {
      throw invalidBoardTemplate();
    }

    const board = await this.boardRepository.createWithOwner({
      title,
      data,
      isTemplate: false,
      createdById: user.id,
    });

    await this.historyRepository.recordActivity({
      boardId: board.id,
      type: 'CREATE',
      actorId: user.id,
      details: { title: board.title },
    });

    return toBoardSummary({ board, isFavourite: false, myRole: 'OWNER' });
  }

  async update(
    user: AuthenticatedUser,
    boardId: string,
    dto: UpdateBoardDto,
  ): Promise<BoardSummaryDto> {
    await this.requireBoard(boardId);

    const data: Prisma.BoardUpdateInput = {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.thumbnailUrl !== undefined && { thumbnailUrl: dto.thumbnailUrl }),
      ...(dto.data !== undefined && {
        data: dto.data as Prisma.InputJsonValue,
      }),
      ...(dto.isTemplate !== undefined && { isTemplate: dto.isTemplate }),
    };

    const updated = await this.boardRepository.update(boardId, data);
    return this.summaryWithContext(boardId, updated, user.id);
  }

  async remove(
    user: AuthenticatedUser,
    boardId: string,
  ): Promise<{ deleted: boolean; id: string }> {
    await this.requireBoard(boardId);
    await this.boardRepository.softDelete(boardId);
    await this.realtimeService.closeBoard(boardId, KICK_REASON_BOARD_DELETED);
    await this.historyRepository.recordActivity({
      boardId,
      type: 'DELETE',
      actorId: user.id,
    });
    return { deleted: true, id: boardId };
  }

  async duplicate(
    user: AuthenticatedUser,
    boardId: string,
  ): Promise<BoardSummaryDto> {
    const source = await this.requireBoard(boardId);

    const title =
      source.title.length + BOARD_COPY_SUFFIX.length > BOARD_TITLE_MAX_LENGTH
        ? source.title.slice(
            0,
            BOARD_TITLE_MAX_LENGTH - BOARD_COPY_SUFFIX.length,
          ) + BOARD_COPY_SUFFIX
        : `${source.title}${BOARD_COPY_SUFFIX}`;

    const board = await this.boardRepository.createWithOwner({
      title,
      data: source.data as Prisma.InputJsonValue,
      isTemplate: false,
      createdById: user.id,
    });

    return toBoardSummary({ board, isFavourite: false, myRole: 'OWNER' });
  }

  async archive(
    user: AuthenticatedUser,
    boardId: string,
  ): Promise<BoardSummaryDto> {
    const board = await this.requireBoard(boardId);
    if (board.isArchived) {
      throw boardAlreadyArchived();
    }
    const updated = await this.boardRepository.update(boardId, {
      isArchived: true,
    });
    await this.historyRepository.recordActivity({
      boardId,
      type: 'ARCHIVE',
      actorId: user.id,
    });
    return this.summaryWithContext(boardId, updated, user.id);
  }

  async restore(
    user: AuthenticatedUser,
    boardId: string,
  ): Promise<BoardSummaryDto> {
    const board = await this.requireBoard(boardId);
    if (!board.isArchived) {
      throw boardAlreadyRestored();
    }
    const updated = await this.boardRepository.update(boardId, {
      isArchived: false,
    });
    await this.historyRepository.recordActivity({
      boardId,
      type: 'RESTORE',
      actorId: user.id,
    });
    return this.summaryWithContext(boardId, updated, user.id);
  }

  async setFavourite(
    user: AuthenticatedUser,
    boardId: string,
    favourite?: boolean,
  ): Promise<FavouriteStatusDto> {
    const current = await this.favouriteRepository.find(boardId, user.id);

    const target = favourite ?? current === null;

    if (target && current !== null) {
      throw boardAlreadyFavourited();
    }
    if (!target && current === null) {
      throw boardNotFavourited();
    }

    if (target) {
      await this.favouriteRepository.create(boardId, user.id);
    } else {
      await this.favouriteRepository.remove(boardId, user.id);
    }

    return { boardId, isFavourite: target };
  }

  async listMembers(
    user: AuthenticatedUser,
    boardId: string,
  ): Promise<BoardRosterItem[]> {
    await this.requireBoard(boardId);
    const [members, invites] = await Promise.all([
      this.memberRepository.findByBoard(boardId),
      this.inviteRepository.findByBoard(boardId),
    ]);
    return this.toMemberResponse(members, invites);
  }

  async addMember(
    user: AuthenticatedUser,
    boardId: string,
    dto: AddMemberDto,
  ): Promise<AddMemberResult> {
    await this.requireBoard(boardId);

    const role = dto.role ?? 'VIEWER';
    if (role === 'OWNER') {
      const callerIsOwner = await this.isOwner(boardId, user.id);
      if (user.role !== 'ADMIN' && !callerIsOwner) {
        throw boardAccessDenied();
      }
    }

    if (dto.userId !== undefined) {
      return this.addMemberById(boardId, dto.userId, role, user.id);
    }
    if (dto.email !== undefined) {
      return this.addMemberByEmail(boardId, dto.email, role, user.id);
    }
    throw invalidMemberIdentifier();
  }

  async updateMemberRole(
    user: AuthenticatedUser,
    boardId: string,
    targetUserId: string,
    role: BoardMemberRole,
  ): Promise<MemberResponseDto> {
    await this.requireBoard(boardId);

    const target = await this.memberRepository.findMembership(
      boardId,
      targetUserId,
    );
    if (target === null) {
      throw memberNotFound();
    }

    if (target.role === 'OWNER') {
      throw invalidRoleTransfer();
    }

    if (role === 'OWNER') {
      const callerIsOwner = await this.isOwner(boardId, user.id);
      if (user.role !== 'ADMIN' && !callerIsOwner) {
        throw boardAccessDenied();
      }
      await this.boardRepository.update(boardId, {
        createdBy: { connect: { id: targetUserId } },
      });
      await this.memberRepository.updateRole(boardId, targetUserId, 'OWNER');
      await this.memberRepository.updateRole(boardId, user.id, 'EDITOR');
    } else {
      await this.memberRepository.updateRole(boardId, targetUserId, role);
    }

    return this.memberWithContext(boardId, targetUserId);
  }

  async removeMember(
    user: AuthenticatedUser,
    boardId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.requireBoard(boardId);

    if (targetUserId === user.id) {
      const ownMembership = await this.memberRepository.findMembership(
        boardId,
        user.id,
      );
      if (ownMembership === null) {
        throw memberNotFound();
      }
      if (ownMembership.role === 'OWNER') {
        throw ownerCannotLeave();
      }
      await this.memberRepository.remove(boardId, user.id);
      await this.boardRepository.decrementMemberCount(boardId);
      await this.realtimeService.kick(boardId, user.id, KICK_REASON_LEFT);
      return;
    }

    const target = await this.memberRepository.findMembership(
      boardId,
      targetUserId,
    );
    if (target === null) {
      throw memberNotFound();
    }
    if (target.role === 'OWNER') {
      throw ownerCannotLeave();
    }

    await this.memberRepository.remove(boardId, targetUserId);
    await this.boardRepository.decrementMemberCount(boardId);
    await this.realtimeService.kick(boardId, targetUserId, KICK_REASON_REMOVED);
  }

  async createTemplate(
    user: AuthenticatedUser,
    dto: CreateTemplateDto,
  ): Promise<BoardSummaryDto> {
    const board = await this.boardRepository.createWithOwner({
      title: dto.title,
      data: dto.data as Prisma.InputJsonValue,
      thumbnailUrl: dto.thumbnailUrl,
      isTemplate: true,
      createdById: user.id,
    });

    return toBoardSummary({ board, isFavourite: false, myRole: 'OWNER' });
  }

  async listTemplates(): Promise<BoardSummaryDto[]> {
    const templates = await this.boardRepository.listTemplates();
    return templates.map((board) =>
      toBoardSummary({ board, isFavourite: false, myRole: 'VIEWER' }),
    );
  }

  private async addMemberById(
    boardId: string,
    userId: string,
    role: BoardMemberRole,
    addedBy: string,
  ): Promise<AddMemberResult> {
    const user = await this.userRepository.findById(userId);
    if (user === null) {
      throw userNotFound();
    }

    const existing = await this.memberRepository.findMembership(
      boardId,
      userId,
    );
    if (existing !== null) {
      throw memberAlreadyExists();
    }

    const member = await this.memberRepository.create(
      boardId,
      userId,
      role,
      addedBy,
    );
    await this.boardRepository.incrementMemberCount(boardId);

    return {
      kind: 'member',
      member: this.toMember({ ...member, user }),
    };
  }

  private async addMemberByEmail(
    boardId: string,
    email: string,
    role: BoardMemberRole,
    invitedById: string,
  ): Promise<AddMemberResult> {
    const user = await this.userRepository.findByEmail(email);

    if (user !== null) {
      const existing = await this.memberRepository.findMembership(
        boardId,
        user.id,
      );
      if (existing !== null) {
        throw memberAlreadyExists();
      }
      const member = await this.memberRepository.create(
        boardId,
        user.id,
        role,
        invitedById,
      );
      await this.boardRepository.incrementMemberCount(boardId);
      return {
        kind: 'member',
        member: this.toMember({ ...member, user }),
      };
    }

    const existingInvite = await this.inviteRepository.findByBoardAndEmail(
      boardId,
      email,
    );
    if (existingInvite !== null) {
      throw pendingInviteExists();
    }

    const invite = await this.inviteRepository.create({
      boardId,
      email,
      role,
      invitedById,
      expiresAt: new Date(Date.now() + INVITE_EXPIRES_IN_MS),
    });

    return { kind: 'pendingInvite', invite: this.toInvite(invite) };
  }

  private async summaryWithContext(
    boardId: string,
    board: Board,
    userId: string,
  ): Promise<BoardSummaryDto> {
    const [membership, favourite] = await Promise.all([
      this.memberRepository.findMembership(boardId, userId),
      this.favouriteRepository.find(boardId, userId),
    ]);

    return toBoardSummary({
      board,
      isFavourite: favourite !== null,
      myRole: membership?.role ?? 'VIEWER',
    });
  }

  private async memberWithContext(
    boardId: string,
    userId: string,
  ): Promise<MemberResponseDto> {
    const [membership, user] = await Promise.all([
      this.memberRepository.findMembership(boardId, userId),
      this.userRepository.findById(userId),
    ]);
    if (membership === null || user === null) {
      throw memberNotFound();
    }
    return this.toMember({ ...membership, user });
  }

  private async requireBoard(boardId: string): Promise<Board> {
    const board = await this.boardRepository.findById(boardId);
    if (board === null) {
      throw boardNotFound();
    }
    return board;
  }

  private async isOwner(boardId: string, userId: string): Promise<boolean> {
    const membership = await this.memberRepository.findMembership(
      boardId,
      userId,
    );
    return membership?.role === 'OWNER';
  }

  private resolveCursor(
    cursor: string | undefined,
    sortBy: BoardSortBy,
  ): DecodedCursor | null {
    if (cursor === undefined || cursor === '') {
      return null;
    }
    const decoded = decodeCursor(cursor, sortBy);
    if (decoded === null) {
      throw invalidCursor();
    }
    return decoded;
  }

  private toMemberResponse(
    members: BoardMemberWithUser[],
    invites: PendingInvite[],
  ): BoardRosterItem[] {
    return [
      ...members.map((member) => this.toMember(member)),
      ...invites.map((invite) => this.toInvite(invite)),
    ];
  }

  private toMember(member: BoardMemberWithUser): MemberResponseDto {
    return {
      userId: member.userId,
      email: member.user.email,
      name: member.user.name,
      avatarUrl: member.user.avatarUrl,
      role: member.role,
      addedAt: member.createdAt,
    };
  }

  private toInvite(invite: PendingInvite): PendingInviteResponseDto {
    return {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
    };
  }
}

function countDocumentElements(data: Prisma.JsonValue): number {
  if (
    typeof data === 'object' &&
    data !== null &&
    !Array.isArray(data) &&
    'elements' in data &&
    Array.isArray(data.elements)
  ) {
    return data.elements.length;
  }
  return 0;
}

function toPlainData(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}
