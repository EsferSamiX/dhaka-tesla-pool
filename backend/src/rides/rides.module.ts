import { Module } from '@nestjs/common';
import { PoolsModule } from '../pools/pools.module.js';
import { ZonesModule } from '../zones/zones.module.js';
import { RidesController } from './rides.controller.js';
import { RidesService } from './rides.service.js';

@Module({
  imports: [ZonesModule, PoolsModule],
  controllers: [RidesController],
  providers: [RidesService],
  exports: [RidesService],
})
export class RidesModule {}
