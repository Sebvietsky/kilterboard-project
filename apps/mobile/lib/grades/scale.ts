import type { GradeSystem } from '@/lib/auth/types';

// Mêmes valeurs que la table `grades` (prisma/seed.ts), elle-même reprise de
// `board_difficulty_grades` de Kilter : une ligne par cotation Font, `rank` =
// `difficulty` Kilter. En dur comme ANGLES : une donnée de référence qui ne
// change pas, lue partout, et qu'aucun écran ne devrait attendre de charger.
// Une valeur absente ici ou là-bas donne un 400 au vote.
export const GRADES = [
  { rank: 10, font: '4a', v: 'V0' },
  { rank: 11, font: '4b', v: 'V0' },
  { rank: 12, font: '4c', v: 'V0' },
  { rank: 13, font: '5a', v: 'V1' },
  { rank: 14, font: '5b', v: 'V1' },
  { rank: 15, font: '5c', v: 'V2' },
  { rank: 16, font: '6a', v: 'V3' },
  { rank: 17, font: '6a+', v: 'V3' },
  { rank: 18, font: '6b', v: 'V4' },
  { rank: 19, font: '6b+', v: 'V4' },
  { rank: 20, font: '6c', v: 'V5' },
  { rank: 21, font: '6c+', v: 'V5' },
  { rank: 22, font: '7a', v: 'V6' },
  { rank: 23, font: '7a+', v: 'V7' },
  { rank: 24, font: '7b', v: 'V8' },
  { rank: 25, font: '7b+', v: 'V8' },
  { rank: 26, font: '7c', v: 'V9' },
  { rank: 27, font: '7c+', v: 'V10' },
  { rank: 28, font: '8a', v: 'V11' },
  { rank: 29, font: '8a+', v: 'V12' },
  { rank: 30, font: '8b', v: 'V13' },
  { rank: 31, font: '8b+', v: 'V14' },
  { rank: 32, font: '8c', v: 'V15' },
  { rank: 33, font: '8c+', v: 'V16' },
] as const;

export type GradeEntry = (typeof GRADES)[number];

// Bornes dérivées de GRADES, pas écrites en dur : ajouter une cotation en tête
// ou en queue de la liste suffit, les bornes suivent.
export const GRADE_MIN_RANK = GRADES[0].rank;
export const GRADE_MAX_RANK = GRADES[GRADES.length - 1].rank;

// Échelle d'un compte qui ne l'a jamais choisie : même défaut que la base.
export const DEFAULT_GRADE_SYSTEM: GradeSystem = 'FONT_SCALE';

const GRADE_BY_RANK = new Map<number, GradeEntry>(
  GRADES.map((g) => [g.rank, g]),
);

// Libellé d'un rang dans l'échelle choisie. Repli sur la valeur brute plutôt
// que sur un calcul : un calcul se désynchroniserait silencieusement de GRADES.
export function gradeLabel(rank: number, system: GradeSystem): string {
  const grade = GRADE_BY_RANK.get(rank);
  if (!grade) return String(rank);
  return system === 'V_SCALE' ? grade.v : grade.font;
}

// Un cran du sélecteur de plage : une cotation de l'échelle et les rangs
// qu'elle couvre. En Font, un rang par cran ; en V, V3 couvre 6a et 6a+.
export type GradeStep = { label: string; minRank: number; maxRank: number };

export function gradeSteps(system: GradeSystem): GradeStep[] {
  const steps: GradeStep[] = [];
  for (const grade of GRADES) {
    const label = system === 'V_SCALE' ? grade.v : grade.font;
    const last = steps[steps.length - 1];
    // GRADES est trié par rang : les cotations d'un même V se suivent.
    if (last && last.label === label) {
      last.maxRank = grade.rank;
    } else {
      steps.push({ label, minRank: grade.rank, maxRank: grade.rank });
    }
  }
  return steps;
}
