import { Module } from '@nestjs/common';
import { ZonesModule } from '../zones/zones.module.js';
import { FaresController } from './fares.controller.js';

@Module({
  imports: [ZonesModule],
  controllers: [FaresController],
})
export class FaresModule {}
