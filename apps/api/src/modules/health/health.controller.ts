import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../config/prisma.service';
import { Public } from '../common/decorators';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Basic liveness check' })
  live() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'amdox-erp-api',
      version: '1.0.0',
    };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness check — verifies DB connection' })
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: { database: 'ok' },
      };
    } catch (err) {
      return {
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        checks: { database: 'error' },
      };
    }
  }
}
