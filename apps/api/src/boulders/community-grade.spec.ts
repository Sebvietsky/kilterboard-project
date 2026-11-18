import {
  COMMUNITY_GRADE_THRESHOLD,
  effectiveGrade,
  isEstimatedGrade,
  medianGrade,
  recomputeAngleGrade,
} from './community-grade';
import { AscentStatus, Prisma } from '../generated/prisma/client';

// Les votes sont des rangs de la table `grades` (V4 = 6, V5 = 7, ...).
const g = (rank: number) => ({ id: rank * 10, rank });
const votes = (...ranks: number[]) => ranks.map(g);

describe('medianGrade', () => {
  it('renvoie null sans vote', () => {
    expect(medianGrade([])).toBeNull();
  });

  it("prend la valeur du milieu d'un nombre impair de votes, quel que soit l'ordre", () => {
    expect(medianGrade(votes(9, 6, 7))).toEqual(g(7));
  });

  // Six votes V4 V4 V5 V6 V7 V7 : entre V5 et V6, on garde V5.
  it("prend la plus facile des deux du milieu d'un nombre pair de votes", () => {
    expect(medianGrade(votes(6, 6, 7, 8, 9, 9))).toEqual(g(7));
  });

  // Médiane et non moyenne : deux avis aberrants ne la déplacent pas.
  it('résiste à deux votes aberrants sur cinq', () => {
    expect(medianGrade(votes(7, 7, 7, 1, 18))).toEqual(g(7));
  });

  it('ne modifie pas la liste reçue', () => {
    const input = votes(9, 6, 7);
    medianGrade(input);
    expect(input.map((v) => v.rank)).toEqual([9, 6, 7]);
  });
});

describe('effectiveGrade', () => {
  const base = g(7); // V5

  // Cotation de départ : celle du créateur à son inclinaison, ou celle de
  // Kilter à une inclinaison cotée d'un bloc importé. Même règle pour les deux.
  describe('avec une cotation de départ', () => {
    it('garde la cotation de départ sans vote', () => {
      expect(effectiveGrade([], base)).toEqual(base);
    });

    it('garde la cotation de départ sous le seuil, même si les votes divergent', () => {
      const under = votes(
        ...Array<number>(COMMUNITY_GRADE_THRESHOLD - 1).fill(10),
      );
      expect(effectiveGrade(under, base)).toEqual(base);
    });

    it('passe à la médiane des votes au seuil', () => {
      const atThreshold = votes(
        ...Array<number>(COMMUNITY_GRADE_THRESHOLD).fill(10),
      );
      expect(effectiveGrade(atThreshold, base)).toEqual(g(10));
    });
  });

  describe('sans cotation de départ', () => {
    it('ne donne aucune cotation sans vote', () => {
      expect(effectiveGrade([], null)).toBeNull();
    });

    it('prend la médiane dès le premier vote', () => {
      expect(effectiveGrade(votes(9), null)).toEqual(g(9));
    });
  });
});

describe('isEstimatedGrade', () => {
  it.each([
    ['avec cotation de départ, peu de votes', 2, true, false],
    ['sans cotation de départ, aucun vote', 0, false, false],
    [
      'sans cotation de départ, sous le seuil',
      COMMUNITY_GRADE_THRESHOLD - 1,
      false,
      true,
    ],
    [
      'sans cotation de départ, au seuil',
      COMMUNITY_GRADE_THRESHOLD,
      false,
      false,
    ],
  ])('%s', (_label, votesCount, hasBaseGrade, expected) => {
    expect(isEstimatedGrade(votesCount, hasBaseGrade)).toBe(expected);
  });
});

describe('recomputeAngleGrade', () => {
  const db = {
    $queryRaw: jest.fn(),
    boulderAngle: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
    ascent: { findMany: jest.fn() },
  };
  const run = (angleId: number) =>
    recomputeAngleGrade(db as unknown as Prisma.TransactionClient, 1, angleId);

  // La ligne lue porte sa propre cotation de départ, ou aucune.
  const withBase = (baseGrade: { id: number; rank: number } | null) =>
    db.boulderAngle.findUniqueOrThrow.mockResolvedValue({ baseGrade });
  const withVotes = (...ranks: number[]) =>
    db.ascent.findMany.mockResolvedValue(
      votes(...ranks).map((feltGrade) => ({ feltGrade })),
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function written(): { gradeId: number | null; votesCount: number } {
    const [arg] = db.boulderAngle.update.mock.calls[0] as [
      { data: { gradeId: number | null; votesCount: number } },
    ];
    return arg.data;
  }

  // Le verrou doit précéder la lecture des votes, sinon il ne protège rien.
  it('verrouille la ligne avant de lire les votes', async () => {
    withBase(null);
    withVotes();

    await run(5);

    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      db.ascent.findMany.mock.invocationCallOrder[0],
    );
  });

  it("ne compte que les grades ressentis d'envois, à cette inclinaison", async () => {
    withBase(null);
    withVotes();

    await run(7);

    const [arg] = db.ascent.findMany.mock.calls[0] as [{ where: unknown }];
    expect(arg.where).toEqual({
      boulderId: 1,
      angleId: 7,
      status: { in: [AscentStatus.SENT, AscentStatus.FLASH] },
      feltGradeId: { not: null },
    });
  });

  // La cotation de départ est celle de la ligne recalculée, pas celle du
  // créateur sur `boulders` : une autre inclinaison peut avoir la sienne.
  it('lit la cotation de départ de cette inclinaison', async () => {
    withBase(null);
    withVotes();

    await run(7);

    const [arg] = db.boulderAngle.findUniqueOrThrow.mock.calls[0] as [
      { where: unknown },
    ];
    expect(arg.where).toEqual({
      boulderId_angleId: { boulderId: 1, angleId: 7 },
    });
  });

  // Le cas d'un bloc importé : la cotation Kilter à 45° résiste à un vote.
  it('garde la cotation de départ sous le seuil', async () => {
    withBase(g(7));
    withVotes(10, 10);

    await run(7);

    expect(written()).toEqual({ gradeId: g(7).id, votesCount: 2 });
  });

  it('passe à la médiane au seuil, même avec une cotation de départ', async () => {
    withBase(g(7));
    withVotes(...Array<number>(COMMUNITY_GRADE_THRESHOLD).fill(10));

    await run(7);

    expect(written()).toEqual({
      gradeId: g(10).id,
      votesCount: COMMUNITY_GRADE_THRESHOLD,
    });
  });

  it('écrit la médiane et le nombre de votes sans cotation de départ', async () => {
    withBase(null);
    withVotes(8, 9, 10);

    await run(7);

    expect(written()).toEqual({ gradeId: g(9).id, votesCount: 3 });
  });

  it('remet la cotation à null sans vote ni cotation de départ', async () => {
    withBase(null);
    withVotes();

    await run(7);

    expect(written()).toEqual({ gradeId: null, votesCount: 0 });
  });

  // Recalculer une inclinaison sans vote ne doit pas effacer sa cotation de
  // départ (le recalcul complet du seed:dev passe sur toutes les lignes).
  it('garde la cotation de départ sans vote', async () => {
    withBase(g(7));
    withVotes();

    await run(7);

    expect(written()).toEqual({ gradeId: g(7).id, votesCount: 0 });
  });
});
