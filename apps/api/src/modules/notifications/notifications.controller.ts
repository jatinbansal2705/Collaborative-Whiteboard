import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import {
  type NotificationListResponseDto,
  type NotificationResponseDto,
} from './dto/notification.response.dto';
import type { ListNotificationsQueryDto } from './dto/list-notifications.query.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
@ApiBearerAuth('access-token')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List in-app notifications for the caller' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<NotificationListResponseDto> {
    return this.notificationsService.list(user, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get the caller unread notification count' })
  unreadCount(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ unreadCount: number }> {
    return this.notificationsService.getUnreadCount(user);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all caller notifications as read' })
  markAllRead(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ updated: number }> {
    return this.notificationsService.markAllRead(user);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read' })
  async markAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<NotificationResponseDto> {
    return this.notificationsService.markAsRead(user, id);
  }
}
