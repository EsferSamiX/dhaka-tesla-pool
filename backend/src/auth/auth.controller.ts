import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import { CurrentUser, Public } from '../common/decorators/auth.decorators.js';
import { PublicUser, UsersService } from '../users/users.service.js';
import type { AuthUser } from './auth-user.js';
import { AUTH_COOKIE, SESSION_TTL_SECONDS } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import { SignInDto, SignUpDto } from './dto/auth.dto.js';

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

  @Public()
  @Post('signup')
  async signUp(
    @Body() dto: SignUpDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicUser> {
    const { user, token } = await this.auth.signUp(dto);
    this.setSessionCookie(res, token);
    return user;
  }

  @Public()
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

  @Post('signout')
  @HttpCode(HttpStatus.NO_CONTENT)
  signOut(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(AUTH_COOKIE, this.cookieOptions);
  }

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
