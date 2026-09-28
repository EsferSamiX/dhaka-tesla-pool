import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser, Roles } from '../common/decorators/auth.decorators.js';
import { CancelRideDto, CreateRideDto, PaginationDto } from './dto/ride.dto.js';
import type { RideView } from './ride.view.js';
import { Page, RidesService, TimelineEntry } from './rides.service.js';

@Roles('PASSENGER')
@Controller('rides')
export class RidesController {
  constructor(private readonly rides: RidesService) {}

  @Post()
  request(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateRideDto,
  ): Promise<RideView> {
    return this.rides.request(user.id, dto);
  }

  // Declared before ':id' so "active" isn't read as an ID.
  @Get('active')
  active(@CurrentUser() user: AuthUser): Promise<RideView | null> {
    return this.rides.findActive(user.id);
  }

  @Get()
  history(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationDto,
  ): Promise<Page<RideView>> {
    return this.rides.list(user.id, query);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RideView & { timeline: TimelineEntry[] }> {
    const ride = await this.rides.getOwn(user.id, id);
    return { ...ride, timeline: await this.rides.timeline(user.id, id) };
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelRideDto,
  ): Promise<RideView> {
    return this.rides.cancel(user.id, id, dto.reason);
  }
}
