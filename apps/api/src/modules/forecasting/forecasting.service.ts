import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';

@Injectable()
export class ForecastingService {
  private readonly logger = new Logger(ForecastingService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private get mlUrl() {
    return this.config.get('ML_SERVICE_URL', 'http://localhost:8000');
  }
  private get mlKey() {
    return this.config.get('ML_SERVICE_API_KEY', 'dev-key');
  }

  // ─── GET FORECAST FOR A PRODUCT ─────────────────────────────────────────

  async getForecast(tenantId: string, productId: string, days = 90) {
    // Verify product belongs to tenant
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
    });
    if (!product) throw new NotFoundException('Product not found');

    // Check if we have recent forecast (less than 24h old)
    const existing = await this.prisma.forecastData.findMany({
      where: {
        tenantId,
        productId,
        forecastDate: { gte: new Date() },
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { forecastDate: 'asc' },
      take: days,
    });

    if (existing.length >= Math.min(days, 30)) {
      this.logger.log(`Returning cached forecast for product ${productId}`);
      return {
        product,
        forecast: existing,
        source: 'cache',
        generatedAt: existing[0]?.createdAt,
      };
    }

    // Build historical data from purchase orders
    const historicalOrders = await this.prisma.purchaseOrderItem.findMany({
      where: { product: { tenantId }, productId },
      include: { purchaseOrder: { select: { orderDate: true, status: true } } },
      orderBy: { purchaseOrder: { orderDate: 'asc' } },
    });

    // Group by date
    const byDate: Record<string, number> = {};
    for (const item of historicalOrders) {
      if (item.purchaseOrder.status === 'RECEIVED') {
        const d = item.purchaseOrder.orderDate.toISOString().split('T')[0];
        byDate[d] = (byDate[d] || 0) + item.quantity;
      }
    }

    const historicalData = Object.entries(byDate).map(([date, quantity]) => ({
      date,
      quantity,
    }));

    // Need minimum 5 data points — pad with synthetic if needed
    if (historicalData.length < 5) {
      const base = Number(product.costPrice) || 10;
      for (let i = 30; i >= historicalData.length; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        historicalData.unshift({
          date: d.toISOString().split('T')[0],
          quantity: Math.floor(Math.random() * 20) + base * 0.1,
        });
      }
    }

    // Call Python ML service
    let forecastResult: any;
    try {
      const response = await axios.post(
        `${this.mlUrl}/forecast`,
        { product_id: productId, historical_data: historicalData, forecast_days: days },
        { headers: { 'X-API-Key': this.mlKey }, timeout: 30000 },
      );
      forecastResult = response.data;
    } catch (err) {
      this.logger.warn(`ML service unavailable, using summary endpoint: ${err.message}`);
      // Fallback to demo summary
      const response = await axios.get(
        `${this.mlUrl}/forecast/summary/${productId}`,
        { headers: { 'X-API-Key': this.mlKey }, timeout: 10000 },
      ).catch(() => ({ data: { forecast: this.generateFallbackForecast(days) } }));
      forecastResult = { forecast: response.data.forecast, model_used: 'fallback' };
    }

    // Persist forecast to DB
    const forecastEntries = forecastResult.forecast.map((f: any) => ({
      tenantId,
      productId,
      forecastDate: new Date(f.date),
      predictedQty: f.predicted_qty,
      confidence: f.confidence || 0.65,
      modelVersion: forecastResult.model_used || 'v1',
    }));

    // Upsert each forecast point
    await this.prisma.$transaction(
      forecastEntries.map((entry: any) =>
        this.prisma.forecastData.upsert({
          where: {
            tenantId_productId_forecastDate: {
              tenantId: entry.tenantId,
              productId: entry.productId,
              forecastDate: entry.forecastDate,
            },
          },
          update: { predictedQty: entry.predictedQty, confidence: entry.confidence, modelVersion: entry.modelVersion },
          create: entry,
        }),
      ),
    );

    const saved = await this.prisma.forecastData.findMany({
      where: { tenantId, productId, forecastDate: { gte: new Date() } },
      orderBy: { forecastDate: 'asc' },
      take: days,
    });

    return {
      product,
      forecast: saved,
      mape: forecastResult.mape,
      modelUsed: forecastResult.model_used,
      source: 'ml_service',
      generatedAt: new Date(),
    };
  }

  // ─── GET ALL PRODUCT FORECASTS SUMMARY ──────────────────────────────────

  async getForecastSummary(tenantId: string) {
    const products = await this.prisma.product.findMany({
      where: { tenantId, isActive: true },
      include: { inventoryItems: true },
      take: 10,
    });

    const summaries = await Promise.all(
      products.map(async (p) => {
        const next30 = await this.prisma.forecastData.findMany({
          where: { tenantId, productId: p.id, forecastDate: { gte: new Date(), lte: new Date(Date.now() + 30 * 86400000) } },
          orderBy: { forecastDate: 'asc' },
        });

        const avgDemand = next30.length > 0
          ? next30.reduce((s, f) => s + Number(f.predictedQty), 0) / next30.length
          : 0;

        const currentStock = p.inventoryItems[0]?.quantityOnHand || 0;
        const daysUntilStockout = avgDemand > 0 ? Math.floor(currentStock / avgDemand) : 999;

        return {
          product: { id: p.id, name: p.name, sku: p.sku },
          currentStock,
          avgDailyDemand: Math.round(avgDemand * 10) / 10,
          daysUntilStockout,
          reorderRecommended: daysUntilStockout < 14,
          forecastPoints: next30.length,
        };
      }),
    );

    return summaries.sort((a, b) => a.daysUntilStockout - b.daysUntilStockout);
  }

  // ─── WEEKLY RETRAINING CRON ──────────────────────────────────────────────

  @Cron(CronExpression.EVERY_WEEK)
  async weeklyRetrain() {
    this.logger.log('Starting weekly forecast retraining...');
    const tenants = await this.prisma.tenant.findMany({ where: { isActive: true }, select: { id: true } });

    for (const tenant of tenants) {
      const products = await this.prisma.product.findMany({ where: { tenantId: tenant.id, isActive: true }, select: { id: true } });
      for (const product of products) {
        try {
          // Delete old forecasts older than today
          await this.prisma.forecastData.deleteMany({
            where: { tenantId: tenant.id, productId: product.id, forecastDate: { lt: new Date() } },
          });
          // Regenerate
          await this.getForecast(tenant.id, product.id);
          await new Promise(r => setTimeout(r, 200)); // small delay between calls
        } catch (err) {
          this.logger.error(`Failed retraining for product ${product.id}: ${err.message}`);
        }
      }
    }
    this.logger.log('Weekly retraining complete');
  }

  // ─── FALLBACK FORECAST GENERATOR ────────────────────────────────────────

  private generateFallbackForecast(days: number) {
    const forecast = [];
    const base = Math.random() * 30 + 10;
    for (let i = 1; i <= days; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      forecast.push({
        date: d.toISOString().split('T')[0],
        predicted_qty: Math.max(0, base + (Math.random() - 0.5) * base * 0.3),
        confidence: 0.55,
      });
    }
    return forecast;
  }
}
