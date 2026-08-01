import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { BoardMemberRole } from '../../../generated/prisma/client';

export class UpdateMemberRoleDto {
  @ApiProperty({
    enum: BoardMemberRole,
    description:
      'Target role. Setting OWNER transfers ownership: the current owner is demoted to EDITOR.',
  })
  @IsEnum(BoardMemberRole)
  role!: BoardMemberRole;
}
