import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../common/decorators/auth.decorators.js';
import type { PoolView } from '../pools/pool.view.js';
import { PaginationDto } from '../rides/dto/ride.dto.js';
import type { Page } from '../rides/rides.service.js';
import { DriverService, WaitingRequest } from './driver.service.js';
import { CancelPoolDto, SetStatusDto } from './dto/driver.dto.js';

@ApiTags('driver')
@ApiCookieAuth()
@Roles('DRIVER')
@Controller('driver')
export class DriverController {
  constructor(private readonly driver: DriverService) {}

  @ApiOperation({ summary: 'Go online or offline' })
  @Patch('status')
  setStatus(@CurrentUser() user: AuthUser, @Body() dto: SetStatusDto) {
    return this.driver.setOnline(user.id, dto.isOnline);
  }

  @ApiOperation({ summary: 'Waiting rides this driver can accept' })
  @Get('requests')
  requests(@CurrentUser() user: AuthUser): Promise<WaitingRequest[]> {
    return this.driver.waitingRequests(user.id);
  }

  @ApiOperation({
    summary: 'Accept a ride: starts a pool, or adds to the open one',
  })
  @Post('requests/:id/accept')
  @HttpCode(HttpStatus.OK)
  accept(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PoolView> {
    return this.driver.accept(user.id, id);
  }

  @ApiOperation({ summary: 'The current trip, or null' })
  @Get('pool')
  pool(@CurrentUser() user: AuthUser): Promise<PoolView | null> {
    return this.driver.currentPool(user.id);
  }

  @ApiOperation({ summary: 'Mark arrival at the pickup zone' })
  @Post('pool/arrive')
  @HttpCode(HttpStatus.OK)
  arrive(@CurrentUser() user: AuthUser): Promise<PoolView> {
    return this.driver.arrive(user.id);
  }

  @ApiOperation({ summary: 'Start the trip and lock every fare' })
  @Post('pool/start')
  @HttpCode(HttpStatus.OK)
  start(@CurrentUser() user: AuthUser): Promise<PoolView> {
    return this.driver.start(user.id);
  }

  @ApiOperation({
    summary:
      'Drop off the next passenger (they pay cash); the last drop-off ends the trip',
  })
  @Post('pool/drop-off/:rideId')
  @HttpCode(HttpStatus.OK)
  dropOff(
    @CurrentUser() user: AuthUser,
    @Param('rideId', ParseUUIDPipe) rideId: string,
  ): Promise<PoolView> {
    return this.driver.dropOff(user.id, rideId);
  }

  @ApiOperation({
    summary: 'Drop off everyone still on board and complete the trip',
  })
  @Post('pool/complete')
  @HttpCode(HttpStatus.OK)
  complete(@CurrentUser() user: AuthUser): Promise<PoolView> {
    return this.driver.complete(user.id);
  }

  @ApiOperation({
    summary: 'Cancel before the start; passengers go back to waiting',
  })
  @Post('pool/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() user: AuthUser,
    @Body() dto: CancelPoolDto,
  ): Promise<PoolView> {
    return this.driver.cancel(user.id, dto.reason);
  }

  @ApiOperation({ summary: 'Trip history, newest first' })
  @Get('pools')
  history(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationDto,
  ): Promise<Page<PoolView>> {
    return this.driver.history(user.id, query);
  }
}
