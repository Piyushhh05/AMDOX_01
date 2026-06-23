import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class HrService {
  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
    private audit: AuditService,
  ) {}

  // ─── EMPLOYEES ──────────────────────────────────────────────────────────────

  async getEmployees(tenantId: string, query: any = {}) {
    const skip = ((query.page || 1) - 1) * (query.limit || 20);
    const where: any = { tenantId, deletedAt: null };
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.status) where.employmentStatus = query.status;
    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { employeeNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where, skip, take: Number(query.limit || 20),
        include: { department: true, manager: { select: { firstName: true, lastName: true } } },
        orderBy: { firstName: 'asc' },
      }),
      this.prisma.employee.count({ where }),
    ]);
    return { data, total, page: query.page || 1, limit: query.limit || 20 };
  }

  async getEmployeeById(tenantId: string, id: string) {
    const emp = await this.prisma.employee.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        department: true,
        manager: { select: { id: true, firstName: true, lastName: true, designation: true } },
        subordinates: { select: { id: true, firstName: true, lastName: true, designation: true }, where: { deletedAt: null } },
        leaveRequests: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!emp) throw new NotFoundException('Employee not found');
    return emp;
  }

  async createEmployee(tenantId: string, dto: any) {
    const count = await this.prisma.employee.count({ where: { tenantId } });
    const employeeNumber = `EMP${String(count + 1).padStart(4, '0')}`;

    const employee = await this.prisma.employee.create({
      data: { tenantId, employeeNumber, ...dto, joinDate: new Date(dto.joinDate) },
      include: { department: true },
    });

    this.events.emit('hr.employee.created', { tenantId, employee });
    await this.audit.log({ tenantId, action: 'CREATE', resource: 'Employee', resourceId: employee.id, newData: { employeeNumber: employee.employeeNumber, email: employee.email } });
    return employee;
  }

  async updateEmployee(tenantId: string, id: string, dto: any) {
    const emp = await this.prisma.employee.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!emp) throw new NotFoundException('Employee not found');
    return this.prisma.employee.update({ where: { id }, data: dto, include: { department: true } });
  }

  // ─── DEPARTMENTS ────────────────────────────────────────────────────────────

  async getDepartments(tenantId: string) {
    return this.prisma.department.findMany({
      where: { tenantId },
      include: { _count: { select: { employees: true } }, children: true },
      orderBy: { name: 'asc' },
    });
  }

  async createDepartment(tenantId: string, dto: any) {
    return this.prisma.department.create({ data: { tenantId, ...dto } });
  }

  // ─── LEAVE MANAGEMENT ───────────────────────────────────────────────────────

  async getLeaveRequests(tenantId: string, query: any = {}) {
    const where: any = { employee: { tenantId } };
    if (query.status) where.status = query.status;
    if (query.employeeId) where.employeeId = query.employeeId;

    return this.prisma.leaveRequest.findMany({
      where, take: 50,
      include: { employee: { select: { firstName: true, lastName: true, employeeNumber: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createLeaveRequest(tenantId: string, dto: any) {
    const employee = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, tenantId, deletedAt: null } });
    if (!employee) throw new NotFoundException('Employee not found');

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const request = await this.prisma.leaveRequest.create({
      data: { employeeId: dto.employeeId, type: dto.type, startDate: start, endDate: end, days, reason: dto.reason, status: 'PENDING' },
      include: { employee: true },
    });

    this.events.emit('hr.leave.created', { tenantId, request });
    return request;
  }

  async updateLeaveStatus(tenantId: string, id: string, status: string, approverId: string) {
    const request = await this.prisma.leaveRequest.findFirst({ where: { id, employee: { tenantId } } });
    if (!request) throw new NotFoundException('Leave request not found');

    return this.prisma.leaveRequest.update({
      where: { id },
      data: { status: status as any, approvedBy: approverId, approvedAt: new Date() },
    });
  }

  // ─── PAYROLL ────────────────────────────────────────────────────────────────

  async getPayrollRuns(tenantId: string) {
    return this.prisma.payrollRun.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });
  }

  async runPayroll(tenantId: string, period: string) {
    const existing = await this.prisma.payrollRun.findUnique({ where: { tenantId_period: { tenantId, period } } });
    if (existing) throw new BadRequestException(`Payroll already run for ${period}`);

    const employees = await this.prisma.employee.findMany({
      where: { tenantId, employmentStatus: 'ACTIVE', deletedAt: null },
    });

    if (employees.length === 0) throw new BadRequestException('No active employees found');

    // Calculate payroll for each employee
    const lines = employees.map(emp => {
      const base = Number(emp.baseSalary);
      const tax = base * 0.15;       // 15% income tax (simplified)
      const statutory = base * 0.05; // 5% statutory deductions
      const net = base - tax - statutory;

      return {
        employeeId: emp.id,
        baseSalary: base,
        grossSalary: base,
        taxDeduction: tax,
        otherDeductions: statutory,
        netSalary: net,
        breakdown: { incomeTax: tax, providentFund: statutory },
      };
    });

    const totalGross = lines.reduce((s, l) => s + l.grossSalary, 0);
    const totalNet = lines.reduce((s, l) => s + l.netSalary, 0);
    const totalTax = lines.reduce((s, l) => s + l.taxDeduction, 0);

    const payrollRun = await this.prisma.payrollRun.create({
      data: {
        tenantId, period, status: 'COMPLETED',
        totalGross, totalNet, totalTax,
        employeeCount: employees.length,
        processedAt: new Date(),
        lines: { create: lines },
      },
      include: { lines: { include: { employee: { select: { firstName: true, lastName: true, employeeNumber: true } } } } },
    });

    this.events.emit('hr.payroll.completed', { tenantId, payrollRun });
    await this.audit.log({ tenantId, action: 'CREATE', resource: 'PayrollRun', resourceId: payrollRun.id, newData: { period, employeeCount: employees.length, totalNet: totalNet } });
    return payrollRun;
  }

  async getPayrollRunById(tenantId: string, id: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id, tenantId },
      include: { lines: { include: { employee: { select: { firstName: true, lastName: true, employeeNumber: true, designation: true } } } } },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    return run;
  }

  async getHrSummary(tenantId: string) {
    const [totalEmployees, onLeave, newThisMonth, deptBreakdown] = await Promise.all([
      this.prisma.employee.count({ where: { tenantId, employmentStatus: 'ACTIVE', deletedAt: null } }),
      this.prisma.employee.count({ where: { tenantId, employmentStatus: 'ON_LEAVE', deletedAt: null } }),
      this.prisma.employee.count({ where: { tenantId, deletedAt: null, joinDate: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } }),
      this.prisma.department.findMany({
        where: { tenantId },
        include: { _count: { select: { employees: { where: { deletedAt: null, employmentStatus: 'ACTIVE' } } } } },
      }),
    ]);

    return { totalEmployees, onLeave, newThisMonth, deptBreakdown };
  }
}
