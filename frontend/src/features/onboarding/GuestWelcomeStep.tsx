import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Course } from '../../types';
import { useTourSeen } from './useTourSeen';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

// visualViewport точнее window.innerWidth на мобильном Chrome — учитывает
// скрытие/появление адресной строки и открытую клавиатуру.
function viewportWidth(): number {
  return window.visualViewport?.width ?? window.innerWidth;
}

// getBoundingClientRect() всегда в координатах layout-вьюпорта. visualViewport
// может быть сдвинут относительно него (offsetTop/offsetLeft), а не только
// иметь другие height/width — приводим границу видимой области к тем же
// координатам, что и getBoundingClientRect().
function visualViewportBounds() {
  const vv = window.visualViewport;
  if (!vv) return { top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight };
  return {
    top: vv.offsetTop,
    left: vv.offsetLeft,
    right: vv.offsetLeft + vv.width,
    bottom: vv.offsetTop + vv.height,
  };
}

// Target — сразу все карточки курсов, помеченные data-tour="demo-courses"
// (обычно ровно Python + SQL, а не весь грид — в нём могут быть и другие,
// недоступные в демо, курсы). Объединяем их реальные прямоугольники в один
// общий bounding box, чтобы подсветка охватывала обе карточки сразу.
function getTargetRect(): Rect | null {
  const els = Array.from(document.querySelectorAll('[data-tour="demo-courses"]')) as HTMLElement[];
  if (els.length === 0) return null;
  const rects = els.map((el) => el.getBoundingClientRect());
  const left0 = Math.min(...rects.map((r) => r.left));
  const top0 = Math.min(...rects.map((r) => r.top));
  const right0 = Math.max(...rects.map((r) => r.right));
  const bottom0 = Math.max(...rects.map((r) => r.bottom));
  if (right0 - left0 <= 0 || bottom0 - top0 <= 0) return null;
  const vb = visualViewportBounds();
  const padding = 10;
  const left = Math.max(vb.left + 4, left0 - padding);
  const top = Math.max(vb.top + 4, top0 - padding);
  const right = Math.min(vb.right - 4, right0 + padding);
  const bottom = Math.min(vb.bottom - 4, bottom0 + padding);
  if (right <= left || bottom <= top) return null;
  return { top, left, width: right - left, height: bottom - top };
}

// Не показываем рамку толщиной в несколько пикселей (переходное состояние
// layout, ещё не отрисованный контент) — только реальный, заметный target.
const MIN_SPOTLIGHT_HEIGHT = 16;

interface Props {
  courses: Course[];
}

