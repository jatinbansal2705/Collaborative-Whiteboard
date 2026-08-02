import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Board, Prisma } from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { BOARD_ERROR_CODES } from './board.errors';
import { BoardsService } from './boards.service';

const makeUser = (
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser => ({
  id: 'user-1',
  email: 'alice@example.com',
  role: 'USER',
  sessionId: 'session-1',
  ...overrides,
});

const makeBoard = (overrides: Partial<Board> = {}): Board => ({
  id: 'board-1',
  title: 'Q3 Roadmap',
  data: {},
  thumbnailUrl: null,
  isTemplate: false,
  isArchived: false,
  status: 'ACTIVE',
  memberCount: 1,
  createdById: 'user-1',
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  deletedAt: null,
  ...overrides,
});

const makeMembership = (
  role: string,
  overrides: Record<string, unknown> = {},
) => ({
  id: 'member-1',
  boardId: 'board-1',
  userId: 'user-1',
  role,
  addedBy: null,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  ...overrides,
});

describe('BoardsService', () => {
  let service: BoardsService;

  const boardRepository = {
    createWithOwner: jest.fn(),
    findById: jest.fn(),
    findByIdWithDetails: jest.fn(),
    findTemplateById: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    listForUser: jest.fn(),
    listTemplates: jest.fn(),
    incrementMemberCount: jest.fn(),
    decrementMemberCount: jest.fn(),
  };
  const memberRepository = {
    findMembership: jest.fn(),
    findByBoard: jest.fn(),
    create: jest.fn(),
    updateRole: jest.fn(),
    remove: jest.fn(),
  };
  const favouriteRepository = {
    find: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
  };
  const inviteRepository = {
    findByBoardAndEmail: jest.fn(),
    findByBoard: jest.fn(),
    create: jest.fn(),
  };
  const userRepository = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
  };
  const realtimeService = {
    kick: jest.fn(),
    closeBoard: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BoardsService(
      boardRepository as never,
      memberRepository as never,
      favouriteRepository as never,
      inviteRepository as never,
      userRepository as never,
      realtimeService as never,
    );
  });

  describe('list', () => {
    it('applies default list parameters', async () => {
      boardRepository.listForUser.mockResolvedValue({
        items: [],
        pageInfo: {},
      });
      const query = {};

      await service.list(makeUser(), query);

      expect(boardRepository.listForUser).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          tab: 'recent',
          sortBy: 'updatedAt',
          order: 'desc',
          archived: false,
          cursor: null,
        }),
      );
    });

    it('rejects an invalid cursor', async () => {
      await expect(
        service.list(makeUser(), { cursor: '%%%invalid%%%' }),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: BOARD_ERROR_CODES.INVALID_CURSOR },
      });
    });
  });

  describe('create', () => {
    it('creates a board with the given title', async () => {
      const board = makeBoard();
      boardRepository.createWithOwner.mockResolvedValue(board);

      await service.create(makeUser(), { title: 'New Board' });

      expect(boardRepository.createWithOwner).toHaveBeenCalledWith({
        title: 'New Board',
        data: {},
        isTemplate: false,
        createdById: 'user-1',
      });
    });

    it('deep-copies a template and defaults the title when omitted', async () => {
      const template = makeBoard({
        id: 'template-1',
        title: 'Retro',
        data: { elements: [{ id: 'el-1' }] } as Prisma.JsonValue,
        isTemplate: true,
      });
      boardRepository.findTemplateById.mockResolvedValue(template);
      boardRepository.createWithOwner.mockResolvedValue(makeBoard());

      await service.create(makeUser(), { templateId: 'template-1' });

      expect(boardRepository.createWithOwner).toHaveBeenCalledWith({
        title: 'Retro (copy)',
        data: { elements: [{ id: 'el-1' }] },
        isTemplate: false,
        createdById: 'user-1',
      });
    });

    it('rejects an unknown template', async () => {
      boardRepository.findTemplateById.mockResolvedValue(null);

      await expect(
        service.create(makeUser(), { templateId: 'template-1' }),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: BOARD_ERROR_CODES.INVALID_BOARD_TEMPLATE },
      });
    });
  });

  describe('getDetail', () => {
    it('returns board detail with favourite state and role', async () => {
      const board = makeBoard();
      boardRepository.findByIdWithDetails.mockResolvedValue(board);
      memberRepository.findMembership.mockResolvedValue(
        makeMembership('EDITOR'),
      );
      favouriteRepository.find.mockResolvedValue({ id: 'fav-1' });

      const result = await service.getDetail(makeUser(), 'board-1');

      expect(result).toEqual(
        expect.objectContaining({
          id: 'board-1',
          myRole: 'EDITOR',
          isFavourite: true,
        }),
      );
    });

    it('rejects when the board or membership is missing', async () => {
      boardRepository.findByIdWithDetails.mockResolvedValue(null);
      memberRepository.findMembership.mockResolvedValue(
        makeMembership('EDITOR'),
      );

      await expect(service.getDetail(makeUser(), 'board-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('rejects when the board is not found', async () => {
      boardRepository.findById.mockResolvedValue(null);

      await expect(
        service.update(makeUser(), 'board-1', { title: 'Renamed' }),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: BOARD_ERROR_CODES.BOARD_NOT_FOUND },
      });
    });

    it('updates only the provided fields', async () => {
      boardRepository.findById.mockResolvedValue(makeBoard());
      boardRepository.update.mockResolvedValue(makeBoard({ title: 'Renamed' }));
      memberRepository.findMembership.mockResolvedValue(
        makeMembership('OWNER'),
      );
      favouriteRepository.find.mockResolvedValue(null);

      await service.update(makeUser(), 'board-1', { title: 'Renamed' });

      expect(boardRepository.update).toHaveBeenCalledWith('board-1', {
        title: 'Renamed',
      });
    });
  });

  describe('remove', () => {
    it('soft-deletes the board', async () => {
      boardRepository.findById.mockResolvedValue(makeBoard());
      boardRepository.softDelete.mockResolvedValue(
        makeBoard({ deletedAt: new Date() }),
      );

      const result = await service.remove(makeUser(), 'board-1');

      expect(boardRepository.softDelete).toHaveBeenCalledWith('board-1');
      expect(result).toEqual({ deleted: true, id: 'board-1' });
    });
  });

  describe('duplicate', () => {
    it('appends the copy suffix', async () => {
      boardRepository.findById.mockResolvedValue(makeBoard());
      boardRepository.createWithOwner.mockResolvedValue(makeBoard());

      await service.duplicate(makeUser(), 'board-1');

      expect(boardRepository.createWithOwner).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Q3 Roadmap (copy)' }),
      );
    });

    it('truncates over-long titles to 255 chars', async () => {
      const longTitle = 'x'.repeat(260);
      boardRepository.findById.mockResolvedValue(
        makeBoard({ title: longTitle }),
      );

      let capturedTitle = '';
      boardRepository.createWithOwner.mockImplementation(
        (input: { title: string }) => {
          capturedTitle = input.title;
          return Promise.resolve(makeBoard());
        },
      );

      await service.duplicate(makeUser(), 'board-1');

      expect(capturedTitle).toHaveLength(255);
      expect(capturedTitle.endsWith(' (copy)')).toBe(true);
    });
  });

  describe('archive / restore', () => {
    it('rejects archiving an already archived board', async () => {
      boardRepository.findById.mockResolvedValue(
        makeBoard({ isArchived: true }),
      );

      await expect(service.archive(makeUser(), 'board-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('archives an active board', async () => {
      boardRepository.findById.mockResolvedValue(makeBoard());
      boardRepository.update.mockResolvedValue(makeBoard({ isArchived: true }));
      memberRepository.findMembership.mockResolvedValue(
        makeMembership('OWNER'),
      );
      favouriteRepository.find.mockResolvedValue(null);

      await service.archive(makeUser(), 'board-1');

      expect(boardRepository.update).toHaveBeenCalledWith('board-1', {
        isArchived: true,
      });
    });

    it('rejects restoring a board that is not archived', async () => {
      boardRepository.findById.mockResolvedValue(makeBoard());

      await expect(service.restore(makeUser(), 'board-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('setFavourite', () => {
    it('favourites a board when it is not favourited', async () => {
      favouriteRepository.find.mockResolvedValue(null);

      const result = await service.setFavourite(makeUser(), 'board-1', true);

      expect(favouriteRepository.create).toHaveBeenCalledWith(
        'board-1',
        'user-1',
      );
      expect(result).toEqual({ boardId: 'board-1', isFavourite: true });
    });

    it('rejects favouriting an already favourited board', async () => {
      favouriteRepository.find.mockResolvedValue({ id: 'fav-1' });

      await expect(
        service.setFavourite(makeUser(), 'board-1', true),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: BOARD_ERROR_CODES.BOARD_ALREADY_FAVOURITED },
      });
    });

    it('removes a favourite when explicitly unfavouriting', async () => {
      favouriteRepository.find.mockResolvedValue({ id: 'fav-1' });

      const result = await service.setFavourite(makeUser(), 'board-1', false);

      expect(favouriteRepository.remove).toHaveBeenCalledWith(
        'board-1',
        'user-1',
      );
      expect(result).toEqual({ boardId: 'board-1', isFavourite: false });
    });

    it('toggles off when no explicit state is given', async () => {
      favouriteRepository.find.mockResolvedValue({ id: 'fav-1' });

      const result = await service.setFavourite(makeUser(), 'board-1');

      expect(favouriteRepository.remove).toHaveBeenCalledWith(
        'board-1',
        'user-1',
      );
      expect(result.isFavourite).toBe(false);
    });

    it('toggles on when no explicit state is given and not favourited', async () => {
      favouriteRepository.find.mockResolvedValue(null);

      const result = await service.setFavourite(makeUser(), 'board-1');

      expect(favouriteRepository.create).toHaveBeenCalledWith(
        'board-1',
        'user-1',
      );
      expect(result.isFavourite).toBe(true);
    });
  });

  describe('addMember', () => {
    it('adds a registered user by userId', async () => {
      boardRepository.findById.mockResolvedValue(makeBoard());
      userRepository.findById.mockResolvedValue({
        id: 'user-2',
        email: 'bob@example.com',
        name: 'Bob',
        avatarUrl: null,
      });
      memberRepository.findMembership.mockResolvedValue(null);
      memberRepository.create.mockResolvedValue(
        makeMembership('VIEWER', { userId: 'user-2', id: 'member-2' }),
      );

      const result = await service.addMember(makeUser(), 'board-1', {
        userId: 'user-2',
      });

      expect(result).toEqual(expect.objectContaining({ kind: 'member' }));
      if (result.kind === 'member') {
        expect(result.member).toEqual(
          expect.objectContaining({ userId: 'user-2', role: 'VIEWER' }),
        );
      }
      expect(boardRepository.incrementMemberCount).toHaveBeenCalledWith(
        'board-1',
      );
    });

    it('rejects an unknown userId', async () => {
      boardRepository.findById.mockResolvedValue(makeBoard());
      userRepository.findById.mockResolvedValue(null);

      await expect(
        service.addMember(makeUser(), 'board-1', { userId: 'nope' }),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: BOARD_ERROR_CODES.USER_NOT_FOUND },
      });
    });

    it('creates a pending invite for an unregistered email', async () => {
      boardRepository.findById.mockResolvedValue(makeBoard());
      userRepository.findByEmail.mockResolvedValue(null);
      inviteRepository.findByBoardAndEmail.mockResolvedValue(null);
      inviteRepository.create.mockResolvedValue({
        id: 'invite-1',
        boardId: 'board-1',
        email: 'carol@example.com',
        role: 'VIEWER',
        invitedById: 'user-1',
        token: null,
        expiresAt: new Date('2026-08-08T00:00:00.000Z'),
        acceptedAt: null,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        updatedAt: new Date('2026-07-01T00:00:00.000Z'),
      });

      const result = await service.addMember(makeUser(), 'board-1', {
        email: 'carol@example.com',
      });

      expect(result).toEqual(
        expect.objectContaining({ kind: 'pendingInvite' }),
      );
      if (result.kind === 'pendingInvite') {
        expect(result.invite).toEqual(
          expect.objectContaining({ email: 'carol@example.com' }),
        );
      }
    });

    it('rejects granting OWNER to a non-owner caller', async () => {
      boardRepository.findById.mockResolvedValue(makeBoard());
      memberRepository.findMembership.mockResolvedValue(
        makeMembership('EDITOR'),
      );
      userRepository.findById.mockResolvedValue({ id: 'user-2' });

      await expect(
        service.addMember(makeUser(), 'board-1', {
          userId: 'user-2',
          role: 'OWNER',
        }),
      ).rejects.toMatchObject({
        status: 403,
        response: { code: BOARD_ERROR_CODES.BOARD_ACCESS_DENIED },
      });
    });
  });

  describe('updateMemberRole', () => {
    it('rejects changing the role of the current owner', async () => {
      boardRepository.findById.mockResolvedValue(makeBoard());
      memberRepository.findMembership.mockResolvedValue(
        makeMembership('OWNER'),
      );

      await expect(
        service.updateMemberRole(makeUser(), 'board-1', 'user-2', 'EDITOR'),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: BOARD_ERROR_CODES.INVALID_ROLE_TRANSFER },
      });
    });

    it('transfers ownership to the target member', async () => {
      boardRepository.findById.mockResolvedValue(makeBoard());
      memberRepository.findMembership.mockImplementation(
        (boardId: string, userId: string) => {
          if (userId === 'user-2') {
            return makeMembership('EDITOR', {
              userId: 'user-2',
              id: 'member-2',
            });
          }
          return makeMembership('OWNER');
        },
      );
      boardRepository.update.mockResolvedValue(makeBoard());
      memberRepository.updateRole.mockResolvedValue(makeMembership('OWNER'));
      userRepository.findById.mockResolvedValue({
        id: 'user-2',
        email: 'bob@example.com',
        name: 'Bob',
        avatarUrl: null,
      });

      const result = await service.updateMemberRole(
        makeUser(),
        'board-1',
        'user-2',
        'OWNER',
      );

      expect(boardRepository.update).toHaveBeenCalledWith('board-1', {
        createdBy: { connect: { id: 'user-2' } },
      });
      expect(memberRepository.updateRole).toHaveBeenCalledWith(
        'board-1',
        'user-2',
        'OWNER',
      );
      expect(memberRepository.updateRole).toHaveBeenCalledWith(
        'board-1',
        'user-1',
        'EDITOR',
      );
      expect(result).toEqual(expect.objectContaining({ userId: 'user-2' }));
    });
  });

  describe('removeMember', () => {
    it('rejects the owner leaving the board', async () => {
      boardRepository.findById.mockResolvedValue(makeBoard());
      memberRepository.findMembership.mockResolvedValue(
        makeMembership('OWNER'),
      );

      await expect(
        service.removeMember(makeUser(), 'board-1', 'user-1'),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: BOARD_ERROR_CODES.OWNER_CANNOT_LEAVE },
      });
    });

    it('allows a non-owner to leave', async () => {
      boardRepository.findById.mockResolvedValue(makeBoard());
      memberRepository.findMembership.mockResolvedValue(
        makeMembership('EDITOR'),
      );
      memberRepository.remove.mockResolvedValue(true);

      await service.removeMember(makeUser(), 'board-1', 'user-1');

      expect(memberRepository.remove).toHaveBeenCalledWith('board-1', 'user-1');
      expect(boardRepository.decrementMemberCount).toHaveBeenCalledWith(
        'board-1',
      );
    });

    it('rejects removing the board owner', async () => {
      boardRepository.findById.mockResolvedValue(makeBoard());
      memberRepository.findMembership.mockResolvedValue(
        makeMembership('OWNER'),
      );

      await expect(
        service.removeMember(makeUser(), 'board-1', 'user-2'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('listMembers', () => {
    it('combines members and pending invites', async () => {
      boardRepository.findById.mockResolvedValue(makeBoard());
      memberRepository.findByBoard.mockResolvedValue([
        {
          ...makeMembership('EDITOR'),
          user: {
            id: 'user-1',
            email: 'alice@example.com',
            name: 'Alice',
            avatarUrl: null,
          },
        },
      ]);
      inviteRepository.findByBoard.mockResolvedValue([
        {
          id: 'invite-1',
          boardId: 'board-1',
          email: 'carol@example.com',
          role: 'VIEWER',
          invitedById: 'user-1',
          token: null,
          expiresAt: null,
          acceptedAt: null,
          createdAt: new Date('2026-07-01T00:00:00.000Z'),
          updatedAt: new Date('2026-07-01T00:00:00.000Z'),
        },
      ]);

      const result = await service.listMembers(makeUser(), 'board-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({ userId: 'user-1', role: 'EDITOR' }),
      );
      expect(result[1]).toEqual(
        expect.objectContaining({ email: 'carol@example.com' }),
      );
    });
  });
});
