import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from '@tanstack/react-query';
import {
  Ascent,
  AscentStatus,
  LogAscentInput,
  MyAscent,
  MyProject,
  UpdateAscentInput,
} from './types';
import { api } from '../api/client';
import { boulderKeys } from '../boulders/keys';
import { ascentKeys } from './keys';

export function useLogAscent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ comment, visibility, ...ascent }: LogAscentInput) => {
      const created = await api.post<Ascent>('/ascents', ascent);
      if (comment?.trim()) {
        await api.post(`/ascents/${created.id}/notes`, {
          content: comment.trim(),
          visibility: visibility ?? 'PRIVATE',
        });
      }
      return created;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: boulderKeys.detail(variables.boulderId),
      });
      queryClient.invalidateQueries({
        queryKey: boulderKeys.lists(),
      });
      queryClient.invalidateQueries({
        queryKey: ascentKeys.byBoulder(variables.boulderId),
      });
      // Logger une ascension ouvre un projet ou en referme un : la liste de
      // Library est périmée dans les deux cas.
      queryClient.invalidateQueries({
        queryKey: ascentKeys.myProjects(),
      });
    },
  });
}

/**
 * Enregistre une séance sur un projet, ou le clôt en envoi.
 *
 * Même forme que useLogAscent : la note passe par une ressource séparée
 * (POST /ascents/:id/notes), donc deux appels enchaînés. Le commentaire est
 * envoyé APRÈS le PATCH — si le PATCH échoue, aucune note orpheline ne reste
 * accrochée à une ascension qui n'a pas bougé.
 */
export function useUpdateAscent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ascentId,
      boulderId: _boulderId,
      comment,
      visibility,
      ...patch
    }: UpdateAscentInput) => {
      const updated = await api.patch<Ascent>(`/ascents/${ascentId}`, patch);
      if (comment?.trim()) {
        await api.post(`/ascents/${ascentId}/notes`, {
          content: comment.trim(),
          visibility: visibility ?? 'PRIVATE',
        });
      }
      return updated;
    },
    onSuccess: (_data, variables) => {
      // Le détail du bloc porte le compteur d'ascensions et les commentaires
      // publics ; la liste, le statut ; myProjects, la ligne du projet — qui
      // en sort quand on le clôt.
      queryClient.invalidateQueries({
        queryKey: boulderKeys.detail(variables.boulderId),
      });
      queryClient.invalidateQueries({ queryKey: boulderKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: ascentKeys.byBoulder(variables.boulderId),
      });
      queryClient.invalidateQueries({ queryKey: ascentKeys.myProjects() });
    },
  });
}

export function fetchMyAscentsOnBoulder(
  boulderId: number,
): Promise<MyAscent[]> {
  return api.get<MyAscent[]>(`/ascents/me/${boulderId}`);
}

export function useMyAscentsOnBoulder(
  boulderId: number,
): UseQueryResult<MyAscent[], Error> {
  return useQuery({
    enabled: Number.isFinite(boulderId),
    queryKey: ascentKeys.byBoulder(boulderId),
    queryFn: () => fetchMyAscentsOnBoulder(boulderId),
  });
}

export function fetchMyProjects(): Promise<MyProject[]> {
  return api.get<MyProject[]>('/users/me/projects');
}

// Route dans le module Users côté backend, mais query rangée ici : la donnée
// EST une ascension, et sa clé descend de ascentKeys — c'est l'invalidation
// qui doit rester cohérente, pas le préfixe d'URL.
// Non paginé côté serveur, d'où un useQuery simple.
export function useMyProjects(): UseQueryResult<MyProject[], Error> {
  return useQuery({
    queryKey: ascentKeys.myProjects(),
    queryFn: fetchMyProjects,
  });
}

export function deriveAvailableStatuses(ascents: MyAscent[]): AscentStatus[] {
  const hasAnyAscent = ascents.length > 0;
  const hasActiveProject = ascents.some((a) => a.status === 'PROJECT');

  // Un projet actif ne ferme plus le formulaire : il le réduit à PROJECT, où
  // l'écran bascule en gestion du projet en cours (enregistrer une séance ou
  // le clore). Renvoyer [] laissait l'utilisateur sans aucune action — le seul
  // chemin sans issue de l'app.
  if (hasActiveProject) return ['PROJECT'];
  if (hasAnyAscent) return ['SENT'];

  return ['FLASH', 'SENT', 'PROJECT'];
}
