import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from '../../generated/prisma/client';
import { JwtPayload } from '../interfaces/auth-payload.interface';

// On fabrique un ExecutionContext minimal : le guard n'utilise que le handler,
// la classe et la requête HTTP. Monter un module Nest complet coûterait plus
// cher sans rien vérifier de plus.
function contextWith(user?: JwtPayload): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

const admin: JwtPayload = { userId: 1, role: Role.ADMIN, username: 'root' };
const member: JwtPayload = { userId: 2, role: Role.USER, username: 'seb' };

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function requireRoles(roles: Role[] | undefined) {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);
  }

  // Le guard peut être posé au niveau d'un contrôleur entier : les routes sans
  // @Roles ne doivent pas se retrouver fermées par effet de bord.
  it('laisse passer une route sans @Roles', () => {
    requireRoles(undefined);

    expect(guard.canActivate(contextWith(member))).toBe(true);
  });

  it('laisse passer un utilisateur qui a le rôle requis', () => {
    requireRoles([Role.ADMIN]);

    expect(guard.canActivate(contextWith(admin))).toBe(true);
  });

  it('refuse un utilisateur qui ne l’a pas', () => {
    requireRoles([Role.ADMIN]);

    expect(guard.canActivate(contextWith(member))).toBe(false);
  });

  // Régression : le guard lisait user.role sans vérifier user. Utilisé sans
  // JwtAuthGuard devant lui, il levait un TypeError — donc un 500 là où on
  // attend un refus. L'ordre des guards ne doit pas être une condition de
  // sécurité implicite.
  it('refuse quand aucun utilisateur nest attaché à la requête', () => {
    requireRoles([Role.ADMIN]);

    expect(guard.canActivate(contextWith(undefined))).toBe(false);
  });
});
