import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { BoardMemberRole } from '../../../generated/prisma/client';

export class AddMemberDto {
  @ApiPropertyOptional({
    example: 'alice@example.com',
    description:
      'Email of the user to add. Creates a pending invite when the user is not registered yet.',
  })
  @ValidateIf((dto: AddMemberDto) => dto.userId === undefined)
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a' })
  @ValidateIf((dto: AddMemberDto) => dto.email === undefined)
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    enum: BoardMemberRole,
    default: BoardMemberRole.VIEWER,
  })
  @IsOptional()
  @IsEnum(BoardMemberRole)
  role?: BoardMemberRole;
}
