import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Public } from '../common/decorators/auth.decorators.js';
import { TripDto } from '../zones/dto/trip.dto.js';
import { ZonesService } from '../zones/zones.service.js';
import { calculateFare } from './fare.calculator.js';

export interface FareEstimate {
  distanceKm: number;
  /** The most the passenger can pay; charged if nobody shares the ride. */
  soloFarePaisa: number;
  /** If the trip starts with 2 passengers (20% off). */
  pooledFarePaisa: number;
  /** If the trip starts with 3 or more passengers (30% off). */
  fullPoolFarePaisa: number;
  breakdown: {
    baseFarePaisa: number;
    distanceChargePaisa: number;
    subtotalPaisa: number;
    poolDiscountBps: number;
    fullPoolDiscountBps: number;
  };
}

@ApiTags('fares')
@Public()
@Controller('fares')
export class FaresController {
  constructor(private readonly zones: ZonesService) {}

  @ApiOperation({
    summary: 'Fare for a trip alone, shared by 2, and by 3 or more, in paisa',
  })
  @Post('estimate')
  @HttpCode(HttpStatus.OK)
  async estimate(@Body() dto: TripDto): Promise<FareEstimate> {
    const { distanceKm } = await this.zones.resolveTrip(
      dto.pickupZone,
      dto.destinationZone,
    );
    const fareFor = (passengers: number) =>
      calculateFare({ distanceKm, seats: dto.seats, passengers });
    const solo = fareFor(1);
    const shared = fareFor(2);
    const full = fareFor(3);

    return {
      distanceKm,
      soloFarePaisa: solo.finalFarePaisa,
      pooledFarePaisa: shared.finalFarePaisa,
      fullPoolFarePaisa: full.finalFarePaisa,
      breakdown: {
        baseFarePaisa: solo.baseFarePaisa,
        distanceChargePaisa: solo.distanceChargePaisa,
        subtotalPaisa: solo.subtotalPaisa,
        poolDiscountBps: shared.poolDiscountBps,
        fullPoolDiscountBps: full.poolDiscountBps,
      },
    };
  }
}
