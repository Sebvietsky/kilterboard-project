export type AscentStatus = 'FLASH' | 'SENT' | 'PROJECT';

export type LogAscentPayload = {
  boulderId: number;
  status: AscentStatus;
  feltGradeRank?: number;
  attemptsCount?: number;
  rating?: number;
  sessionId?: number;
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
