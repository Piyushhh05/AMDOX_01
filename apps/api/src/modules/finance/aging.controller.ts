import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AgingReportService } from './aging-report.service';
import { TenantId } from '../../common/decorators';

@ApiTags('Finance')
@ApiBearerAuth('JWT')
@Controller('finance/aging')
export class AgingController {
  constructor(private agingService: AgingReportService) {}

  @Get('ar')
  @ApiOperation({ summary: 'Accounts Receivable aging report' })
  getArAging(@TenantId() tenantId: string) {
    return this.agingService.getArAgingReport(tenantId);
  }

  @Get('ap')
  @ApiOperation({ summary: 'Accounts Payable aging report' })
  getApAging(@TenantId() tenantId: string) {
    return this.agingService.getApAgingReport(tenantId);
  }
}
