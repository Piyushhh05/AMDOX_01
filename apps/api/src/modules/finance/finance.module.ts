import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { AgingReportService } from './aging-report.service';
import { AgingController } from './aging.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [FinanceController, ExportController, AgingController],
  providers: [FinanceService, ExportService, AgingReportService],
  exports: [FinanceService, AgingReportService],
})
export class FinanceModule {}
