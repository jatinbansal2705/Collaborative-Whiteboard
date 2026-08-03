import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { COMMENT_BODY_MAX_LENGTH } from '../comments.constants';

export class CreateCommentDto {
  @ApiProperty({ example: 'Agreed, let us ship it @ada' })
  @IsString()
  @MinLength(1)
  @MaxLength(COMMENT_BODY_MAX_LENGTH)
  body!: string;
}
