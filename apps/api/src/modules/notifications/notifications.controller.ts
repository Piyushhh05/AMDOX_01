import { Controller, Get, Patch, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { TenantId, CurrentUser } from '../../common/decorators';

@ApiTags('Notifications')
@ApiBearerAuth('JWT')
@Controller('notifications')
export class NotificationsController {
  constructor(private notifService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get user notifications' })
  getNotifications(
    @CurrentUser('id') userId: string,
    @TenantId() tenantId: string,
    @Query('unreadOnly') unreadOnly: string,
  ) {
    return this.notifService.getNotifications(userId, tenantId, unreadOnly === 'true');
  }

  @Get('unread-count')
  getUnreadCount(@CurrentUser('id') userId: string, @TenantId() tenantId: string) {
    return this.notifService.getUnreadCount(userId, tenantId);
  }

  @Patch(':id/read')
  markAsRead(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.notifService.markAsRead(userId, id);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser('id') userId: string, @TenantId() tenantId: string) {
    return this.notifService.markAllAsRead(userId, tenantId);
  }
}
