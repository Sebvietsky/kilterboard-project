// Formes de `GET /board-sizes` et `GET /board-sizes/:id` (module `boards`).
export interface BoardSizeSummary {
  id: number;
  name: string;
}

// Prise dans le cadre d'une taille, en coordonnées Kilter (y vers le haut).
export interface BoardSizeHold {
  id: number;
  holdCode: string;
  x: number;
  y: number;
  ledPosition: number;
}

export interface BoardSize {
  id: number;
  name: string;
  edgeLeft: number;
  edgeRight: number;
  edgeBottom: number;
  edgeTop: number;
  holds: BoardSizeHold[];
}
