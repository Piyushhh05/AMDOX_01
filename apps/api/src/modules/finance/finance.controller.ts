import { Controller, Get, Post, Body, Param, Query, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { CreateAccountDto, CreateJournalEntryDto, CreateInvoiceDto, CreatePaymentDto, FinanceQueryDto } from './finance.dto';
import { TenantId, CurrentUser, Roles } from '../../common/decorators';

@ApiTags('Finance')
@ApiBearerAuth('JWT')
@Controller('finance')
export class FinanceController {
  constructor(private financeService: FinanceService) {}

  @Get('summary')
  getSummary(@TenantId() tenantId: string) { return this.financeService.getFinancialSummary(tenantId); }

  @Get('revenue-by-month')
  getRevenueByMonth(@TenantId() tenantId: string) { return this.financeService.getRevenueByMonth(tenantId); }

  @Get('accounts')
  getAccounts(@TenantId() tenantId: string) { return this.financeService.getAccounts(tenantId); }

  @Post('accounts')
  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'ACCOUNTANT')
  createAccount(@TenantId() tenantId: string, @Body() dto: CreateAccountDto) { return this.financeService.createAccount(tenantId, dto); }

  @Post('period-close')
  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Lock a financial period' })
  closePeriod(@TenantId() tenantId: string, @CurrentUser('id') userId: string, @Body('year') year: number, @Body('month') month: number) {
    return this.financeService.closePeriod(tenantId, userId, year, month);
  }

  @Post('period-reopen')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Re-open a locked period' })
  reopenPeriod(@TenantId() tenantId: string, @CurrentUser('id') userId: string, @Body('year') year: number, @Body('month') month: number) {
    return this.financeService.reopenPeriod(tenantId, userId, year, month);
  }

  @Get('closed-periods')
  getClosedPeriods(@TenantId() tenantId: string) { return this.financeService.getClosedPeriods(tenantId); }

  @Get('journal-entries')
  getJournalEntries(@TenantId() tenantId: string, @Query() query: FinanceQueryDto) { return this.financeService.getJournalEntries(tenantId, query); }

  @Post('journal-entries')
  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'ACCOUNTANT')
  createJournalEntry(@TenantId() tenantId: string, @CurrentUser('id') userId: string, @Body() dto: CreateJournalEntryDto) {
    return this.financeService.createJournalEntry(tenantId, userId, dto);
  }

  @Get('invoices')
  getInvoices(@TenantId() tenantId: string, @Query() query: FinanceQueryDto) { return this.financeService.getInvoices(tenantId, query); }

  @Get('invoices/:id')
  getInvoiceById(@TenantId() tenantId: string, @Param('id') id: string) { return this.financeService.getInvoiceById(tenantId, id); }

  @Post('invoices')
  createInvoice(@TenantId() tenantId: string, @Body() dto: CreateInvoiceDto) { return this.financeService.createInvoice(tenantId, dto); }

  @Patch('invoices/:id/status')
  updateStatus(@TenantId() tenantId: string, @Param('id') id: string, @Body('status') status: string) {
    return this.financeService.updateInvoiceStatus(tenantId, id, status);
  }

  @Post('invoices/:id/payments')
  recordPayment(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: CreatePaymentDto) {
    return this.financeService.recordPayment(tenantId, id, dto);
  }

  @Get('gdpr/export/:userId')
  @Roles('SUPER_ADMIN', 'TENANT_ADMIN')
  @ApiOperation({ summary: 'GDPR: Export all financial data for a user (Art. 20)' })
  gdprExport(@TenantId() tenantId: string, @Param('userId') userId: string) {
    return this.financeService.gdprExportUserData(tenantId, userId);
  }
}