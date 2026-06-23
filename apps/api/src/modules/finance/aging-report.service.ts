import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class AgingReportService {
  constructor(private prisma: PrismaService) {}

  async getArAgingReport(tenantId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        type: 'RECEIVABLE',
        status: { in: ['SENT', 'OVERDUE', 'PARTIALLY_PAID'] },
        deletedAt: null,
      },
      include: { payments: true },
      orderBy: { dueDate: 'asc' },
    });

    const today = new Date();
    const buckets = { current: 0, days1_30: 0, days31_60: 0, days61_90: 0, over90: 0 };
    const details: any[] = [];

    for (const inv of invoices) {
      const outstanding = Number(inv.totalAmount) - Number(inv.paidAmount);
      if (outstanding <= 0) continue;

      const daysOverdue = Math.floor((today.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));

      let bucket = 'current';
      if (daysOverdue > 90) { buckets.over90 += outstanding; bucket = 'over90'; }
      else if (daysOverdue > 60) { buckets.days61_90 += outstanding; bucket = 'days61_90'; }
      else if (daysOverdue > 30) { buckets.days31_60 += outstanding; bucket = 'days31_60'; }
      else if (daysOverdue > 0) { buckets.days1_30 += outstanding; bucket = 'days1_30'; }
      else { buckets.current += outstanding; }

      details.push({
        invoiceNumber: inv.invoiceNumber,
        customer: inv.customerName || 'Unknown',
        invoiceDate: inv.issueDate,
        dueDate: inv.dueDate,
        total: Number(inv.totalAmount),
        paid: Number(inv.paidAmount),
        outstanding,
        daysOverdue: Math.max(0, daysOverdue),
        bucket,
      });
    }

    const totalOutstanding = Object.values(buckets).reduce((s, v) => s + v, 0);

    return {
      summary: {
        ...buckets,
        total: totalOutstanding,
        invoiceCount: details.length,
      },
      details: details.sort((a, b) => b.daysOverdue - a.daysOverdue),
    };
  }

  async getApAgingReport(tenantId: string) {
    const bills = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        type: 'PAYABLE',
        status: { in: ['SENT', 'OVERDUE', 'PARTIALLY_PAID'] },
        deletedAt: null,
      },
      include: { vendor: true, payments: true },
      orderBy: { dueDate: 'asc' },
    });

    const today = new Date();
    const buckets = { current: 0, days1_30: 0, days31_60: 0, days61_90: 0, over90: 0 };
    const details: any[] = [];

    for (const bill of bills) {
      const outstanding = Number(bill.totalAmount) - Number(bill.paidAmount);
      if (outstanding <= 0) continue;
      const daysOverdue = Math.floor((today.getTime() - new Date(bill.dueDate).getTime()) / (1000 * 60 * 60 * 24));

      if (daysOverdue > 90) buckets.over90 += outstanding;
      else if (daysOverdue > 60) buckets.days61_90 += outstanding;
      else if (daysOverdue > 30) buckets.days31_60 += outstanding;
      else if (daysOverdue > 0) buckets.days1_30 += outstanding;
      else buckets.current += outstanding;

      details.push({ invoiceNumber: bill.invoiceNumber, vendor: bill.vendor?.name || 'Unknown', dueDate: bill.dueDate, outstanding, daysOverdue: Math.max(0, daysOverdue) });
    }

    return { summary: { ...buckets, total: Object.values(buckets).reduce((s, v) => s + v, 0) }, details };
  }
}
