import { Controller, Get } from '@nestjs/common';

export interface HealthStatus {
  status: 'ok';
}

@Controller('health')
export class HealthController {
  // Database connectivity is added to this check once Prisma is set up.
  @Get()
  check(): HealthStatus {
    return { status: 'ok' };
  }
}
