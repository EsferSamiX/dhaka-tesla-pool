import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';
import { CurrentUser, Public } from '../common/decorators/auth.decorators.js';
import { PublicUser, UsersService } from '../users/users.service.js';
import type { AuthUser } from './auth-user.js';
import {
  AUTH_COOKIE,
  SESSION_TTL_SECONDS,
  SIGN_IN_LIMIT,
  SIGN_UP_LIMIT,
} from './auth.constants.js';
import { AuthService } from './auth.service.js';
import { SignInDto, SignUpDto } from './dto/auth.dto.js';
import { AuthThrottlerGuard } from './guards/auth-throttler.guard.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly cookieOptions: CookieOptions;

  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    config: ConfigService,
  ) {
    this.cookieOptions = {
      httpOnly: true, // not readable from JavaScript
      sameSite: 'lax', // not sent on cross-site POSTs (CSRF)
      secure: config.get('NODE_ENV') === 'production',
      path: '/',
    };
  }

  @ApiOperation({
    summary: 'Create a passenger, or a driver with their vehicle, and sign in',
  })
  @Public()
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: SIGN_UP_LIMIT })
  @Post('signup')
  async signUp(
    @Body() dto: SignUpDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicUser> {
    const { user, token } = await this.auth.signUp(dto);
    this.setSessionCookie(res, token);
    return user;
  }

  @ApiOperation({ summary: 'Sign in and receive the session cookie' })
  @Public()
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: SIGN_IN_LIMIT })
  @Post('signin')
  @HttpCode(HttpStatus.OK)
  async signIn(
    @Body() dto: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicUser> {
    const { user, token } = await this.auth.signIn(dto);
    this.setSessionCookie(res, token);
    return user;
  }

  @ApiOperation({ summary: 'Clear the session cookie' })
  @Post('signout')
  @HttpCode(HttpStatus.NO_CONTENT)
  signOut(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(AUTH_COOKIE, this.cookieOptions);
  }

  @ApiOperation({ summary: 'The signed-in user' })
  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<PublicUser> {
    return this.users.getPublicUser(user.id);
  }

  private setSessionCookie(res: Response, token: string): void {
    res.cookie(AUTH_COOKIE, token, {
      ...this.cookieOptions,
      maxAge: SESSION_TTL_SECONDS * 1000,
    });
  }
}
