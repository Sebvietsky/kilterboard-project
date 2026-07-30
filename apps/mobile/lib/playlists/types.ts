// Aligné sur PlaylistSummaryDto (GET /playlists/me).
// Pas de champ de couverture : l'API n'en expose aucun, ni image de playlist
// ni premier bloc — la liste s'en tient au nom et au compte.
export interface PlaylistSummary {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  isPublic: boolean;
  creatorUsername: string;
  boulderCount: number;
  createdAt: string; // string JSON, PAS Date
}
