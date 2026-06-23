import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FinanceService } from '../finance.service';
import { PrismaService } from '../../../config/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

const mockPrisma = {
  account: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  journalEntry: {
    count: jest.fn().mockResolvedValue(0),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
  },
  invoice: {
    count: jest.fn().mockResolvedValue(0),
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: null } }),
  },
  payment: { create: jest.fn() },
  tenant: { findUnique: jest.fn().mockResolvedValue({ settings: {} }) },
  $transaction: jest.fn((ops) => Promise.all(ops)),
};

const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };
const mockEvents = { emit: jest.fn() };

describe('FinanceService', () => {
  let service: FinanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: EventEmitter2, useValue: mockEvents },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
    jest.clearAllMocks();
    mockPrisma.journalEntry.count.mockResolvedValue(0);
    mockPrisma.tenant.findUnique.mockResolvedValue({ settings: {} });
  });

  // ── Double-Entry Validation ───────────────────────────────────────────────

  describe('createJournalEntry', () => {
    it('should throw BadRequestException when debits ≠ credits', async () => {
      await expect(
        service.createJournalEntry('tenant-1', 'user-1', {
          description: 'Test entry',
          date: '2026-04-01',
          lines: [
            { accountId: 'acc-1', type: 'DEBIT', amount: 1000 },
            { accountId: 'acc-2', type: 'CREDIT', amount: 800 }, // Unbalanced!
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for unbalanced entry with message', async () => {
      await expect(
        service.createJournalEntry('tenant-1', 'user-1', {
          description: 'Unbalanced',
          date: '2026-04-01',
          lines: [
            { accountId: 'acc-1', type: 'DEBIT', amount: 500 },
            { accountId: 'acc-2', type: 'CREDIT', amount: 499 },
          ],
        }),
      ).rejects.toThrow(/Unbalanced entry/);
    });

    it('should create journal entry when debits = credits', async () => {
      const mockEntry = {
        id: 'je-1', entryNumber: 'JE-2026-00001',
        description: 'Balanced entry', totalAmount: 1000,
        lines: [],
      };
      mockPrisma.journalEntry.create.mockResolvedValue(mockEntry);

      const result = await service.createJournalEntry('tenant-1', 'user-1', {
        description: 'Balanced entry',
        date: '2026-04-01',
        lines: [
          { accountId: 'acc-1', type: 'DEBIT', amount: 1000 },
          { accountId: 'acc-2', type: 'CREDIT', amount: 1000 },
        ],
      });

      expect(result.entryNumber).toBe('JE-2026-00001');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', resource: 'JournalEntry' }),
      );
    });
  });

  // ── Invoice tests ─────────────────────────────────────────────────────────

  describe('createInvoice', () => {
    it('should calculate total amount correctly with tax', async () => {
      const mockInvoice = {
        id: 'inv-1', invoiceNumber: 'INV-2026-00001',
        type: 'RECEIVABLE', totalAmount: 110, subtotal: 100, taxAmount: 10,
        lineItems: [],
      };
      mockPrisma.invoice.create.mockResolvedValue(mockInvoice);

      const result = await service.createInvoice('tenant-1', {
        type: 'RECEIVABLE',
        customerName: 'Test Customer',
        issueDate: '2026-04-01',
        dueDate: '2026-04-30',
        lineItems: [{ description: 'Service', quantity: 1, unitPrice: 100, taxRate: 10 }],
      });

      expect(result.invoiceNumber).toContain('INV-');
      expect(mockEvents.emit).toHaveBeenCalledWith('finance.invoice.created', expect.any(Object));
      expect(mockAudit.log).toHaveBeenCalled();
    });

    it('should generate BILL prefix for PAYABLE type', async () => {
      const mockInvoice = { id: 'inv-2', invoiceNumber: 'BILL-2026-00001', type: 'PAYABLE', lineItems: [] };
      mockPrisma.invoice.create.mockResolvedValue(mockInvoice);

      const result = await service.createInvoice('tenant-1', {
        type: 'PAYABLE',
        vendorId: 'vendor-1',
        issueDate: '2026-04-01',
        dueDate: '2026-04-30',
        lineItems: [{ description: 'Purchase', quantity: 2, unitPrice: 50 }],
      });

      expect(result.invoiceNumber).toContain('BILL-');
    });
  });

  // ── Invoice not found ─────────────────────────────────────────────────────

  describe('getInvoiceById', () => {
    it('should throw NotFoundException for unknown invoice', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null);
      await expect(service.getInvoiceById('tenant-1', 'non-existent'))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ── Period close ──────────────────────────────────────────────────────────

  describe('isPeriodClosed', () => {
    it('should return true for a closed period', () => {
      const settings = { closedPeriods: ['2026-03', '2026-02'] };
      expect(service.isPeriodClosed(settings, 2026, 3)).toBe(true);
    });

    it('should return false for an open period', () => {
      const settings = { closedPeriods: ['2026-03'] };
      expect(service.isPeriodClosed(settings, 2026, 4)).toBe(false);
    });

    it('should return false with no closed periods', () => {
      expect(service.isPeriodClosed({}, 2026, 4)).toBe(false);
    });
  });
});