export default function GuestWelcomeStep({ courses }: Props) {
  const navigate = useNavigate();
  const { tourSeen, markTourSeen } = useTourSeen();
  const [dismissed, setDismissed] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);

  const pythonCourse = useMemo(() => courses.find((c) => /python/i.test(c.title)), [courses]);
  const sqlCourse = useMemo(() => courses.find((c) => /sql/i.test(c.title)), [courses]);

  const visible = !tourSeen && !dismissed && Boolean(pythonCourse || sqlCourse);

  // Курсы уже находятся в самом верху страницы (первый контент CoursesPage),
  // поэтому оба видны сразу при загрузке — никакой автопрокрутки не нужно.
  // Карточка помощника — обычный блок в потоке страницы сразу под гридом
  // курсов (см. рендер ниже и порядок в CoursesPage), поэтому единственное,
  // что нужно отслеживать здесь — актуальную позицию подсвечиваемых карточек
  // относительно вьюпорта (она меняется при скролле обычной страницы).
  useEffect(() => {
    if (!visible) return;

    const update = () => {
      const next = getTargetRect();
      // Пока хотя бы часть подсвечиваемых карточек реально видна во
      // вьюпорте — показываем рамку. Как только пользователь проскроллил
      // мимо них (например, вниз — к самой карточке помощника), подсветку
      // просто убираем: она уже сослужила свою роль и не должна ничего
      // затемнять поверх карточки.
      if (next && next.height >= MIN_SPOTLIGHT_HEIGHT && next.width >= MIN_SPOTLIGHT_HEIGHT) {
        setRect(next);
      } else {
        setRect(null);
      }
    };

    update();
    const raf1 = requestAnimationFrame(() => requestAnimationFrame(update));

    const els = Array.from(document.querySelectorAll('[data-tour="demo-courses"]'));
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    els.forEach((el) => resizeObserver?.observe(el));

    const scrollRoot = document.querySelector('.sf-main');
    const root = document.getElementById('root');
    const mutationObserver = new MutationObserver(update);
    if (root) mutationObserver.observe(root, { childList: true, subtree: true, attributes: true, characterData: true });

    // Таймер — только резервный механизм, не основной канал обновления.
    const interval = window.setInterval(update, 500);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { capture: true, passive: true });
    scrollRoot?.addEventListener('scroll', update, { passive: true });
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);

    return () => {
      cancelAnimationFrame(raf1);
      window.clearInterval(interval);
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, { capture: true } as EventListenerOptions);
      scrollRoot?.removeEventListener('scroll', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, [visible]);

  if (!visible) return null;

  function pick(course?: Course) {
    setDismissed(true);
    if (course) navigate(`/course/${course.id}`);
  }

  function skip() {
    markTourSeen();
    setDismissed(true);
  }

  const isMobile = viewportWidth() <= 760;

  return (
    <>
      {rect ? (
        <div className="fixed inset-0 z-[10050] pointer-events-none" role="dialog" aria-modal="true">
          <div className="fixed bg-black/60 pointer-events-auto" style={{ top: 0, left: 0, width: '100vw', height: Math.max(0, rect.top) }} />
          <div className="fixed bg-black/60 pointer-events-auto" style={{ top: rect.top, left: 0, width: Math.max(0, rect.left), height: rect.height }} />
          <div className="fixed bg-black/60 pointer-events-auto" style={{ top: rect.top, left: rect.left + rect.width, width: Math.max(0, viewportWidth() - rect.left - rect.width), height: rect.height }} />
          {/* На мобильном карточка — обычный блок в потоке страницы сразу
              под курсами, разрыва между вырезом и карточкой физически нет,
              поэтому снизу намеренно ничего не затемняем (иначе полупрозрачный
              слой оказался бы поверх самой карточки). На десктопе карточка —
              fixed bottom sheet, ниже выреза остаётся обычный контент
              страницы — там нижнюю полосу нужно закрашивать до конца экрана,
              как и раньше, иначе получается пустой незатемнённый разрыв. */}
          {!isMobile && (
            <div className="fixed bg-black/60 pointer-events-auto" style={{ top: rect.top + rect.height, left: 0, width: '100vw', height: Math.max(0, window.innerHeight - rect.top - rect.height) }} />
          )}
          <div
            className="fixed rounded-2xl border-2 border-primary-500 pointer-events-none"
            style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, boxShadow: '0 0 0 4px rgba(59,130,246,0.25)' }}
          />
        </div>
      ) : (
        // Пока рамка ещё не измерена/не найдена — на десктопе, как и раньше,
        // держим сплошную тёмную заливку (не даём мелькать голой странице
        // без подсветки и без затемнения). На мобильном оставляем как есть:
        // без подсветки просто ничего не показываем.
        !isMobile && <div className="fixed inset-0 z-[10050] bg-black/60 pointer-events-auto" />
      )}

      {/* Мобильный: обычный блок в нормальном потоке документа — рендерится
          в CoursesPage сразу после грида курсов, поэтому просто продолжает
          страницу вниз (без position: fixed/absolute, без своего overflow —
          скроллится вся страница целиком через .sf-main). Десктоп оставлен
          как был — фиксированная плашка снизу экрана. */}
      <div
        className={isMobile ? 'card shadow-xl mt-4' : 'card shadow-xl pointer-events-auto'}
        style={
          isMobile
            ? undefined
            : { position: 'fixed', left: 16, right: 16, bottom: 16, maxWidth: 640, margin: '0 auto', maxHeight: '50vh', overflowY: 'auto', zIndex: 10060 }
        }
      >
        <div className="flex items-start gap-3">
          <div className="hidden sm:flex shrink-0 w-9 h-9 rounded-lg bg-primary-50 text-primary-600 items-center justify-center font-bold">
            {'</>'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wide text-primary-500 mb-0.5">
              IT Практикум · демо-режим
            </div>
            <h3 className="text-base font-bold text-dark-700">Добро пожаловать в IT Практикум!</h3>
          </div>
          <button
            type="button"
            onClick={skip}
            aria-label="Закрыть помощника"
            className="shrink-0 w-7 h-7 rounded-md text-surface-400 hover:bg-surface-100 hover:text-dark-700"
          >
            ×
          </button>
        </div>

        <div className="mt-2 ml-0 sm:ml-12 text-sm text-surface-500 leading-snug">
          В демо доступны задачи Python и SQL. Сейчас покажем, как открыть задачу, написать решение,
          отправить его на проверку и посмотреть результат.
        </div>

        <div className="mt-3 ml-0 sm:ml-12 flex flex-col sm:flex-row gap-2">
          {pythonCourse && (
            <button type="button" onClick={() => pick(pythonCourse)} className="w-full sm:flex-1 justify-center btn-primary btn-sm whitespace-normal sm:whitespace-nowrap">
              Перейти к Python
            </button>
          )}
          {sqlCourse && (
            <button type="button" onClick={() => pick(sqlCourse)} className="w-full sm:flex-1 justify-center btn-secondary btn-sm whitespace-normal sm:whitespace-nowrap">
              Перейти к SQL
            </button>
          )}
        </div>
        <button type="button" onClick={skip} className="mt-2 w-full text-center text-xs text-surface-400 hover:text-surface-600 transition-colors">
          Разобраться самостоятельно
        </button>
      </div>
    </>
  );
}
