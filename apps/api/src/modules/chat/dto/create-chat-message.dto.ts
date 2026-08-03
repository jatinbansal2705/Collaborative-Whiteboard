import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  CHAT_ATTACHMENT_URL_MAX_LENGTH,
  CHAT_MESSAGE_BODY_MAX_LENGTH,
} from '../chat.constants';

export class CreateChatMessageDto {
  @ApiPropertyOptional({ example: 'First iteration looks great' })
  @ValidateIf((dto: CreateChatMessageDto) => dto.attachmentUrl === undefined)
  @IsString()
  @MaxLength(CHAT_MESSAGE_BODY_MAX_LENGTH)
  body?: string;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/.../chat/attachment.png',
  })
  @ValidateIf((dto: CreateChatMessageDto) => dto.body === undefined)
  @IsUrl({ require_tld: false })
  @MaxLength(CHAT_ATTACHMENT_URL_MAX_LENGTH)
  attachmentUrl?: string;

  @ApiPropertyOptional({
    description: 'Pre-signed attachment key returned by the upload API',
    example: 'chat/abc-123.png',
  })
  @IsOptional()
  @IsString()
  @MaxLength(CHAT_ATTACHMENT_URL_MAX_LENGTH)
  attachmentKey?: string;
}
