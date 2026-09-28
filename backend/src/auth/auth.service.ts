import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PublicUser, UsersService } from '../users/users.service.js';
import type { JwtPayload } from './auth-user.js';
import { BCRYPT_ROUNDS } from './auth.constants.js';
import { SignInDto, SignUpDto } from './dto/auth.dto.js';

// Compared against when the email doesn't exist, so a missing account takes
// as long to reject as a wrong password and can't be detected by timing.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', BCRYPT_ROUNDS);

export interface Session {
  user: PublicUser;
  token: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async signUp(dto: SignUpDto): Promise<Session> {
    if (dto.role === 'DRIVER' && !dto.vehicle) {
      throw new BadRequestException('Drivers must register a vehicle');
    }
    if (dto.role === 'PASSENGER' && dto.vehicle) {
      throw new BadRequestException('Passengers cannot register a vehicle');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    try {
      // User and vehicle are created together or not at all.
      const { id } = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
          role: dto.role,
          vehicle: dto.vehicle ? { create: dto.vehicle } : undefined,
        },
        select: { id: true },
      });
      return this.createSession(id);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Email or plate number is already registered',
        );
      }
      throw error;
    }
  }

  async signIn(dto: SignInDto): Promise<Session> {
    const user = await this.users.findByEmailWithHash(dto.email);
    const valid = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? DUMMY_HASH,
    );
    // Same message either way, so the response doesn't reveal which emails exist.
    if (!user || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.createSession(user.id);
  }

  private async createSession(userId: string): Promise<Session> {
    const user = await this.users.getPublicUser(userId);
    const payload: JwtPayload = { sub: user.id, role: user.role };
    return { user, token: await this.jwt.signAsync(payload) };
  }
}
