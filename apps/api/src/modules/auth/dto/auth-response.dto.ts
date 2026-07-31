import { ApiProperty } from '@nestjs/swagger';
import type { User } from '../../../generated/prisma/client';

export class UserResponse {
  @ApiProperty({ example: '6f1e4b3a-...' })
  id!: string;

  @ApiProperty({ example: 'alice@example.com' })
  email!: string;

  @ApiProperty({ example: 'Alice', required: false })
  name?: string;

  @ApiProperty({ example: 'USER' })
  role!: string;

  @ApiProperty({ required: false })
  emailVerifiedAt?: Date;

  @ApiProperty({ required: false })
  avatarUrl?: string;

  @ApiProperty()
  createdAt!: Date;
}

export class AuthResult {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ example: 900000 })
  expiresIn!: number;

  @ApiProperty({ type: UserResponse })
  user!: UserResponse;
}

export class RefreshResult {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ example: 900000 })
  expiresIn!: number;
}

export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? undefined,
    role: user.role,
    emailVerifiedAt: user.emailVerifiedAt ?? undefined,
    avatarUrl: user.avatarUrl ?? undefined,
    createdAt: user.createdAt,
  };
}
