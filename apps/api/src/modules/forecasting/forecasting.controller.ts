import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ForecastingService } from './forecasting.service';
import { TenantId } from '../../common/decorators';

@ApiTags('Forecasting')
@ApiBearerAuth('JWT')
@Controller('forecasting')
export class ForecastingController {
  constructor(private forecastingService: ForecastingService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get demand forecast summary for all products' })
  getSummary(@TenantId() tenantId: string) {
    return this.forecastingService.getForecastSummary(tenantId);
  }

  @Get('product/:productId')
  @ApiOperation({ summary: 'Get 90-day demand forecast for a specific product' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  getForecast(
    @TenantId() tenantId: string,
    @Param('productId') productId: string,
    @Query('days') days?: number,
  ) {
    return this.forecastingService.getForecast(tenantId, productId, days ? Number(days) : 90);
  }
}
