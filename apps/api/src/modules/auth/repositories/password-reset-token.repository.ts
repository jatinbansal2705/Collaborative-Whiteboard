import { Injectable } from '@nestjs/common';
import type { PasswordResetToken } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export interface PasswordResetTokenRepositoryCreateInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

@Injectable()
export class PasswordResetTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: PasswordResetTokenRepositoryCreateInput,
  ): Promise<PasswordResetToken> {
    return this.prisma.passwordResetToken.create({ data });
  }

  async findByHash(tokenHash: string): Promise<PasswordResetToken | null> {
    return this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  }

  async markUsed(id: string): Promise<PasswordResetToken> {
    return this.prisma.passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }
}
