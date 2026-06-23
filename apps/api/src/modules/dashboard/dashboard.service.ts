import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { FinanceService } from '../finance/finance.service';
import { HrService } from '../hr/hr.service';
import { SupplyChainService } from '../supply-chain/supply-chain.service';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private finance: FinanceService,
    private hr: HrService,
    private sc: SupplyChainService,
  ) {}

  async getKpis(tenantId: string) {
    const [finance, hr, sc, revenueChart] = await Promise.all([
      this.finance.getFinancialSummary(tenantId),
      this.hr.getHrSummary(tenantId),
      this.sc.getSupplyChainSummary(tenantId),
      this.finance.getRevenueByMonth(tenantId),
    ]);

    return { finance, hr, sc, revenueChart };
  }

  async getRecentActivity(tenantId: string) {
    const [recentInvoices, recentLeaves, recentPOs, recentLogs] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' }, take: 5,
        select: { id: true, invoiceNumber: true, totalAmount: true, status: true, type: true, createdAt: true },
      }),
      this.prisma.leaveRequest.findMany({
        where: { employee: { tenantId } },
        orderBy: { createdAt: 'desc' }, take: 5,
        include: { employee: { select: { firstName: true, lastName: true } } },
      }),
      this.prisma.purchaseOrder.findMany({
        where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 5,
        include: { vendor: { select: { name: true } } },
      }),
      this.prisma.auditLog.findMany({
        where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 10,
        include: { user: { select: { firstName: true, lastName: true } } },
      }),
    ]);

    return { recentInvoices, recentLeaves, recentPOs, recentLogs };
  }

  async getInventoryStatus(tenantId: string) {
    return this.prisma.inventoryItem.findMany({
      where: { tenantId },
      include: { product: true },
      orderBy: { quantityOnHand: 'asc' },
      take: 10,
    });
  }
}
