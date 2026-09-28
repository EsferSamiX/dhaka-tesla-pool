import { Module } from '@nestjs/common';
import { ZonesModule } from '../zones/zones.module.js';
import { PoolingService } from './pooling.service.js';

@Module({
  imports: [ZonesModule],
  providers: [PoolingService],
  exports: [PoolingService],
})
export class PoolsModule {}
