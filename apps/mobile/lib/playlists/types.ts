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

// Playlist vue depuis un bloc (GET /playlists/me?boulderId=…) : le serveur
// ajoute `containsBoulder`. Type distinct plutôt qu'un champ optionnel sur
// PlaylistSummary : ici il est toujours présent, et l'écran n'a pas à traiter
// un `undefined` qui ne peut pas arriver.
export type PlaylistForBoulder = PlaylistSummary & {
  containsBoulder: boolean;
};

// Réponse de POST /playlists.
export type CreatedPlaylist = {
  id: number;
  name: string;
  description: string | null;
  isPublic: boolean;
  createdAt: string;
};

// Aligné sur PlaylistDetailDto (GET /playlists/:id). Le bloc y est aplati :
// `vScale` et `angleDegrees` sont au premier niveau, pas sous `grade`/`angle`
// comme dans les réponses d'ascension.
export type PlaylistDetail = PlaylistSummary & {
  boulders: {
    position: number | null;
    addedAt: string;
    boulder: {
      id: number;
      name: string;
      vScale: string;
      fontScale: string;
      angleDegrees: number;
    };
  }[];
};
