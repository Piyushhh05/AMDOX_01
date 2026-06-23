import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { HrService } from '../hr.service';
import { PrismaService } from '../../../config/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

const mockEmployees = [
  { id: 'emp-1', firstName: 'Alice', lastName: 'Johnson', email: 'alice@test.com', employeeNumber: 'EMP001', baseSalary: 8000, employmentStatus: 'ACTIVE', deletedAt: null },
  { id: 'emp-2', firstName: 'Bob', lastName: 'Smith', email: 'bob@test.com', employeeNumber: 'EMP002', baseSalary: 6000, employmentStatus: 'ACTIVE', deletedAt: null },
];

const mockPrisma = {
  employee: {
    findMany: jest.fn().mockResolvedValue(mockEmployees),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn().mockResolvedValue(2),
  },
  department: {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    upsert: jest.fn(),
  },
  leaveRequest: {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  payrollRun: {
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn(),
  },
  payrollLine: {
    findFirst: jest.fn(),
  },
};

const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };
const mockEvents = { emit: jest.fn() };

describe('HrService', () => {
  let service: HrService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HrService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: EventEmitter2, useValue: mockEvents },
      ],
    }).compile();

    service = module.get<HrService>(HrService);
    jest.clearAllMocks();
    mockPrisma.payrollRun.findUnique.mockResolvedValue(null);
    mockPrisma.employee.findMany.mockResolvedValue(mockEmployees);
    mockPrisma.employee.count.mockResolvedValue(2);
  });

  // ── Payroll calculation ───────────────────────────────────────────────────

  describe('runPayroll', () => {
    it('should throw BadRequestException if payroll already run for period', async () => {
      mockPrisma.payrollRun.findUnique.mockResolvedValue({ id: 'existing', period: '2026-04' });
      await expect(service.runPayroll('tenant-1', '2026-04'))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when no active employees', async () => {
      mockPrisma.payrollRun.findUnique.mockResolvedValue(null);
      mockPrisma.employee.findMany.mockResolvedValue([]);
      await expect(service.runPayroll('tenant-1', '2026-04'))
        .rejects.toThrow('No active employees found');
    });

    it('should correctly calculate net salary (85% of gross)', async () => {
      const mockRun = {
        id: 'run-1', period: '2026-04', status: 'COMPLETED',
        totalGross: 14000, totalNet: 11900, totalTax: 2100,
        employeeCount: 2, processedAt: new Date(),
        lines: mockEmployees.map(e => ({
          employeeId: e.id,
          grossSalary: Number(e.baseSalary),
          netSalary: Number(e.baseSalary) * 0.85,
          taxDeduction: Number(e.baseSalary) * 0.15,
          otherDeductions: Number(e.baseSalary) * 0.05,
          employee: { firstName: e.firstName, lastName: e.lastName, employeeNumber: e.employeeNumber },
        })),
      };
      mockPrisma.payrollRun.create.mockResolvedValue(mockRun);

      const result = await service.runPayroll('tenant-1', '2026-04');

      // Net = Gross - 15% tax - 5% statutory = 80% of gross
      expect(result.employeeCount).toBe(2);
      // Verify audit was called
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', resource: 'PayrollRun' }),
      );
      // Verify payroll event emitted
      expect(mockEvents.emit).toHaveBeenCalledWith('hr.payroll.completed', expect.any(Object));
    });
  });

  // ── Leave management ──────────────────────────────────────────────────────

  describe('createLeaveRequest', () => {
    it('should throw NotFoundException for unknown employee', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(null);
      await expect(
        service.createLeaveRequest('tenant-1', {
          employeeId: 'non-existent',
          type: 'ANNUAL',
          startDate: '2026-04-10',
          endDate: '2026-04-14',
          reason: 'Vacation',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should calculate days correctly for 5-day leave', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(mockEmployees[0]);
      const mockRequest = {
        id: 'leave-1', employeeId: 'emp-1', type: 'ANNUAL',
        startDate: new Date('2026-04-10'), endDate: new Date('2026-04-14'),
        days: 5, status: 'PENDING', employee: mockEmployees[0],
      };
      mockPrisma.leaveRequest.create.mockResolvedValue(mockRequest);

      const result = await service.createLeaveRequest('tenant-1', {
        employeeId: 'emp-1',
        type: 'ANNUAL',
        startDate: '2026-04-10',
        endDate: '2026-04-14',
        reason: 'Annual leave',
      });

      expect(result.days).toBe(5);
      expect(result.status).toBe('PENDING');
    });
  });

  // ── Employee creation ─────────────────────────────────────────────────────

  describe('createEmployee', () => {
    it('should auto-assign employee number', async () => {
      const newEmployee = {
        id: 'emp-3', employeeNumber: 'EMP0003',
        firstName: 'Carol', lastName: 'White',
        email: 'carol@test.com', tenantId: 'tenant-1',
        department: null,
      };
      mockPrisma.employee.create.mockResolvedValue(newEmployee);

      const result = await service.createEmployee('tenant-1', {
        firstName: 'Carol', lastName: 'White',
        email: 'carol@test.com', baseSalary: 7000,
        joinDate: '2026-04-01',
      });

      expect(result.employeeNumber).toMatch(/^EMP\d+/);
      expect(mockAudit.log).toHaveBeenCalled();
      expect(mockEvents.emit).toHaveBeenCalledWith('hr.employee.created', expect.any(Object));
    });
  });
});
