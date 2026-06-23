import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ExportService } from './export.service';
import { TenantId, Roles } from '../../common/decorators';

@ApiTags('Exports')
@ApiBearerAuth('JWT')
@Controller('export')
export class ExportController {
  constructor(private exportService: ExportService) {}

  @Get('invoices')
  @ApiOperation({ summary: 'Export all invoices as CSV' })
  async exportInvoices(@TenantId() tenantId: string, @Res() res: Response) {
    const csv = await this.exportService.exportInvoicesToCsv(tenantId);
    const filename = `invoices-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv); // BOM for Excel UTF-8 compatibility
  }

  @Get('employees')
  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'Export all employees as CSV' })
  async exportEmployees(@TenantId() tenantId: string, @Res() res: Response) {
    const csv = await this.exportService.exportEmployeesToCsv(tenantId);
    const filename = `employees-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv);
  }

  @Get('payroll/:period')
  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'Export payroll run as CSV (e.g. 2026-04)' })
  async exportPayroll(
    @TenantId() tenantId: string,
    @Param('period') period: string,
    @Res() res: Response,
  ) {
    const csv = await this.exportService.exportPayrollToCsv(tenantId, period);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payroll-${period}.csv"`);
    res.send('\uFEFF' + csv);
  }

  @Get('inventory')
  @ApiOperation({ summary: 'Export inventory as CSV' })
  async exportInventory(@TenantId() tenantId: string, @Res() res: Response) {
    const csv = await this.exportService.exportInventoryToCsv(tenantId);
    const filename = `inventory-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv);
  }
}
