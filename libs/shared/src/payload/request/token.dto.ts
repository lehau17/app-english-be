import { UserRole } from '@prisma/client';

export interface JwtPayload {
  jti: string;

  role: UserRole;

  sub: string;

  email?: string;

  deviceToken?: string;

  iat?: number;

  exp?: number;

  userAgent?: string;
}

export class CreateJwtPayload {
  role: UserRole;
  sub: string;
  email?: string;
}
