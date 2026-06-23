import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SupplyChainService {
  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
    private audit: AuditService,
  ) {}

  // ─── VENDORS ────────────────────────────────────────────────────────────────

  async getVendors(tenantId: string, query: any = {}) {
    const where: any = { tenantId, deletedAt: null };
    if (query.search) where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { code: { contains: query.search, mode: 'insensitive' } },
    ];
    return this.prisma.vendor.findMany({ where, orderBy: { name: 'asc' }, take: 50 });
  }

  async createVendor(tenantId: string, dto: any) {
    const count = await this.prisma.vendor.count({ where: { tenantId } });
    const code = dto.code || `VND${String(count + 1).padStart(4, '0')}`;
    return this.prisma.vendor.create({ data: { tenantId, code, ...dto } });
  }

  // ─── PRODUCTS ───────────────────────────────────────────────────────────────

  async getProducts(tenantId: string, query: any = {}) {
    const where: any = { tenantId, isActive: true };
    if (query.category) where.category = query.category;
    if (query.search) where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { sku: { contains: query.search, mode: 'insensitive' } },
    ];

    return this.prisma.product.findMany({
      where, orderBy: { name: 'asc' },
      include: { inventoryItems: true },
    });
  }

  async createProduct(tenantId: string, dto: any) {
    const product = await this.prisma.product.create({
      data: { tenantId, ...dto },
    });

    // Initialize inventory
    await this.prisma.inventoryItem.create({
      data: { tenantId, productId: product.id, quantityOnHand: dto.initialStock || 0 },
    });

    return product;
  }

  // ─── INVENTORY ──────────────────────────────────────────────────────────────

  async getInventory(tenantId: string) {
    const items = await this.prisma.inventoryItem.findMany({
      where: { tenantId },
      include: { product: true },
      orderBy: { product: { name: 'asc' } },
    });

    return items.map(item => ({
      ...item,
      status: item.quantityOnHand <= item.product.reorderPoint
        ? 'LOW_STOCK'
        : item.quantityOnHand === 0 ? 'OUT_OF_STOCK' : 'IN_STOCK',
    }));
  }

  async adjustInventory(tenantId: string, productId: string, quantity: number, type: 'ADD' | 'REMOVE') {
    const item = await this.prisma.inventoryItem.findFirst({ where: { tenantId, productId } });
    if (!item) throw new NotFoundException('Inventory item not found');

    const newQty = type === 'ADD' ? item.quantityOnHand + quantity : item.quantityOnHand - quantity;
    if (newQty < 0) throw new BadRequestException('Insufficient stock');

    const updated = await this.prisma.inventoryItem.update({
      where: { tenantId_productId: { tenantId, productId } },
      data: { quantityOnHand: newQty, updatedAt: new Date() },
      include: { product: true },
    });

    // Check reorder point
    if (updated.quantityOnHand <= updated.product.reorderPoint) {
      this.events.emit('supply.reorder.needed', { tenantId, product: updated.product, currentStock: updated.quantityOnHand });
    }

    return updated;
  }

  // ─── PURCHASE ORDERS ────────────────────────────────────────────────────────

  async getPurchaseOrders(tenantId: string, query: any = {}) {
    const where: any = { tenantId };
    if (query.status) where.status = query.status;
    if (query.vendorId) where.vendorId = query.vendorId;

    return this.prisma.purchaseOrder.findMany({
      where, take: 50,
      include: { vendor: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPurchaseOrder(tenantId: string, dto: any) {
    const count = await this.prisma.purchaseOrder.count({ where: { tenantId } });
    const poNumber = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const totalAmount = dto.items.reduce((s: number, item: any) => s + item.quantity * item.unitPrice, 0);

    const po = await this.prisma.purchaseOrder.create({
      data: {
        tenantId, poNumber, vendorId: dto.vendorId, status: 'DRAFT',
        orderDate: new Date(), expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
        currency: dto.currency || 'USD', totalAmount, notes: dto.notes,
        items: {
          create: dto.items.map((item: any) => ({
            productId: item.productId, quantity: item.quantity,
            unitPrice: item.unitPrice, total: item.quantity * item.unitPrice,
          })),
        },
      },
      include: { vendor: true, items: { include: { product: true } } },
    });

    this.events.emit('supply.po.created', { tenantId, po });
    await this.audit.log({ tenantId, action: 'CREATE', resource: 'PurchaseOrder', resourceId: po.id, newData: { poNumber: po.poNumber, totalAmount: po.totalAmount, vendorId: po.vendorId } });
    return po;
  }

  async updatePOStatus(tenantId: string, id: string, status: string) {
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id, tenantId } });
    if (!po) throw new NotFoundException('Purchase order not found');

    // If received, update inventory
    if (status === 'RECEIVED') {
      const items = await this.prisma.purchaseOrderItem.findMany({ where: { purchaseOrderId: id } });
      for (const item of items) {
        await this.adjustInventory(tenantId, item.productId, item.quantity, 'ADD');
        await this.prisma.purchaseOrderItem.update({ where: { id: item.id }, data: { receivedQty: item.quantity } });
      }
    }

    return this.prisma.purchaseOrder.update({ where: { id }, data: { status: status as any } });
  }

  async getSupplyChainSummary(tenantId: string) {
    const [totalProducts, lowStockItems, pendingOrders, totalVendors] = await Promise.all([
      this.prisma.product.count({ where: { tenantId, isActive: true } }),
      this.prisma.inventoryItem.count({
        where: { tenantId, quantityOnHand: { lte: 10 } },
      }),
      this.prisma.purchaseOrder.count({ where: { tenantId, status: { in: ['DRAFT', 'SENT', 'CONFIRMED'] } } }),
      this.prisma.vendor.count({ where: { tenantId, isActive: true, deletedAt: null } }),
    ]);

    return { totalProducts, lowStockItems, pendingOrders, totalVendors };
  }
}
