import { Module } from '@nestjs/common';
import { PoolsModule } from '../pools/pools.module.js';
import { DriverController } from './driver.controller.js';
import { DriverService } from './driver.service.js';

@Module({
  imports: [PoolsModule],
  controllers: [DriverController],
  providers: [DriverService],
})
export class DriverModule {}
