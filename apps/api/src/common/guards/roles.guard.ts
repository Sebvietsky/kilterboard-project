import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../generated/prisma/client';
import { JwtPayload } from '../interfaces/auth-payload.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles: Role[] = this.reflector.getAllAndOverride<Role[]>(
      'roles',
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();

    // Pas d'utilisateur sur la requête : le guard d'authentification n'a pas
    // tourné avant celui-ci. On refuse au lieu de déréférencer — sinon l'ordre
    // des guards devient une condition de sécurité implicite, et l'oublier
    // produit un 500 là où on attend un refus.
    if (!user) return false;

    return requiredRoles.includes(user.role);
  }
}
