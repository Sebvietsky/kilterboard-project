import 'reflect-metadata';
import { rejectedFields, toDto } from '../../../test/dto-validation';
import { FilterBoulderDto } from './filter-boulders.dto';
import { AngleQueryDto } from '../../common/dto/angle-query.dto';

describe('FilterBoulderDto', () => {
  it('accepte une recherche avec seulement une inclinaison', async () => {
    await expect(
      rejectedFields(FilterBoulderDto, { angle: 40 }),
    ).resolves.toEqual([]);
  });

  // Explore est toujours à une inclinaison (décision du 2026-11-06) : sans
  // elle, la carte n'aurait ni cotation ni ascensions à afficher.
  it('exige une inclinaison', async () => {
    await expect(rejectedFields(FilterBoulderDto, {})).resolves.toEqual([
      'angle',
    ]);
  });

  it.each([
    ['sous 20°', 15],
    ['au-delà de 70°', 75],
  ])('refuse une inclinaison %s', async (_label, angle) => {
    await expect(rejectedFields(FilterBoulderDto, { angle })).resolves.toEqual([
      'angle',
    ]);
  });

  // Les bornes de pagination ne sont validées qu'ici : getPaginationParams
  // ne les redouble pas (voir pagination.utils.spec.ts).
  it.each([
    ['une page 0', { page: 0 }, 'page'],
    ['une limite de 0', { limit: 0 }, 'limit'],
    ['une limite au-delà de 100', { limit: 101 }, 'limit'],
  ])('refuse %s', async (_label, query, field) => {
    await expect(
      rejectedFields(FilterBoulderDto, { angle: 40, ...query }),
    ).resolves.toEqual([field]);
  });

  it('accepte une limite de 100', async () => {
    await expect(
      rejectedFields(FilterBoulderDto, { angle: 40, limit: 100 }),
    ).resolves.toEqual([]);
  });

  // La query string arrive en texte : `?limit=50` doit devenir un nombre.
  it('convertit les nombres de la query string', () => {
    expect(toDto(FilterBoulderDto, { limit: '50', angle: '40' })).toMatchObject(
      { limit: 50, angle: 40 },
    );
  });

  // `?tags=crimp` donne une chaîne, `?tags=crimp&tags=dyno` un tableau : le
  // service attend toujours un tableau.
  it('transforme un tag seul en tableau', () => {
    expect(toDto(FilterBoulderDto, { tags: 'crimp' }).tags).toEqual(['crimp']);
  });
});

describe('AngleQueryDto', () => {
  // Like, unlike et retrait de playlist portent sur un bloc à une inclinaison.
  it('refuse une action sans inclinaison', async () => {
    await expect(rejectedFields(AngleQueryDto, {})).resolves.toEqual(['angle']);
  });

  it('convertit l’inclinaison de la query string en nombre', () => {
    expect(toDto(AngleQueryDto, { angle: '50' }).angle).toBe(50);
  });
});
