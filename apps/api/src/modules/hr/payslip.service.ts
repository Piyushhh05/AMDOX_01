import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class PayslipService {
  constructor(private prisma: PrismaService) {}

  async generatePayslipPdf(tenantId: string, payrollRunId: string, employeeId: string): Promise<Buffer> {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: payrollRunId, tenantId },
    });
    if (!run) throw new NotFoundException('Payroll run not found');

    const line = await this.prisma.payrollLine.findFirst({
      where: { payrollRunId, employeeId },
      include: {
        employee: {
          include: { department: true },
        },
      },
    });
    if (!line) throw new NotFoundException('Payslip not found for this employee');

    const emp = line.employee;
    const breakdown = line.breakdown as any;
    const net = Number(line.netSalary);
    const gross = Number(line.grossSalary);
    const tax = Number(line.taxDeduction);
    const other = Number(line.otherDeductions);

    // Build HTML payslip (rendered as a proper string)
    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1e293b; background: #fff; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #3b5bdb; padding-bottom: 20px; margin-bottom: 28px; }
  .company { font-size: 22px; font-weight: 800; color: #3b5bdb; letter-spacing: -0.5px; }
  .company-sub { font-size: 12px; color: #64748b; margin-top: 3px; }
  .slip-title { text-align: right; }
  .slip-title h2 { font-size: 16px; font-weight: 700; color: #1e293b; }
  .slip-title p { font-size: 12px; color: #64748b; margin-top: 4px; }
  .section { margin-bottom: 22px; }
  .section-title { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 10px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
  .info-item label { font-size: 11px; color: #94a3b8; display: block; margin-bottom: 2px; }
  .info-item span { font-weight: 600; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f8fafc; color: #475569; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding: 9px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
  td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
  tr:last-child td { border-bottom: none; }
  .amount { text-align: right; font-weight: 600; }
  .credit { color: #16a34a; }
  .deduct { color: #dc2626; }
  .net-box { background: #3b5bdb; color: white; border-radius: 10px; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }
  .net-box .label { font-size: 13px; opacity: 0.85; }
  .net-box .value { font-size: 24px; font-weight: 800; }
  .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; }
  .badge { display: inline-block; background: #dcfce7; color: #15803d; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
</style>
</head>
<body>

<div class="header">
  <div>
    <div class="company">Amdox Technologies</div>
    <div class="company-sub">Enterprise Resource Planning Platform</div>
  </div>
  <div class="slip-title">
    <h2>PAYSLIP</h2>
    <p>Period: ${run.period}</p>
    <p style="margin-top:4px"><span class="badge">PAID</span></p>
  </div>
</div>

<div class="section">
  <div class="section-title">Employee Details</div>
  <div class="info-grid">
    <div class="info-item"><label>Employee Name</label><span>${emp.firstName} ${emp.lastName}</span></div>
    <div class="info-item"><label>Employee ID</label><span>${emp.employeeNumber}</span></div>
    <div class="info-item"><label>Department</label><span>${emp.department?.name || '—'}</span></div>
    <div class="info-item"><label>Designation</label><span>${emp.designation || '—'}</span></div>
    <div class="info-item"><label>Email</label><span>${emp.email}</span></div>
    <div class="info-item"><label>Pay Period</label><span>${run.period}</span></div>
  </div>
</div>

<div class="section">
  <div class="section-title">Earnings</div>
  <table>
    <thead><tr><th>Description</th><th class="amount">Amount (USD)</th></tr></thead>
    <tbody>
      <tr><td>Base Salary</td><td class="amount credit">$${Number(emp.baseSalary).toFixed(2)}</td></tr>
      <tr><td><strong>Gross Salary</strong></td><td class="amount credit"><strong>$${gross.toFixed(2)}</strong></td></tr>
    </tbody>
  </table>
</div>

<div class="section">
  <div class="section-title">Deductions</div>
  <table>
    <thead><tr><th>Description</th><th class="amount">Amount (USD)</th></tr></thead>
    <tbody>
      <tr><td>Income Tax (15%)</td><td class="amount deduct">-$${tax.toFixed(2)}</td></tr>
      <tr><td>Provident Fund (5%)</td><td class="amount deduct">-$${(breakdown?.providentFund || other).toFixed(2)}</td></tr>
      <tr><td><strong>Total Deductions</strong></td><td class="amount deduct"><strong>-$${(tax + other).toFixed(2)}</strong></td></tr>
    </tbody>
  </table>
</div>

<div class="net-box">
  <span class="label">Net Pay for ${run.period}</span>
  <span class="value">$${net.toFixed(2)}</span>
</div>

<div class="footer">
  <span>Generated by Amdox ERP on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
  <span>This is a computer-generated payslip and does not require a signature.</span>
</div>

</body>
</html>`;

    // Return as Buffer (HTML that browser can render / print to PDF)
    return Buffer.from(html, 'utf-8');
  }
}
