import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { UserRole } from '../../generated/prisma/enums.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class VehicleDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z0-9-]{1,20}$/, {
    message: 'plateNumber must be 1-20 letters, digits or dashes',
  })
  plateNumber: string;

  @IsInt()
  @Min(1)
  @Max(6)
  capacity: number;
}

export class SignUpDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(255)
  email: string;

  // bcrypt ignores bytes after 72, so longer passwords are rejected.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @IsEnum(UserRole)
  role: UserRole;

  /** Required for drivers, not allowed for passengers (checked in the service). */
  @IsOptional()
  @ValidateNested()
  @Type(() => VehicleDto)
  vehicle?: VehicleDto;
}

export class SignInDto {
  @Transform(normalizeEmail)
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password: string;
}
