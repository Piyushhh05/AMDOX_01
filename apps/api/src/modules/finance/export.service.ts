import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class ExportService {
  constructor(private prisma: PrismaService) {}

  async exportInvoicesToCsv(tenantId: string): Promise<string> {
    const invoices = await this.prisma.invoice.findMany({
      where: { tenantId, deletedAt: null },
      include: { vendor: true, payments: true },
      orderBy: { createdAt: 'desc' },
    });

    const headers = ['Invoice Number', 'Type', 'Customer/Vendor', 'Issue Date', 'Due Date', 'Subtotal', 'Tax', 'Total', 'Paid', 'Status', 'Currency'];
    const rows = invoices.map(inv => [
      inv.invoiceNumber,
      inv.type,
      inv.customerName || inv.vendor?.name || '',
      inv.issueDate.toISOString().split('T')[0],
      inv.dueDate.toISOString().split('T')[0],
      Number(inv.subtotal).toFixed(2),
      Number(inv.taxAmount).toFixed(2),
      Number(inv.totalAmount).toFixed(2),
      Number(inv.paidAmount).toFixed(2),
      inv.status,
      inv.currency,
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    return csv;
  }

  async exportEmployeesToCsv(tenantId: string): Promise<string> {
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, deletedAt: null },
      include: { department: true },
      orderBy: { employeeNumber: 'asc' },
    });

    const headers = ['Employee #', 'First Name', 'Last Name', 'Email', 'Department', 'Designation', 'Base Salary', 'Currency', 'Status', 'Join Date'];
    const rows = employees.map(emp => [
      emp.employeeNumber,
      emp.firstName,
      emp.lastName,
      emp.email,
      emp.department?.name || '',
      emp.designation || '',
      Number(emp.baseSalary).toFixed(2),
      emp.currency,
      emp.employmentStatus,
      emp.joinDate.toISOString().split('T')[0],
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    return csv;
  }

  async exportPayrollToCsv(tenantId: string, period: string): Promise<string> {
    const run = await this.prisma.payrollRun.findFirst({
      where: { tenantId, period },
      include: {
        lines: {
          include: {
            employee: { select: { firstName: true, lastName: true, employeeNumber: true, designation: true } },
          },
        },
      },
    });

    if (!run) return 'No payroll data found for this period.';

    const headers = ['Employee #', 'Name', 'Designation', 'Gross Salary', 'Tax Deduction', 'Other Deductions', 'Net Salary'];
    const rows = run.lines.map(line => [
      line.employee.employeeNumber,
      `${line.employee.firstName} ${line.employee.lastName}`,
      line.employee.designation || '',
      Number(line.grossSalary).toFixed(2),
      Number(line.taxDeduction).toFixed(2),
      Number(line.otherDeductions).toFixed(2),
      Number(line.netSalary).toFixed(2),
    ]);

    const summary = [
      [],
      ['', '', 'TOTALS:', Number(run.totalGross).toFixed(2), Number(run.totalTax).toFixed(2), '', Number(run.totalNet).toFixed(2)],
    ];

    const csv = [headers, ...rows, ...summary].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    return csv;
  }

  async exportInventoryToCsv(tenantId: string): Promise<string> {
    const items = await this.prisma.inventoryItem.findMany({
      where: { tenantId },
      include: { product: true },
      orderBy: { product: { name: 'asc' } },
    });

    const headers = ['SKU', 'Product Name', 'Category', 'Unit', 'On Hand', 'Reserved', 'On Order', 'Reorder Point', 'Cost Price', 'Sell Price'];
    const rows = items.map(item => [
      item.product.sku,
      item.product.name,
      item.product.category || '',
      item.product.unit,
      item.quantityOnHand,
      item.quantityReserved,
      item.quantityOnOrder,
      item.product.reorderPoint,
      Number(item.product.costPrice).toFixed(2),
      Number(item.product.sellPrice).toFixed(2),
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    return csv;
  }
}
