// Types du wrapper @/lib/vendor/RangeSlider (voir RangeSlider.js).
// Ne PAS importer rn-range-slider ici : ce fichier fournit les types sans
// référencer le .tsx cassé de la lib.
import { ComponentType, ReactNode } from 'react';
import { StyleProp, ViewStyle } from 'react-native';

export interface RangeSliderProps {
  style?: StyleProp<ViewStyle>;
  min: number;
  max: number;
  step?: number;
  low?: number;
  high?: number;
  disableRange?: boolean;
  floatingLabel?: boolean;
  renderThumb: (name: 'high' | 'low') => ReactNode;
  renderRail: () => ReactNode;
  renderRailSelected: () => ReactNode;
  renderLabel?: (value: number) => ReactNode;
  renderNotch?: () => ReactNode;
  onValueChanged?: (low: number, high: number, byUser: boolean) => void;
  onTouchStart?: (low: number, high: number) => void;
  onTouchEnd?: (low: number, high: number) => void;
}

declare const RangeSlider: ComponentType<RangeSliderProps>;
export default RangeSlider;
