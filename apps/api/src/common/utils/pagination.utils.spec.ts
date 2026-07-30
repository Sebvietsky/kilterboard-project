import { getPaginationParams, getSafeOrderBy } from './pagination.utils';

// Fonctions pures : aucun mock, aucun module Nest à compiler.
// Les bornes (page ≥ 1, limit ≤ 100) sont validées en amont par les DTO et le
// ValidationPipe global, qui répondent 400. On ne les redouble pas ici : un
// clamp silencieux serait moins bon qu'un refus explicite, et deux vérités
// pour une même règle finissent par diverger.

describe('getPaginationParams', () => {
  it('applique les valeurs par défaut : page 1, 20 par page', () => {
    expect(getPaginationParams()).toEqual({
      skip: 0,
      take: 20,
      page: 1,
      limit: 20,
    });
  });

  it("n'écrase pas une limite fournie par un défaut", () => {
    expect(getPaginationParams(undefined, 50)).toMatchObject({
      take: 50,
      limit: 50,
      page: 1,
    });
  });

  // skip = (page - 1) × limit : c'est le décalage, pas le numéro de page.
  // L'erreur classique est un skip décalé d'une page entière.
  it.each([
    [1, 10, 0],
    [2, 10, 10],
    [3, 25, 50],
  ])('page %i avec %i par page saute %i éléments', (page, limit, skip) => {
    expect(getPaginationParams(page, limit)).toMatchObject({
      skip,
      take: limit,
    });
  });

  it('renvoie page et limit tels quels, pour que le meta les reflète', () => {
    expect(getPaginationParams(4, 15)).toEqual({
      skip: 45,
      take: 15,
      page: 4,
      limit: 15,
    });
  });
});

describe('getSafeOrderBy', () => {
  // Ce champ finit dans un orderBy Prisma. L'allowlist est ce qui empêche une
  // valeur arbitraire de la query string d'y arriver : c'est une protection,
  // et une protection non testée n'en est pas une.
  const allowed = ['createdAt', 'username', 'email'] as const;

  it('accepte un champ de la liste', () => {
    expect(getSafeOrderBy(allowed, 'username')).toBe('username');
  });

  it.each([
    ['un champ absent de la liste', 'passwordHash'],
    ['une valeur vide', ''],
    ['une expression arbitraire', 'id; DROP TABLE users'],
  ])('replie %s sur le défaut', (_label, value) => {
    expect(getSafeOrderBy(allowed, value, 'createdAt')).toBe('createdAt');
  });

  it('replie une valeur absente sur le défaut', () => {
    expect(getSafeOrderBy(allowed, undefined, 'email')).toBe('email');
  });

  // Sans défaut explicite, c'est le premier champ autorisé qui sert de repli —
  // jamais undefined, qui laisserait l'orderBy Prisma sans valeur.
  it('utilise le premier champ autorisé quand aucun défaut nest donné', () => {
    expect(getSafeOrderBy(allowed, 'nope')).toBe('createdAt');
  });
});
