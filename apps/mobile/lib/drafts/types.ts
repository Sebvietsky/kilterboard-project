import type { BoulderStatus, HoldRole } from '../boulders/types';

// Formes de `GET /boulders/drafts` et `GET /boulders/drafts/:id`. Les prises
// sont désignées par leur id, comme dans `PATCH /boulders/:id` : leur
// position se lit dans la taille de board (`GET /board-sizes/:id`).
export interface DraftHold {
  holdId: number;
  role: HoldRole;
}

export interface DraftSummary {
  id: number;
  name: string;
  angleDegrees: number;
  gradeRank: number;
  updatedAt: string; // string JSON, PAS Date
}

export interface Draft extends DraftSummary {
  description: string | null;
  holds: DraftHold[];
  tags: string[]; // slugs
}

// Réponse de `POST /boulders`, `PATCH /boulders/:id` et de la publication.
export interface BoulderWritten {
  id: number;
  status: BoulderStatus;
}
