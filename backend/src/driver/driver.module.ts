import { Module } from '@nestjs/common';
import { DriverController } from './driver.controller.js';
import { DriverService } from './driver.service.js';

@Module({
  controllers: [DriverController],
  providers: [DriverService],
})
export class DriverModule {}
