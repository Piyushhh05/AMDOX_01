import { Module } from '@nestjs/common';
import { HrController } from './hr.controller';
import { HrService } from './hr.service';
import { PayslipService } from './payslip.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [HrController],
  providers: [HrService, PayslipService],
  exports: [HrService],
})
export class HrModule {}
