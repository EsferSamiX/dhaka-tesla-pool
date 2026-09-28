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
import { CurrentUser, Roles } from '../common/decorators/auth.decorators.js';
import type { PoolView } from '../pools/pool.view.js';
import { PaginationDto } from '../rides/dto/ride.dto.js';
import type { Page } from '../rides/rides.service.js';
import { DriverService, WaitingRequest } from './driver.service.js';
import { CancelPoolDto, SetStatusDto } from './dto/driver.dto.js';

@Roles('DRIVER')
@Controller('driver')
export class DriverController {
  constructor(private readonly driver: DriverService) {}

  @Patch('status')
  setStatus(@CurrentUser() user: AuthUser, @Body() dto: SetStatusDto) {
    return this.driver.setOnline(user.id, dto.isOnline);
  }

  @Get('requests')
  requests(@CurrentUser() user: AuthUser): Promise<WaitingRequest[]> {
    return this.driver.waitingRequests(user.id);
  }

  @Post('requests/:id/accept')
  @HttpCode(HttpStatus.OK)
  accept(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PoolView> {
    return this.driver.accept(user.id, id);
  }

  @Get('pool')
  pool(@CurrentUser() user: AuthUser): Promise<PoolView | null> {
    return this.driver.currentPool(user.id);
  }

  @Post('pool/arrive')
  @HttpCode(HttpStatus.OK)
  arrive(@CurrentUser() user: AuthUser): Promise<PoolView> {
    return this.driver.arrive(user.id);
  }

  @Post('pool/start')
  @HttpCode(HttpStatus.OK)
  start(@CurrentUser() user: AuthUser): Promise<PoolView> {
    return this.driver.start(user.id);
  }

  @Post('pool/complete')
  @HttpCode(HttpStatus.OK)
  complete(@CurrentUser() user: AuthUser): Promise<PoolView> {
    return this.driver.complete(user.id);
  }

  @Post('pool/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() user: AuthUser,
    @Body() dto: CancelPoolDto,
  ): Promise<PoolView> {
    return this.driver.cancel(user.id, dto.reason);
  }

  @Get('pools')
  history(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationDto,
  ): Promise<Page<PoolView>> {
    return this.driver.history(user.id, query);
  }
}
