import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface ZoneView {
  code: string;
  name: string;
  lat: number;
  lng: number;
}

export interface Trip {
  pickupZoneId: number;
  destinationZoneId: number;
  distanceKm: number;
}

@Injectable()
export class ZonesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<ZoneView[]> {
    const zones = await this.prisma.zone.findMany({ orderBy: { id: 'asc' } });
    return zones.map(({ code, name, lat, lng }) => ({
      code,
      name,
      lat: lat.toNumber(),
      lng: lng.toNumber(),
    }));
  }

  /** Resolves two zone codes to IDs and their distance, or rejects with 400. */
  async resolveTrip(
    pickupCode: string,
    destinationCode: string,
  ): Promise<Trip> {
    if (pickupCode === destinationCode) {
      throw new BadRequestException(
        'destinationZone must differ from pickupZone',
      );
    }

    const zones = await this.prisma.zone.findMany({
      where: { code: { in: [pickupCode, destinationCode] } },
      select: { id: true, code: true },
    });
    const idOf = (code: string) => {
      const zone = zones.find((z) => z.code === code);
      if (!zone) throw new BadRequestException(`Unknown zone: ${code}`);
      return zone.id;
    };
    const pickupZoneId = idOf(pickupCode);
    const destinationZoneId = idOf(destinationCode);

    const distance = await this.prisma.zoneDistance.findUniqueOrThrow({
      where: {
        fromZoneId_toZoneId: {
          fromZoneId: pickupZoneId,
          toZoneId: destinationZoneId,
        },
      },
      select: { distanceKm: true },
    });

    return { pickupZoneId, destinationZoneId, distanceKm: distance.distanceKm };
  }
}
