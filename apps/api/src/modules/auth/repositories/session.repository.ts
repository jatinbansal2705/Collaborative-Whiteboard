import { Injectable } from '@nestjs/common';
import type { Prisma, Session } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export interface SessionRepositoryCreateInput {
  id?: string;
  userId: string;
  refreshTokenHash: string;
  familyId: string;
  device?: string;
  ip?: string;
  expiresAt: Date;
}

@Injectable()
export class SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: SessionRepositoryCreateInput): Promise<Session> {
    const { id, ...rest } = data;
    return this.prisma.session.create({
      data: id === undefined ? rest : { ...rest, id },
    });
  }

  async findById(id: string): Promise<Session | null> {
    return this.prisma.session.findUnique({ where: { id } });
  }

  async findByRefreshTokenHash(
    refreshTokenHash: string,
  ): Promise<Session | null> {
    return this.prisma.session.findFirst({
      where: { refreshTokenHash },
    });
  }

  async findByFamilyId(familyId: string): Promise<Session[]> {
    return this.prisma.session.findMany({
      where: { familyId },
    });
  }

  async update(id: string, data: Prisma.SessionUpdateInput): Promise<Session> {
    return this.prisma.session.update({ where: { id }, data });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async deleteExpired(): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }
}
