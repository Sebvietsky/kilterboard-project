export class BoardSizeSummaryDto {
  id!: number;
  name!: string;
}

// Prise présente sur une taille : hors de son cadre, une prise n'a pas de LED
// et n'apparaît pas.
export class BoardSizeHoldDto {
  id!: number;
  holdCode!: string;
  // Coordonnées Kilter, communes à toutes les tailles du layout
  x!: number;
  y!: number;
  // Numéro de LED envoyé à la board pour allumer la prise
  ledPosition!: number;
}

export class BoardSizeDto {
  id!: number;
  name!: string;
  // Cadre de la taille sur la grille des prises : le client y dessine la board
  edgeLeft!: number;
  edgeRight!: number;
  edgeBottom!: number;
  edgeTop!: number;
  holds!: BoardSizeHoldDto[];
}
