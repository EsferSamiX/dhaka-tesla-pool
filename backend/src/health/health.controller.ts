import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface HealthStatus {
  status: 'ok';
  database: 'ok';
}

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** 200 when the API and database are both reachable, 503 otherwise. */
  @Get()
  async check(): Promise<HealthStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('Database unreachable');
    }
    return { status: 'ok', database: 'ok' };
  }
}
