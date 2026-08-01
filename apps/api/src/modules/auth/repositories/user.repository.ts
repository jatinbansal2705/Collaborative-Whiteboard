import { Injectable } from '@nestjs/common';
import type {
  AuthProvider,
  Prisma,
  User,
  UserRole,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export interface UserRepositoryCreateInput {
  email: string;
  passwordHash: string | null;
  name?: string;
  avatarUrl?: string;
  provider?: AuthProvider;
  role?: UserRole;
  googleId?: string;
  emailVerifiedAt?: Date;
}

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { googleId, deletedAt: null },
    });
  }

  async findByEmailWithSessions(
    email: string,
  ): Promise<(User & { sessions: { id: string }[] }) | null> {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: { sessions: { select: { id: true } } },
    });
  }

  async findByEmailWithDeleted(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { email },
    });
  }

  async create(data: UserRepositoryCreateInput): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        name: data.name,
        avatarUrl: data.avatarUrl,
        provider: data.provider,
        role: data.role,
        googleId: data.googleId,
        emailVerifiedAt: data.emailVerifiedAt,
      },
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
