import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const PUBLIC_USER = {
  id: true,
  name: true,
  email: true,
  role: true,
  isOnline: true,
  vehicle: {
    select: { id: true, name: true, plateNumber: true, capacity: true },
  },
} as const;

/** A user as the API returns it. Never includes the password hash. */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: 'PASSENGER' | 'DRIVER';
  isOnline: boolean | null;
  vehicle: {
    id: string;
    name: string;
    plateNumber: string;
    capacity: number;
  } | null;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Includes the password hash; for sign-in only. */
  findByEmailWithHash(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true, passwordHash: true },
    });
  }

  async getPublicUser(id: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: PUBLIC_USER,
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      ...user,
      // Online status only means something for drivers.
      isOnline: user.role === 'DRIVER' ? user.isOnline : null,
    };
  }
}
