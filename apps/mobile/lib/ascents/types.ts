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
