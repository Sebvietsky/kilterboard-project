import { ForbiddenException, NotFoundException } from '@nestjs/common';

export function assertFound<T>(
  ressource: T | null,
  name: string,
): asserts ressource is T {
  if (!ressource) throw new NotFoundException(`${name} not found`);
}

export function assertOwnerShip(
  ressource: { userId: number },
  userId: number,
): void {
  if (ressource.userId !== userId) throw new ForbiddenException();
}
