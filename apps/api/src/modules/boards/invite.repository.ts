import { Injectable } from '@nestjs/common';
import type {
  BoardMemberRole,
  PendingInvite,
} from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InviteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByBoardAndEmail(
    boardId: string,
    email: string,
  ): Promise<PendingInvite | null> {
    return this.prisma.pendingInvite.findUnique({
      where: { boardId_email: { boardId, email } },
    });
  }

  async findByBoard(boardId: string): Promise<PendingInvite[]> {
    return this.prisma.pendingInvite.findMany({
      where: { boardId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: {
    boardId: string;
    email: string;
    role: BoardMemberRole;
    invitedById: string;
    expiresAt?: Date;
  }): Promise<PendingInvite> {
    return this.prisma.pendingInvite.create({
      data: {
        boardId: data.boardId,
        email: data.email,
        role: data.role,
        invitedById: data.invitedById,
        expiresAt: data.expiresAt,
      },
    });
  }

  async revoke(boardId: string, email: string): Promise<void> {
    await this.prisma.pendingInvite.deleteMany({
      where: { boardId, email },
    });
  }
}
