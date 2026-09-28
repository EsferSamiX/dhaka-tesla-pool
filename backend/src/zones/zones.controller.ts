import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/auth.decorators.js';
import { ZonesService, ZoneView } from './zones.service.js';

@ApiTags('zones')
@Public()
@Controller('zones')
export class ZonesController {
  constructor(private readonly zones: ZonesService) {}

  @ApiOperation({ summary: 'All 14 zones' })
  @Get()
  list(): Promise<ZoneView[]> {
    return this.zones.list();
  }
}
