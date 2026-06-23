import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { TenantId } from '../../common/decorators';

@ApiTags('Dashboard')
@ApiBearerAuth('JWT')
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'Get all KPIs for dashboard' })
  getKpis(@TenantId() tenantId: string) {
    return this.dashboardService.getKpis(tenantId);
  }

  @Get('recent-activity')
  @ApiOperation({ summary: 'Get recent activity feed' })
  getRecentActivity(@TenantId() tenantId: string) {
    return this.dashboardService.getRecentActivity(tenantId);
  }

  @Get('inventory-status')
  @ApiOperation({ summary: 'Get low stock inventory items' })
  getInventoryStatus(@TenantId() tenantId: string) {
    return this.dashboardService.getInventoryStatus(tenantId);
  }
}
