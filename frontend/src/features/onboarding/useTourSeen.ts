import { useCallback, useState } from 'react';
import { useAuthStore } from '../../store/auth';

function storageKey(userId: number | undefined) {
  return `onboarding_tour_seen_${userId ?? 'anon'}`;
}

export function useTourSeen() {
  const userId = useAuthStore((s) => s.user?.id);

  const [tourSeen, setTourSeen] = useState(() => {
    try {
      return localStorage.getItem(storageKey(userId)) === '1';
    } catch {
      return false;
    }
  });

  const markTourSeen = useCallback(() => {
    setTourSeen(true);
    try {
      localStorage.setItem(storageKey(userId), '1');
    } catch {}
  }, [userId]);

  return { tourSeen, markTourSeen };
}
