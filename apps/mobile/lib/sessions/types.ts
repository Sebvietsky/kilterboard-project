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

export type SessionAscent = {
  createdAt: string;
  id: number;
  boulderId: number;
  status: AscentStatus;
  attemptsCount: number;
  boulder: {
    name: string;
    grade: {
      vScale: string;
      fontScale: string;
      rank: number;
    };
    angle: {
      valueDegrees: number;
    };
  };
};

export type ActiveSession = Session & {
  board: {
    name: string;
    gymName: string | null;
  } | null;
  ascents: SessionAscent[];
};

export type SessionSummary = Session & {
  board: {
    name: string;
    gymName: string | null;
  } | null;
  _count: {
    ascents: number;
  };
};
