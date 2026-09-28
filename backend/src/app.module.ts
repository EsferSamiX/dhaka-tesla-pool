import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { validateEnv } from './config/env.validation.js';
import { DriverModule } from './driver/driver.module.js';
import { FaresModule } from './fares/fares.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RidesModule } from './rides/rides.module.js';
import { ZonesModule } from './zones/zones.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    HealthModule,
    AuthModule,
    ZonesModule,
    FaresModule,
    RidesModule,
    DriverModule,
  ],
})
export class AppModule {}
