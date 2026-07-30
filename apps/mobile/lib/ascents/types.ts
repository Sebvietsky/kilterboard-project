export type AscentStatus = 'FLASH' | 'SENT' | 'PROJECT';

export type LogAscentPayload = {
  boulderId: number;
  status: AscentStatus;
  feltGradeRank?: number;
  attemptsCount?: number;
  rating?: number;
  sessionId?: number;
};

export type Visibility = 'PUBLIC' | 'PRIVATE';

// Entrée de la mutation : les champs de l'ascension + un éventuel commentaire
// (posté ensuite sur une ressource séparée POST /ascents/:id/notes).
export type LogAscentInput = LogAscentPayload & {
  comment?: string;
  visibility?: Visibility;
};

export type Ascent = {
  id: number;
  status: AscentStatus;
  boulderId: number;
  userId: number;
  createdAt: string;
  updatedAt: string;
  sendDate: string | null;
  wasProject: boolean;
};

export type MyAscent = {
  id: number;
  status: AscentStatus;
  attemptsCount: number;
  feltGrade: { vScale: string; fontScale: string } | null;
  sendDate: string | null;
  createdAt: string;
};

/**
 * Entrée de GET /users/me/projects.
 *
 * C'est une ASCENSION au statut PROJECT, pas un bloc : le bloc y est
 * imbriqué, et amputé. Il n'a notamment PAS d'`id` — la navigation vers le
 * détail passe par `boulderId`, porté par l'ascension elle-même. Ne pas
 * chercher `boulder.id`, il n'existe pas dans cette réponse.
 *
 * Ni `ascentCount`, ni `averageRating`, ni `creatorUsername` non plus : c'est
 * pourquoi la carte de projet n'est pas celle d'Explore.
 */
export type MyProject = {
  id: number;
  boulderId: number;
  attemptsCount: number;
  createdAt: string;
  boulder: {
    name: string;
    grade: { vScale: string; fontScale: string; rank: number };
    angle: { valueDegrees: number };
  };
};
