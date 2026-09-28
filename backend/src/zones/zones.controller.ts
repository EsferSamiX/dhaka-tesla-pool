import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/auth.decorators.js';
import { ZonesService, ZoneView } from './zones.service.js';

@Public()
@Controller('zones')
export class ZonesController {
  constructor(private readonly zones: ZonesService) {}

  @Get()
  list(): Promise<ZoneView[]> {
    return this.zones.list();
  }
}
