import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { BoardAccess } from '../boards/board-access.decorator';
import { BoardAccessGuard } from '../boards/guards/board-access.guard';
import { ChatService } from './chat.service';
import {
  toChatReadReceipt,
  type ChatMessageListResponseDto,
  type ChatMessageResponseDto,
  type ChatReadReceiptResponseDto,
} from './dto/chat-message.response.dto';
import type { CreateChatMessageDto } from './dto/create-chat-message.dto';
import type { ListChatMessagesQueryDto } from './dto/list-chat-messages.query.dto';

@ApiTags('chat')
@Controller('boards/:id/messages')
@UseGuards(BoardAccessGuard)
@ApiBearerAuth('access-token')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  @BoardAccess({ minRole: 'VIEWER' })
  @ApiOperation({
    summary: 'List chat messages (newest first, cursor paginated)',
  })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') boardId: string,
    @Query() query: ListChatMessagesQueryDto,
  ): Promise<ChatMessageListResponseDto> {
    return this.chatService.listMessages(user, boardId, query);
  }

  @Post()
  @BoardAccess({ minRole: 'COMMENTER' })
  @ApiOperation({ summary: 'Post a chat message' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') boardId: string,
    @Body() dto: CreateChatMessageDto,
  ): Promise<ChatMessageResponseDto> {
    return this.chatService.createMessage(user, boardId, dto);
  }

  @Get('read')
  @BoardAccess({ minRole: 'VIEWER' })
  @ApiOperation({ summary: 'Get the caller read receipt for the board chat' })
  async getReadReceipt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') boardId: string,
  ): Promise<ChatReadReceiptResponseDto | null> {
    const receipt = await this.chatService.getReadReceipt(boardId, user.id);
    return receipt === null ? null : toChatReadReceipt(receipt);
  }
}
