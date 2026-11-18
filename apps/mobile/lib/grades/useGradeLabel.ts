import { useCallback } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import type { GradeSystem } from '@/lib/auth/types';
import { DEFAULT_GRADE_SYSTEM, gradeLabel } from './scale';

// Échelle de l'utilisateur connecté. Lue dans le contexte d'authentification
// (l'identité, toujours chargée) et non dans la query du profil, qu'un écran
// n'a pas forcément ouverte.
export function useGradeSystem(): GradeSystem {
  return useAuth().user?.gradeSystem ?? DEFAULT_GRADE_SYSTEM;
}

// Le serveur n'envoie que des rangs : c'est ici, et seulement ici, qu'un rang
// devient « 6c+ » ou « V5 ». `null` reste `null` (bloc non coté).
export function useGradeLabel(): (
  rank: number | null | undefined,
) => string | null {
  const system = useGradeSystem();
  return useCallback(
    (rank) => (rank == null ? null : gradeLabel(rank, system)),
    [system],
  );
}
