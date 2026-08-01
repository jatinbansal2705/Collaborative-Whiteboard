import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { BoardMemberRole } from '../../../generated/prisma/client';

export class MemberResponseDto {
  @ApiProperty({ example: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a' })
  userId!: string;

  @ApiProperty({ example: 'alice@example.com' })
  email!: string;

  @ApiPropertyOptional({ example: 'Alice' })
  name!: string | null;

  @ApiPropertyOptional({ example: 'https://...' })
  avatarUrl!: string | null;

  @ApiProperty({ example: 'EDITOR' })
  role!: BoardMemberRole;

  @ApiProperty()
  addedAt!: Date;
}

export class PendingInviteResponseDto {
  @ApiProperty({ example: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a' })
  id!: string;

  @ApiProperty({ example: 'bob@example.com' })
  email!: string;

  @ApiProperty({ example: 'VIEWER' })
  role!: BoardMemberRole;

  @ApiProperty({ example: '2026-08-08T00:00:00.000Z' })
  expiresAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;
}

export type AddMemberResult =
  | {
      kind: 'member';
      member: MemberResponseDto;
    }
  | {
      kind: 'pendingInvite';
      invite: PendingInviteResponseDto;
    };

export type BoardRosterItem = MemberResponseDto | PendingInviteResponseDto;
