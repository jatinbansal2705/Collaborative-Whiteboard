import { Injectable } from '@nestjs/common';
import type {
  BoardMember,
  BoardMemberRole,
} from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface BoardMemberWithUser {
  id: string;
  boardId: string;
  userId: string;
  role: BoardMemberRole;
  addedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  };
}

@Injectable()
export class MemberRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMembership(
    boardId: string,
    userId: string,
  ): Promise<BoardMember | null> {
    return this.prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId } },
    });
  }

  async findByBoard(boardId: string): Promise<BoardMemberWithUser[]> {
    return this.prisma.boardMember.findMany({
      where: { boardId },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
    });
  }

  async findOwner(boardId: string): Promise<BoardMember | null> {
    return this.prisma.boardMember.findFirst({
      where: { boardId, role: 'OWNER' },
    });
  }

  async countByBoard(boardId: string): Promise<number> {
    return this.prisma.boardMember.count({ where: { boardId } });
  }

  async create(
    boardId: string,
    userId: string,
    role: BoardMemberRole,
    addedBy: string,
  ): Promise<BoardMember> {
    return this.prisma.boardMember.create({
      data: { boardId, userId, role, addedBy },
    });
  }

  async updateRole(
    boardId: string,
    userId: string,
    role: BoardMemberRole,
  ): Promise<BoardMember | null> {
    return this.prisma.boardMember.update({
      where: { boardId_userId: { boardId, userId } },
      data: { role },
    });
  }

  async remove(boardId: string, userId: string): Promise<boolean> {
    const result = await this.prisma.boardMember.deleteMany({
      where: { boardId, userId },
    });
    return result.count > 0;
  }
}
