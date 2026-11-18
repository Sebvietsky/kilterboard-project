import { create } from 'zustand';

// Durée d'affichage d'un toast. Exportée : un écran qui fige un bouton le
// temps de la confirmation s'aligne dessus, pour que les deux signaux
// disparaissent ensemble.
export const TOAST_VISIBLE_MS = 2500;

type ToastState = {
  // `id` change à chaque appel : deux messages identiques d'affilée restent
  // deux toasts distincts, et le second relance bien le délai d'affichage.
  toast: { id: number; message: string } | null;
  show: (message: string) => void;
  hide: () => void;
};

// Store global et non state d'écran : le toast doit survivre à l'écran qui le
// déclenche (un log suivi d'un retour arrière) et n'a qu'un seul point de
// rendu, ToastHost, monté à la racine.
export const useToastStore = create<ToastState>((set) => ({
  toast: null,
  show: (message) => set({ toast: { id: Date.now(), message } }),
  hide: () => set({ toast: null }),
}));

// Raccourci hors React (callbacks de mutation) : pas besoin de s'abonner au
// store pour seulement y écrire.
export function showToast(message: string): void {
  useToastStore.getState().show(message);
}
