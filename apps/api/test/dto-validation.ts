import 'reflect-metadata';
import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validate } from 'class-validator';

/**
 * Le DTO tel que le reçoit le contrôleur : transformé comme par le
 * `ValidationPipe` global (`transform: true`).
 */
export function toDto<T extends object>(
  cls: ClassConstructor<T>,
  plain: Record<string, unknown>,
): T {
  return plainToInstance(cls, plain);
}

/**
 * Propriétés refusées par les décorateurs du DTO. Vide : le DTO passe.
 *
 * On teste les règles portées par le DTO, pas la configuration du pipe :
 * `whitelist` et `forbidNonWhitelisted` (champ inconnu refusé) relèvent des
 * e2e, voir docs/notes/api-tests.md.
 */
export async function rejectedFields<T extends object>(
  cls: ClassConstructor<T>,
  plain: Record<string, unknown>,
): Promise<string[]> {
  const errors = await validate(toDto(cls, plain));
  return errors.map((error) => error.property);
}
