import { Controller, Get, Post, Put, Body, Param, Query, Patch, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { HrService } from './hr.service';
import { PayslipService } from './payslip.service';
import { TenantId, CurrentUser, Roles } from '../../common/decorators';

@ApiTags('HR')
@ApiBearerAuth('JWT')
@Controller('hr')
export class HrController {
  constructor(
    private hrService: HrService,
    private payslipService: PayslipService,
  ) {}

  @Get('summary')
  getSummary(@TenantId() tenantId: string) {
    return this.hrService.getHrSummary(tenantId);
  }

  // Departments
  @Get('departments')
  getDepartments(@TenantId() tenantId: string) {
    return this.hrService.getDepartments(tenantId);
  }

  @Post('departments')
  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'HR_MANAGER')
  createDepartment(@TenantId() tenantId: string, @Body() dto: any) {
    return this.hrService.createDepartment(tenantId, dto);
  }

  // Employees
  @Get('employees')
  @ApiOperation({ summary: 'List employees with filters' })
  getEmployees(@TenantId() tenantId: string, @Query() query: any) {
    return this.hrService.getEmployees(tenantId, query);
  }

  @Get('employees/:id')
  getEmployee(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.hrService.getEmployeeById(tenantId, id);
  }

  @Post('employees')
  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'HR_MANAGER')
  createEmployee(@TenantId() tenantId: string, @Body() dto: any) {
    return this.hrService.createEmployee(tenantId, dto);
  }

  @Patch('employees/:id')
  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'HR_MANAGER')
  updateEmployee(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: any) {
    return this.hrService.updateEmployee(tenantId, id, dto);
  }

  // Leave
  @Get('leave-requests')
  getLeaveRequests(@TenantId() tenantId: string, @Query() query: any) {
    return this.hrService.getLeaveRequests(tenantId, query);
  }

  @Post('leave-requests')
  createLeaveRequest(@TenantId() tenantId: string, @Body() dto: any) {
    return this.hrService.createLeaveRequest(tenantId, dto);
  }

  @Patch('leave-requests/:id/status')
  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'HR_MANAGER', 'MANAGER')
  updateLeaveStatus(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.hrService.updateLeaveStatus(tenantId, id, status, userId);
  }

  // Payroll
  @Get('payroll')
  getPayrollRuns(@TenantId() tenantId: string) {
    return this.hrService.getPayrollRuns(tenantId);
  }

  @Get('payroll/:id')
  getPayrollRun(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.hrService.getPayrollRunById(tenantId, id);
  }

  @Post('payroll/run')
  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'Process payroll for a period (e.g. 2026-04)' })
  runPayroll(@TenantId() tenantId: string, @Body('period') period: string) {
    return this.hrService.runPayroll(tenantId, period);
  }

  @Get('payroll/:runId/payslip/:employeeId')
  @ApiOperation({ summary: 'Download payslip as HTML (print-ready)' })
  async downloadPayslip(
    @TenantId() tenantId: string,
    @Param('runId') runId: string,
    @Param('employeeId') employeeId: string,
    @Res() res: Response,
  ) {
    const html = await this.payslipService.generatePayslipPdf(tenantId, runId, employeeId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payslip-${runId}-${employeeId}.html"`);
    res.send(html);
  }
}
