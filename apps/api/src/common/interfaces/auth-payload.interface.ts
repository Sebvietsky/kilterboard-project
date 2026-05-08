import { Role } from '../../generated/prisma/enums';

export interface JwtPayload {
  userId: number;
  role: Role;
  username: string;
}
