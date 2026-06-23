import { IsString, IsNumber, IsOptional, IsEnum, IsDateString, IsArray, ValidateNested, IsBoolean, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAccountDto {
  @ApiProperty() @IsString() code: string;
  @ApiProperty() @IsString() name: string;
  @ApiProperty({ enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] })
  @IsEnum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']) type: string;
  @ApiPropertyOptional() @IsOptional() @IsString() subtype?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() parentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() currency?: string;
}

export class JournalLineDto {
  @ApiProperty() @IsString() accountId: string;
  @ApiProperty({ enum: ['DEBIT', 'CREDIT'] }) @IsEnum(['DEBIT', 'CREDIT']) type: string;
  @ApiProperty() @IsNumber() amount: number;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}

export class CreateJournalEntryDto {
  @ApiProperty() @IsString() description: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reference?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() currency?: string;
  @ApiProperty() @IsDateString() date: string;
  @ApiProperty({ type: [JournalLineDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => JournalLineDto)
  lines: JournalLineDto[];
}

export class InvoiceLineDto {
  @ApiProperty() @IsString() description: string;
  @ApiProperty() @IsNumber() @Min(0) quantity: number;
  @ApiProperty() @IsNumber() @Min(0) unitPrice: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() taxRate?: number;
}

export class CreateInvoiceDto {
  @ApiProperty({ enum: ['PAYABLE', 'RECEIVABLE'] })
  @IsEnum(['PAYABLE', 'RECEIVABLE']) type: string;
  @ApiPropertyOptional() @IsOptional() @IsString() vendorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customerEmail?: string;
  @ApiProperty() @IsDateString() issueDate: string;
  @ApiProperty() @IsDateString() dueDate: string;
  @ApiPropertyOptional() @IsOptional() @IsString() currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiProperty({ type: [InvoiceLineDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => InvoiceLineDto)
  lineItems: InvoiceLineDto[];
}

export class CreatePaymentDto {
  @ApiProperty() @IsNumber() @Min(0) amount: number;
  @ApiProperty() @IsString() method: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reference?: string;
  @ApiProperty() @IsDateString() paidAt: string;
}

export class FinanceQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() endDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) page?: number = 1;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) limit?: number = 20;
}
