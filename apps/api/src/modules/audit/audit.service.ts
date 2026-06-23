import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async getLogs(tenantId: string, query: any = {}) {
    const skip = ((query.page || 1) - 1) * (query.limit || 50);
    const where: any = { tenantId };
    if (query.resource) where.resource = query.resource;
    if (query.userId) where.userId = query.userId;
    if (query.action) where.action = query.action;
    if (query.startDate) where.createdAt = { gte: new Date(query.startDate) };
    if (query.endDate) where.createdAt = { ...where.createdAt, lte: new Date(query.endDate) };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where, skip, take: Number(query.limit || 50),
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total, page: query.page || 1, limit: query.limit || 50 };
  }

  async log(params: {
    tenantId: string;
    userId?: string;
    action: string;
    resource: string;
    resourceId?: string;
    oldData?: any;
    newData?: any;
    ipAddress?: string;
  }) {
    return this.prisma.auditLog.create({ data: { ...params, action: params.action as any } });
  }
}
