import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, MaxLength, MinLength } from 'class-validator';
import { COMMENT_BODY_MAX_LENGTH } from '../comments.constants';

export class CreateCommentThreadDto {
  @ApiProperty({ example: 120 })
  @IsNumber()
  x!: number;

  @ApiProperty({ example: 340 })
  @IsNumber()
  y!: number;

  @ApiProperty({ example: 'First iteration looks great @ada' })
  @IsString()
  @MinLength(1)
  @MaxLength(COMMENT_BODY_MAX_LENGTH)
  body!: string;
}
