// Heure d'horloge locale (« 6:12 PM » ou « 18:12 » selon les réglages du
// téléphone) à partir d'une date ISO de l'API.
export function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Jour d'une session passée : « Fri, Oct 9 » selon les réglages du téléphone.
export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
