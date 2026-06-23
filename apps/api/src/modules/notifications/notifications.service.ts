import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async getNotifications(userId: string, tenantId: string, unreadOnly = false) {
    const where: any = { userId, tenantId };
    if (unreadOnly) where.readAt = null;

    return this.prisma.notification.findMany({
      where, orderBy: { createdAt: 'desc' }, take: 50,
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date(), status: 'READ' },
    });
  }

  async markAllAsRead(userId: string, tenantId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, tenantId, readAt: null },
      data: { readAt: new Date(), status: 'READ' },
    });
  }

  async getUnreadCount(userId: string, tenantId: string) {
    const count = await this.prisma.notification.count({ where: { userId, tenantId, readAt: null } });
    return { count };
  }

  async createNotification(tenantId: string, userId: string, title: string, message: string, metadata?: any) {
    return this.prisma.notification.create({
      data: { tenantId, userId, title, message, channel: 'IN_APP', status: 'SENT', metadata: metadata || {}, sentAt: new Date() },
    });
  }

  // ─── EVENT LISTENERS ────────────────────────────────────────────────────────

  @OnEvent('finance.invoice.created')
  async onInvoiceCreated({ tenantId, invoice }: any) {
    const admins = await this.prisma.user.findMany({ where: { tenantId, role: { in: ['SUPER_ADMIN', 'TENANT_ADMIN', 'ACCOUNTANT'] } } });
    for (const admin of admins) {
      await this.createNotification(tenantId, admin.id, 'New Invoice Created', `Invoice ${invoice.invoiceNumber} for ${invoice.totalAmount} has been created.`, { invoiceId: invoice.id });
    }
  }

  @OnEvent('hr.leave.created')
  async onLeaveCreated({ tenantId, request }: any) {
    const managers = await this.prisma.user.findMany({ where: { tenantId, role: { in: ['SUPER_ADMIN', 'TENANT_ADMIN', 'HR_MANAGER', 'MANAGER'] } } });
    for (const manager of managers) {
      await this.createNotification(tenantId, manager.id, 'Leave Request Pending', `A new leave request needs your approval.`, { leaveId: request.id });
    }
  }

  @OnEvent('supply.reorder.needed')
  async onReorderNeeded({ tenantId, product, currentStock }: any) {
    const managers = await this.prisma.user.findMany({ where: { tenantId, role: { in: ['SUPER_ADMIN', 'SUPPLY_CHAIN_MANAGER'] } } });
    for (const manager of managers) {
      await this.createNotification(tenantId, manager.id, '⚠️ Low Stock Alert', `${product.name} (SKU: ${product.sku}) is low on stock. Current: ${currentStock}, Reorder point: ${product.reorderPoint}`, { productId: product.id });
    }
  }

  @OnEvent('hr.payroll.completed')
  async onPayrollCompleted({ tenantId, payrollRun }: any) {
    const admins = await this.prisma.user.findMany({ where: { tenantId, role: { in: ['SUPER_ADMIN', 'TENANT_ADMIN'] } } });
    for (const admin of admins) {
      await this.createNotification(tenantId, admin.id, '✅ Payroll Processed', `Payroll for ${payrollRun.period} completed. ${payrollRun.employeeCount} employees, total net: $${payrollRun.totalNet}`, { payrollRunId: payrollRun.id });
    }
  }
}
