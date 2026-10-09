// Heure d'horloge locale (« 6:12 PM » ou « 18:12 » selon les réglages du
// téléphone) à partir d'une date ISO de l'API.
export function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}
