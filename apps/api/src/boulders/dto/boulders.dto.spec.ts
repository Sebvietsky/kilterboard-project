import 'reflect-metadata';
import { rejectedFields, toDto } from '../../../test/dto-validation';
import { FilterBoulderDto } from './filter-boulders.dto';
import { AngleQueryDto } from '../../common/dto/angle-query.dto';
import { CreateBoulderDto } from './create-boulder.dto';
import { UpdateBoulderDto } from './update-boulder.dto';

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

// `count` prises distinctes, pour tester la limite sans buter sur le doublon.
const holdsOf = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ holdId: i + 1, role: 'HAND' }));

describe('CreateBoulderDto', () => {
  const valid = {
    name: 'Crimpy',
    angleDegrees: 40,
    gradeRank: 16,
    holds: [
      { holdId: 1, role: 'START' },
      { holdId: 2, role: 'FINISH' },
    ],
  };

  it('accepte un brouillon complet, sans description', async () => {
    await expect(rejectedFields(CreateBoulderDto, valid)).resolves.toEqual([]);
  });

  it.each(['name', 'angleDegrees', 'gradeRank', 'holds'])(
    'exige %s',
    async (field) => {
      const rest: Record<string, unknown> = { ...valid };
      delete rest[field];
      await expect(rejectedFields(CreateBoulderDto, rest)).resolves.toEqual([
        field,
      ]);
    },
  );

  it('refuse un nom fait seulement d’espaces', async () => {
    await expect(
      rejectedFields(CreateBoulderDto, { ...valid, name: '   ' }),
    ).resolves.toEqual(['name']);
  });

  it('refuse un nom au-delà de 150 caractères', async () => {
    await expect(
      rejectedFields(CreateBoulderDto, { ...valid, name: 'a'.repeat(151) }),
    ).resolves.toEqual(['name']);
  });

  it('refuse un bloc sans prise', async () => {
    await expect(
      rejectedFields(CreateBoulderDto, { ...valid, holds: [] }),
    ).resolves.toEqual(['holds']);
  });

  // Limite de 45 prises (décision du 2026-11-23) : les deux côtés de la
  // borne, pour qu'un 44 ou un 46 dans le DTO fasse échouer un test.
  it('accepte 45 prises', async () => {
    await expect(
      rejectedFields(CreateBoulderDto, { ...valid, holds: holdsOf(45) }),
    ).resolves.toEqual([]);
  });

  it('refuse 46 prises', async () => {
    await expect(
      rejectedFields(CreateBoulderDto, { ...valid, holds: holdsOf(46) }),
    ).resolves.toEqual(['holds']);
  });

  // Une prise n'a qu'un rôle par bloc : le doublon est refusé même avec deux
  // rôles différents.
  it('refuse la même prise deux fois', async () => {
    await expect(
      rejectedFields(CreateBoulderDto, {
        ...valid,
        holds: [
          { holdId: 1, role: 'START' },
          { holdId: 1, role: 'HAND' },
        ],
      }),
    ).resolves.toEqual(['holds']);
  });

  it('refuse un rôle inconnu', async () => {
    await expect(
      rejectedFields(CreateBoulderDto, {
        ...valid,
        holds: [{ holdId: 1, role: 'TOP' }],
      }),
    ).resolves.toEqual(['holds']);
  });

  // START et FINISH ne s'exigent qu'à la publication (décision du
  // 2026-11-18) : un brouillon peut ne pas les avoir encore.
  it('accepte un brouillon sans START ni FINISH', async () => {
    await expect(
      rejectedFields(CreateBoulderDto, {
        ...valid,
        holds: [{ holdId: 1, role: 'HAND' }],
      }),
    ).resolves.toEqual([]);
  });
});

describe('UpdateBoulderDto', () => {
  it('accepte une modification vide', async () => {
    await expect(rejectedFields(UpdateBoulderDto, {})).resolves.toEqual([]);
  });

  it('accepte 45 prises', async () => {
    await expect(
      rejectedFields(UpdateBoulderDto, { holds: holdsOf(45) }),
    ).resolves.toEqual([]);
  });

  it('accepte une cotation seule', async () => {
    await expect(
      rejectedFields(UpdateBoulderDto, { gradeRank: 18 }),
    ).resolves.toEqual([]);
  });

  // Facultatif, mais jamais vide s'il est fourni : l'édition ne doit pas
  // contourner ce que la création exige.
  it.each([
    ['un nom fait seulement d’espaces', { name: '   ' }, 'name'],
    ['une liste de prises vide', { holds: [] }, 'holds'],
    ['46 prises', { holds: holdsOf(46) }, 'holds'],
    [
      'la même prise deux fois',
      {
        holds: [
          { holdId: 1, role: 'START' },
          { holdId: 1, role: 'FINISH' },
        ],
      },
      'holds',
    ],
  ])('refuse %s', async (_label, body, field) => {
    await expect(rejectedFields(UpdateBoulderDto, body)).resolves.toEqual([
      field,
    ]);
  });
});
