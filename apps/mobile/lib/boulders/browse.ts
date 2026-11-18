import { useRouter } from 'expo-router';
import { create } from 'zustand';
import { boulderHref } from './href';

// Un bloc d'une liste, à l'inclinaison où la liste l'affiche.
export type BrowseItem = { boulderId: number; angleDegrees: number };

type BrowseStore = {
  // Liste d'où le détail a été ouvert, dans l'ordre affiché : les pages du
  // détail la parcourent (gauche = suivant, droite = précédent).
  items: BrowseItem[];
  setItems: (items: BrowseItem[]) => void;
};

// Store global et non paramètre de route : la liste ne tient pas dans une
// URL.
export const useBrowseStore = create<BrowseStore>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
}));

// Une carte de bloc (Explore, Liked) -> le bloc, à l'inclinaison de la carte.
export function boulderBrowseItem(boulder: {
  id: number;
  angleDegrees: number;
}): BrowseItem {
  return { boulderId: boulder.id, angleDegrees: boulder.angleDegrees };
}

// Une ascension (projet, historique, passage de session) -> son bloc, à
// l'inclinaison de l'ascension.
export function ascentBrowseItem(ascent: {
  boulderId: number;
  angle: { valueDegrees: number };
}): BrowseItem {
  return {
    boulderId: ascent.boulderId,
    angleDegrees: ascent.angle.valueDegrees,
  };
}

function sameItem(a: BrowseItem, b: BrowseItem): boolean {
  return a.boulderId === b.boulderId && a.angleDegrees === b.angleDegrees;
}

// Une seule fois chaque couple (bloc, inclinaison) : un projet travaillé deux
// fois dans une session y fait deux lignes, mais c'est le même détail.
function unique(items: BrowseItem[]): BrowseItem[] {
  return items.filter(
    (item, index) =>
      items.findIndex((other) => sameItem(other, item)) === index,
  );
}

// Place du bloc dans la liste retenue, -1 s'il n'y figure pas (détail ouvert
// hors d'une liste).
export function indexOfBrowseItem(
  items: BrowseItem[],
  item: BrowseItem,
): number {
  return items.findIndex((other) => sameItem(other, item));
}

// Ouvre le détail d'un bloc depuis une liste, en retenant la liste pour le
// swipe. Les listes paginées passent ce qui est chargé : le swipe s'arrête au
// dernier bloc chargé.
export function useOpenBoulder(): (
  items: BrowseItem[],
  current: BrowseItem,
) => void {
  const router = useRouter();
  return (items, current) => {
    useBrowseStore.getState().setItems(unique(items));
    router.push(boulderHref(current.boulderId, current.angleDegrees));
  };
}
