import { useCallback, useState } from 'react';
import { useAuthStore } from '../../store/auth';

export function tourSeenStorageKey(userId: number | undefined) {
  return `onboarding_tour_seen_${userId ?? 'anon'}`;
}

// Пишем в localStorage напрямую, без реактивного setState — чтобы пометить тур
// «просмотренным» сразу по факту успеха, не вызывая при этом немедленное
// скрытие ещё показываемой панели в текущем смонтированном экземпляре.
// Это страховка на случай неожиданного перемонтирования компонента тура:
// свежий монтаж прочитает актуальный флаг и не покажет тур заново с начала.
export function persistTourSeen(userId: number | undefined) {
  try {
    localStorage.setItem(tourSeenStorageKey(userId), '1');
  } catch {}
}

export function useTourSeen() {
  const userId = useAuthStore((s) => s.user?.id);

  const [tourSeen, setTourSeen] = useState(() => {
    try {
      return localStorage.getItem(tourSeenStorageKey(userId)) === '1';
    } catch {
      return false;
    }
  });

  const markTourSeen = useCallback(() => {
    setTourSeen(true);
    persistTourSeen(userId);
  }, [userId]);

  return { tourSeen, markTourSeen };
}
