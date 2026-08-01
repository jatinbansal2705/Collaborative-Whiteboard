import { Injectable } from '@nestjs/common';
import type { BoardFavourite } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FavouriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async find(boardId: string, userId: string): Promise<BoardFavourite | null> {
    return this.prisma.boardFavourite.findUnique({
      where: { boardId_userId: { boardId, userId } },
    });
  }

  async create(boardId: string, userId: string): Promise<BoardFavourite> {
    return this.prisma.boardFavourite.create({ data: { boardId, userId } });
  }

  async remove(boardId: string, userId: string): Promise<void> {
    await this.prisma.boardFavourite.deleteMany({
      where: { boardId, userId },
    });
  }
}
