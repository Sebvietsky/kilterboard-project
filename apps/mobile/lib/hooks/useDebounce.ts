import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer); // annule le timer si value rechange avant delay
  }, [value, delay]);
  return debounced;
}
