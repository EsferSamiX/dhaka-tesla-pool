import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsString, Matches, Max, Min } from 'class-validator';
import { MAX_SEATS } from '../../fares/fare.calculator.js';

const zoneCode = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

/** A trip between two zones, as sent by the client (zones by code). */
export class TripDto {
  @Transform(zoneCode)
  @IsString()
  @Matches(/^[A-Z0-9]{3}$/, { message: 'pickupZone must be a zone code' })
  pickupZone: string;

  @Transform(zoneCode)
  @IsString()
  @Matches(/^[A-Z0-9]{3}$/, { message: 'destinationZone must be a zone code' })
  destinationZone: string;

  // The generated docs metadata can't read an imported constant, so the
  // maximum is repeated for Swagger here.
  @ApiProperty({ minimum: 1, maximum: MAX_SEATS })
  @IsInt()
  @Min(1)
  @Max(MAX_SEATS)
  seats: number;
}
