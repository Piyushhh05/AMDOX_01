import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { FinanceModule } from '../finance/finance.module';
import { HrModule } from '../hr/hr.module';
import { SupplyChainModule } from '../supply-chain/supply-chain.module';

@Module({
  imports: [FinanceModule, HrModule, SupplyChainModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
