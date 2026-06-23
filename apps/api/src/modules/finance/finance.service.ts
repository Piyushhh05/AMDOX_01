import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditService } from '../audit/audit.service';
import {
  CreateAccountDto, CreateJournalEntryDto,
  CreateInvoiceDto, CreatePaymentDto, FinanceQueryDto,
} from './finance.dto';

@Injectable()
export class FinanceService {
  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
    private audit: AuditService,
  ) {}

  // ─── ACCOUNTS ───────────────────────────────────────────────────────────────

  async getAccounts(tenantId: string) {
    return this.prisma.account.findMany({
      where: { tenantId, isActive: true },
      include: { children: { where: { isActive: true } } },
      orderBy: { code: 'asc' },
    });
  }

  async createAccount(tenantId: string, dto: CreateAccountDto) {
    const exists = await this.prisma.account.findUnique({ where: { tenantId_code: { tenantId, code: dto.code } } });
    if (exists) throw new BadRequestException(`Account code ${dto.code} already exists`);
    return this.prisma.account.create({ data: { tenantId, ...dto } });
  }

  // ─── JOURNAL ENTRIES ────────────────────────────────────────────────────────

  async getJournalEntries(tenantId: string, query: FinanceQueryDto) {
    const skip = ((query.page || 1) - 1) * (query.limit || 20);
    const where: any = { tenantId };
    if (query.startDate) where.createdAt = { gte: new Date(query.startDate) };
    if (query.endDate) where.createdAt = { ...where.createdAt, lte: new Date(query.endDate) };

    const [data, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where, skip, take: query.limit || 20,
        include: { lines: { include: { account: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.journalEntry.count({ where }),
    ]);
    return { data, total, page: query.page || 1, limit: query.limit || 20 };
  }

  async createJournalEntry(tenantId: string, userId: string, dto: CreateJournalEntryDto) {
    // Validate double-entry: debits must equal credits
    const totalDebits = dto.lines.filter(l => l.type === 'DEBIT').reduce((s, l) => s + l.amount, 0);
    const totalCredits = dto.lines.filter(l => l.type === 'CREDIT').reduce((s, l) => s + l.amount, 0);

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      throw new BadRequestException(`Unbalanced entry: Debits (${totalDebits}) ≠ Credits (${totalCredits})`);
    }

    const date = new Date(dto.date);
    // Check if period is closed
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (this.isPeriodClosed(tenant?.settings, date.getFullYear(), date.getMonth() + 1)) {
      throw new BadRequestException(`Period ${date.getFullYear()}-${date.getMonth() + 1} is closed. Contact your admin to re-open it.`);
    }
    const count = await this.prisma.journalEntry.count({ where: { tenantId } });
    const entryNumber = `JE-${date.getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const entry = await this.prisma.journalEntry.create({
      data: {
        tenantId, entryNumber, description: dto.description,
        reference: dto.reference, currency: dto.currency || 'USD',
        totalAmount: totalDebits, isPosted: true,
        periodYear: date.getFullYear(), periodMonth: date.getMonth() + 1,
        createdById: userId, postedAt: new Date(),
        lines: {
          create: dto.lines.map(line => ({
            accountId: line.accountId, type: line.type as any,
            amount: line.amount, description: line.description,
          })),
        },
      },
      include: { lines: { include: { account: true } } },
    });

    this.events.emit('finance.journal.created', { tenantId, entry });
    await this.audit.log({ tenantId, userId, action: 'CREATE', resource: 'JournalEntry', resourceId: entry.id, newData: { entryNumber: entry.entryNumber, totalAmount: entry.totalAmount } });
    return entry;
  }

  // ─── INVOICES ───────────────────────────────────────────────────────────────

  async getInvoices(tenantId: string, query: FinanceQueryDto) {
    const skip = ((query.page || 1) - 1) * (query.limit || 20);
    const where: any = { tenantId, deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.startDate) where.issueDate = { gte: new Date(query.startDate) };
    if (query.endDate) where.issueDate = { ...where.issueDate, lte: new Date(query.endDate) };

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where, skip, take: query.limit || 20,
        include: { lineItems: true, vendor: true, payments: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return { data, total, page: query.page || 1, limit: query.limit || 20 };
  }

  async getInvoiceById(tenantId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { lineItems: true, vendor: true, payments: true, journalEntry: { include: { lines: { include: { account: true } } } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async createInvoice(tenantId: string, dto: CreateInvoiceDto) {
    const count = await this.prisma.invoice.count({ where: { tenantId } });
    const prefix = dto.type === 'RECEIVABLE' ? 'INV' : 'BILL';
    const invoiceNumber = `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const subtotal = dto.lineItems.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
    const taxAmount = dto.lineItems.reduce((s, item) => s + item.quantity * item.unitPrice * ((item.taxRate || 0) / 100), 0);
    const totalAmount = subtotal + taxAmount;

    const invoice = await this.prisma.invoice.create({
      data: {
        tenantId, invoiceNumber, type: dto.type as any, status: 'DRAFT',
        vendorId: dto.vendorId, customerName: dto.customerName,
        customerEmail: dto.customerEmail, currency: dto.currency || 'USD',
        issueDate: new Date(dto.issueDate), dueDate: new Date(dto.dueDate),
        subtotal, taxAmount, discountAmount: 0, totalAmount,
        notes: dto.notes,
        lineItems: {
          create: dto.lineItems.map(item => ({
            description: item.description, quantity: item.quantity,
            unitPrice: item.unitPrice, taxRate: item.taxRate || 0,
            total: item.quantity * item.unitPrice * (1 + (item.taxRate || 0) / 100),
          })),
        },
      },
      include: { lineItems: true, vendor: true },
    });

    this.events.emit('finance.invoice.created', { tenantId, invoice });
    await this.audit.log({ tenantId, action: 'CREATE', resource: 'Invoice', resourceId: invoice.id, newData: { invoiceNumber: invoice.invoiceNumber, totalAmount: invoice.totalAmount, type: invoice.type } });
    return invoice;
  }

  async updateInvoiceStatus(tenantId: string, id: string, status: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.prisma.invoice.update({ where: { id }, data: { status: status as any } });
  }

  async recordPayment(tenantId: string, invoiceId: string, dto: CreatePaymentDto) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, tenantId, deletedAt: null } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const newPaid = Number(invoice.paidAmount) + dto.amount;
    const newStatus = newPaid >= Number(invoice.totalAmount) ? 'PAID' : 'PARTIALLY_PAID';

    const [payment] = await this.prisma.$transaction([
      this.prisma.payment.create({
        data: { invoiceId, amount: dto.amount, method: dto.method, reference: dto.reference, paidAt: new Date(dto.paidAt) },
      }),
      this.prisma.invoice.update({ where: { id: invoiceId }, data: { paidAmount: newPaid, status: newStatus as any } }),
    ]);

    this.events.emit('finance.payment.recorded', { tenantId, invoiceId, amount: dto.amount });
    return payment;
  }

  // ─── FINANCIAL SUMMARY ─────────────────────────────────────────────────────

  async getFinancialSummary(tenantId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalRevenue, totalExpenses, pendingInvoices, overdueInvoices, recentEntries] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { tenantId, type: 'RECEIVABLE', status: 'PAID' },
        _sum: { totalAmount: true },
      }),
      this.prisma.invoice.aggregate({
        where: { tenantId, type: 'PAYABLE', status: 'PAID' },
        _sum: { totalAmount: true },
      }),
      this.prisma.invoice.count({ where: { tenantId, status: 'SENT' } }),
      this.prisma.invoice.count({ where: { tenantId, status: 'OVERDUE' } }),
      this.prisma.journalEntry.findMany({
        where: { tenantId, createdAt: { gte: monthStart } },
        take: 5, orderBy: { createdAt: 'desc' },
      }),
    ]);

    const revenue = Number(totalRevenue._sum.totalAmount || 0);
    const expenses = Number(totalExpenses._sum.totalAmount || 0);

    return {
      revenue, expenses, profit: revenue - expenses,
      pendingInvoices, overdueInvoices,
      recentEntries,
      profitMargin: revenue > 0 ? ((revenue - expenses) / revenue * 100).toFixed(1) : '0',
    };
  }

  async getRevenueByMonth(tenantId: string) {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);

      const [rev, exp] = await Promise.all([
        this.prisma.invoice.aggregate({ where: { tenantId, type: 'RECEIVABLE', status: 'PAID', issueDate: { gte: start, lte: end } }, _sum: { totalAmount: true } }),
        this.prisma.invoice.aggregate({ where: { tenantId, type: 'PAYABLE', status: 'PAID', issueDate: { gte: start, lte: end } }, _sum: { totalAmount: true } }),
      ]);

      months.push({
        month: start.toLocaleString('default', { month: 'short', year: '2-digit' }),
        revenue: Number(rev._sum.totalAmount || 0),
        expenses: Number(exp._sum.totalAmount || 0),
      });
    }
    return months;
  }

  // ─── PERIOD CLOSE ────────────────────────────────────────────────────────

  async closePeriod(tenantId: string, userId: string, year: number, month: number) {
    // Store closed periods in tenant settings JSON
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const settings = (tenant?.settings as any) || {};
    const closedPeriods: string[] = settings.closedPeriods || [];
    const key = `${year}-${String(month).padStart(2, '0')}`;

    if (closedPeriods.includes(key)) {
      return { message: `Period ${key} is already closed`, period: key };
    }

    closedPeriods.push(key);
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: { ...settings, closedPeriods } },
    });

    await this.audit.log({ tenantId, userId, action: 'UPDATE', resource: 'Period', resourceId: key, newData: { action: 'CLOSED', period: key } });
    return { message: `Period ${key} closed successfully`, period: key, closedBy: userId };
  }

  async reopenPeriod(tenantId: string, userId: string, year: number, month: number) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const settings = (tenant?.settings as any) || {};
    const closedPeriods: string[] = settings.closedPeriods || [];
    const key = `${year}-${String(month).padStart(2, '0')}`;

    const updated = closedPeriods.filter(p => p !== key);
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { settings: { ...settings, closedPeriods: updated } } });
    await this.audit.log({ tenantId, userId, action: 'UPDATE', resource: 'Period', resourceId: key, newData: { action: 'REOPENED', period: key } });
    return { message: `Period ${key} re-opened`, period: key };
  }

  async getClosedPeriods(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const settings = (tenant?.settings as any) || {};
    return { closedPeriods: settings.closedPeriods || [] };
  }

  isPeriodClosed(settings: any, year: number, month: number): boolean {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    return (settings?.closedPeriods || []).includes(key);
  }

  // ─── GDPR DATA EXPORT (Art. 20) ──────────────────────────────────────────

  async gdprExportUserData(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new Error('User not found');

    const [invoices, payments, auditLogs] = await Promise.all([
      this.prisma.invoice.findMany({ where: { tenantId }, include: { lineItems: true, payments: true } }),
      this.prisma.payment.findMany({ where: { invoice: { tenantId } } }),
      this.prisma.auditLog.findMany({ where: { tenantId, userId }, orderBy: { createdAt: 'desc' } }),
    ]);

    return {
      exportDate: new Date().toISOString(),
      dataSubject: { id: user.id, email: user.email, name: `${user.firstName} ${user.lastName}` },
      invoices: invoices.length,
      payments: payments.length,
      auditActions: auditLogs.length,
      data: { invoices, auditLogs },
      gdprNote: 'Exported under GDPR Article 20 — Right to Data Portability',
    };
  }
}
