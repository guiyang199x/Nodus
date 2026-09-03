'use client';

import { useEffect, useState } from 'react';

export type AmbientState = 'on' | 'dim' | 'paused';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** True when the visitor asked the system to reduce motion. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * Ambient loops stop entirely when the tab is hidden. Dimming while the visitor
 * types is handled in CSS through :focus-within, so no state has to cross the
 * layout to reach the decoration.
 */
export function useAmbientState(): AmbientState {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === 'hidden');
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
  return hidden ? 'paused' : 'on';
}
