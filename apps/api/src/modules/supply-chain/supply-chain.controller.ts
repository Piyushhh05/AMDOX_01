import { Controller, Get, Post, Body, Param, Query, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupplyChainService } from './supply-chain.service';
import { TenantId, Roles } from '../../common/decorators';

@ApiTags('Supply Chain')
@ApiBearerAuth('JWT')
@Controller('supply-chain')
export class SupplyChainController {
  constructor(private scService: SupplyChainService) {}

  @Get('summary')
  getSummary(@TenantId() tenantId: string) {
    return this.scService.getSupplyChainSummary(tenantId);
  }

  @Get('vendors')
  getVendors(@TenantId() tenantId: string, @Query() query: any) {
    return this.scService.getVendors(tenantId, query);
  }

  @Post('vendors')
  createVendor(@TenantId() tenantId: string, @Body() dto: any) {
    return this.scService.createVendor(tenantId, dto);
  }

  @Get('products')
  getProducts(@TenantId() tenantId: string, @Query() query: any) {
    return this.scService.getProducts(tenantId, query);
  }

  @Post('products')
  createProduct(@TenantId() tenantId: string, @Body() dto: any) {
    return this.scService.createProduct(tenantId, dto);
  }

  @Get('inventory')
  @ApiOperation({ summary: 'Get all inventory with stock status' })
  getInventory(@TenantId() tenantId: string) {
    return this.scService.getInventory(tenantId);
  }

  @Patch('inventory/:productId/adjust')
  adjustInventory(
    @TenantId() tenantId: string,
    @Param('productId') productId: string,
    @Body('quantity') quantity: number,
    @Body('type') type: 'ADD' | 'REMOVE',
  ) {
    return this.scService.adjustInventory(tenantId, productId, quantity, type);
  }

  @Get('purchase-orders')
  getPOs(@TenantId() tenantId: string, @Query() query: any) {
    return this.scService.getPurchaseOrders(tenantId, query);
  }

  @Post('purchase-orders')
  createPO(@TenantId() tenantId: string, @Body() dto: any) {
    return this.scService.createPurchaseOrder(tenantId, dto);
  }

  @Patch('purchase-orders/:id/status')
  updatePOStatus(@TenantId() tenantId: string, @Param('id') id: string, @Body('status') status: string) {
    return this.scService.updatePOStatus(tenantId, id, status);
  }
}
