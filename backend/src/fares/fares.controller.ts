import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Public } from '../common/decorators/auth.decorators.js';
import { TripDto } from '../zones/dto/trip.dto.js';
import { ZonesService } from '../zones/zones.service.js';
import { calculateFare } from './fare.calculator.js';

export interface FareEstimate {
  distanceKm: number;
  /** The most the passenger can pay; charged if nobody shares the ride. */
  soloFarePaisa: number;
  /** What the passenger pays if the trip starts with 2+ passengers. */
  pooledFarePaisa: number;
  breakdown: {
    baseFarePaisa: number;
    distanceChargePaisa: number;
    subtotalPaisa: number;
    poolDiscountBps: number;
  };
}

@Public()
@Controller('fares')
export class FaresController {
  constructor(private readonly zones: ZonesService) {}

  @Post('estimate')
  @HttpCode(HttpStatus.OK)
  async estimate(@Body() dto: TripDto): Promise<FareEstimate> {
    const { distanceKm } = await this.zones.resolveTrip(
      dto.pickupZone,
      dto.destinationZone,
    );
    const solo = calculateFare({ distanceKm, seats: dto.seats, pooled: false });
    const pooled = calculateFare({
      distanceKm,
      seats: dto.seats,
      pooled: true,
    });

    return {
      distanceKm,
      soloFarePaisa: solo.finalFarePaisa,
      pooledFarePaisa: pooled.finalFarePaisa,
      breakdown: {
        baseFarePaisa: solo.baseFarePaisa,
        distanceChargePaisa: solo.distanceChargePaisa,
        subtotalPaisa: solo.subtotalPaisa,
        poolDiscountBps: pooled.poolDiscountBps,
      },
    };
  }
}
