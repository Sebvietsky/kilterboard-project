import { useEffect, useState } from 'react';

/**
 * Secondes écoulées depuis `startedAt`.
 *
 * Le chrono est DÉRIVÉ de la date de début, jamais compté : l'intervalle ne
 * sert qu'à redemander un rendu. Un compteur incrémenté chaque seconde
 * dériverait dès que l'app passe en arrière-plan (les timers JS y sont
 * suspendus) et repartirait de zéro au remontage de l'écran.
 */
export function useElapsedSeconds(startedAt: string): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // max(0) : l'horloge du téléphone peut retarder sur celle du serveur.
  return Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
}

export function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}
