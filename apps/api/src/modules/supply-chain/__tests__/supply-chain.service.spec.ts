import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SupplyChainService } from '../supply-chain.service';
import { PrismaService } from '../../../config/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

const mockPrisma = {
  vendor: { findMany: jest.fn(), count: jest.fn().mockResolvedValue(0), create: jest.fn() },
  product: { findMany: jest.fn(), create: jest.fn(), count: jest.fn().mockResolvedValue(0) },
  inventoryItem: {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  },
  purchaseOrder: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn().mockResolvedValue(0) },
  purchaseOrderItem: { findMany: jest.fn().mockResolvedValue([]) },
};
const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };
const mockEvents = { emit: jest.fn() };

describe('SupplyChainService', () => {
  let service: SupplyChainService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplyChainService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: EventEmitter2, useValue: mockEvents },
      ],
    }).compile();
    service = module.get<SupplyChainService>(SupplyChainService);
    jest.clearAllMocks();
    mockPrisma.purchaseOrder.count.mockResolvedValue(0);
    mockPrisma.vendor.count.mockResolvedValue(0);
  });

  describe('adjustInventory', () => {
    it('should throw NotFoundException for unknown product', async () => {
      mockPrisma.inventoryItem.findFirst.mockResolvedValue(null);
      await expect(service.adjustInventory('t1', 'unknown-id', 5, 'ADD'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when removing more than available', async () => {
      mockPrisma.inventoryItem.findFirst.mockResolvedValue({ id: 'i1', quantityOnHand: 3 });
      await expect(service.adjustInventory('t1', 'p1', 10, 'REMOVE'))
        .rejects.toThrow(BadRequestException);
    });

    it('should add stock correctly', async () => {
      mockPrisma.inventoryItem.findFirst.mockResolvedValue({ id: 'i1', quantityOnHand: 10 });
      mockPrisma.inventoryItem.update.mockResolvedValue({
        quantityOnHand: 15,
        product: { name: 'Test', sku: 'T001', reorderPoint: 5 },
      });
      const result = await service.adjustInventory('t1', 'p1', 5, 'ADD');
      expect(result.quantityOnHand).toBe(15);
    });

    it('should emit reorder event below reorder point', async () => {
      mockPrisma.inventoryItem.findFirst.mockResolvedValue({ id: 'i1', quantityOnHand: 8 });
      mockPrisma.inventoryItem.update.mockResolvedValue({
        quantityOnHand: 3,
        product: { id: 'p1', name: 'Test', sku: 'T001', reorderPoint: 5 },
      });
      await service.adjustInventory('t1', 'p1', 5, 'REMOVE');
      expect(mockEvents.emit).toHaveBeenCalledWith('supply.reorder.needed', expect.any(Object));
    });
  });

  describe('createPurchaseOrder', () => {
    it('should create PO with correct total', async () => {
      const mockPO = { id: 'po-1', poNumber: 'PO-2026-00001', totalAmount: 200, vendor: { name: 'Vendor' }, items: [] };
      mockPrisma.purchaseOrder.create.mockResolvedValue(mockPO);
      const result = await service.createPurchaseOrder('t1', {
        vendorId: 'v1',
        items: [{ productId: 'p1', quantity: 2, unitPrice: 100 }],
      });
      expect(result.totalAmount).toBe(200);
      expect(mockAudit.log).toHaveBeenCalled();
    });
  });
});
