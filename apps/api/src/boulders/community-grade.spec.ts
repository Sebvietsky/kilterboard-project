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
  const creator = g(7); // V5

  describe("à l'inclinaison du créateur", () => {
    it('garde la cotation du créateur sans vote', () => {
      expect(effectiveGrade([], creator)).toEqual(creator);
    });

    it('garde la cotation du créateur sous le seuil, même si les votes divergent', () => {
      const under = votes(
        ...Array<number>(COMMUNITY_GRADE_THRESHOLD - 1).fill(10),
      );
      expect(effectiveGrade(under, creator)).toEqual(creator);
    });

    it('passe à la médiane des votes au seuil', () => {
      const atThreshold = votes(
        ...Array<number>(COMMUNITY_GRADE_THRESHOLD).fill(10),
      );
      expect(effectiveGrade(atThreshold, creator)).toEqual(g(10));
    });
  });

  describe('à une autre inclinaison', () => {
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
    ['inclinaison du créateur, peu de votes', 2, true, false],
    ['autre inclinaison, aucun vote', 0, false, false],
    [
      'autre inclinaison, sous le seuil',
      COMMUNITY_GRADE_THRESHOLD - 1,
      false,
      true,
    ],
    ['autre inclinaison, au seuil', COMMUNITY_GRADE_THRESHOLD, false, false],
  ])('%s', (_label, votesCount, isCreatorAngle, expected) => {
    expect(isEstimatedGrade(votesCount, isCreatorAngle)).toBe(expected);
  });
});

describe('recomputeAngleGrade', () => {
  const db = {
    $queryRaw: jest.fn(),
    boulder: { findUniqueOrThrow: jest.fn() },
    ascent: { findMany: jest.fn() },
    boulderAngle: { update: jest.fn() },
  };
  const run = (angleId: number) =>
    recomputeAngleGrade(db as unknown as Prisma.TransactionClient, 1, angleId);

  beforeEach(() => {
    jest.clearAllMocks();
    // Bloc créé à l'inclinaison 5, coté V5 par son créateur.
    db.boulder.findUniqueOrThrow.mockResolvedValue({
      angleId: 5,
      grade: g(7),
    });
  });

  function written(): { gradeId: number | null; votesCount: number } {
    const [arg] = db.boulderAngle.update.mock.calls[0] as [
      { data: { gradeId: number | null; votesCount: number } },
    ];
    return arg.data;
  }

  // Le verrou doit précéder la lecture des votes, sinon il ne protège rien.
  it('verrouille la ligne avant de lire les votes', async () => {
    db.ascent.findMany.mockResolvedValue([]);

    await run(5);

    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      db.ascent.findMany.mock.invocationCallOrder[0],
    );
  });

  it("ne compte que les grades ressentis d'envois, à cette inclinaison", async () => {
    db.ascent.findMany.mockResolvedValue([]);

    await run(7);

    const [arg] = db.ascent.findMany.mock.calls[0] as [{ where: unknown }];
    expect(arg.where).toEqual({
      boulderId: 1,
      angleId: 7,
      status: { in: [AscentStatus.SENT, AscentStatus.FLASH] },
      feltGradeId: { not: null },
    });
  });

  it('garde la cotation du créateur sous le seuil à son inclinaison', async () => {
    db.ascent.findMany.mockResolvedValue(
      votes(10, 10).map((feltGrade) => ({ feltGrade })),
    );

    await run(5);

    expect(written()).toEqual({ gradeId: g(7).id, votesCount: 2 });
  });

  it('écrit la médiane et le nombre de votes ailleurs', async () => {
    db.ascent.findMany.mockResolvedValue(
      votes(8, 9, 10).map((feltGrade) => ({ feltGrade })),
    );

    await run(7);

    expect(written()).toEqual({ gradeId: g(9).id, votesCount: 3 });
  });

  it('remet la cotation à null sans vote hors inclinaison du créateur', async () => {
    db.ascent.findMany.mockResolvedValue([]);

    await run(7);

    expect(written()).toEqual({ gradeId: null, votesCount: 0 });
  });
});
