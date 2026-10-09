import { AscentStatus } from '../ascents/types';

export type Session = {
  title: string | null;
  note: string | null;
  startedAt: string;
  endedAt: string | null;
  isShared: boolean;
  createdAt: string;
  id: number;
  userId: number;
  boardId: number | null;
};

/**
 * Un passage sur un bloc pendant une session : une ligne par log.
 *
 * Ce n'est PAS une ascension. Le même bloc revient autant de fois qu'il a été
 * travaillé — un projet essayé deux fois dans la séance donne deux passages
 * qui pointent vers la même `ascent.id`. La clé de liste est donc `id` (celui
 * du passage), jamais `ascent.id`.
 *
 * `status` et `attempts` sont ceux du passage : PROJECT tant que le bloc
 * résiste, SENT le jour où il tombe, avec les essais de cette fois-là et non
 * le cumul.
 */
export type SessionEntry = {
  id: number;
  status: AscentStatus;
  attempts: number;
  createdAt: string;
  ascent: {
    id: number;
    boulderId: number;
    wasProject: boolean;
    boulder: {
      name: string;
      grade: { vScale: string; fontScale: string; rank: number };
      angle: { valueDegrees: number };
    };
  };
};

export type ActiveSession = Session & {
  board: {
    name: string;
    gymName: string | null;
  } | null;
  entries: SessionEntry[];
};

export type SessionSummary = Session & {
  board: {
    name: string;
    gymName: string | null;
  } | null;
  _count: {
    entries: number;
  };
};
