import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Course } from '../../types';
import { useTourSeen } from './useTourSeen';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

// visualViewport точнее window.innerWidth/innerHeight на мобильном Chrome —
// учитывает скрытие/появление адресной строки и открытую клавиатуру.
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

// Подсвечиваем реально занятую детьми область, а не весь grid-контейнер —
// иначе при 2 карточках в 3-колоночной сетке рамка захватывает пустое место
// справа. maxBottom — реальный верхний край bottom sheet минус отступ:
// spotlight никогда не должен продолжаться под карточкой.
function getTargetRect(name: string, maxBottom?: number): Rect | null {
  const el = document.querySelector(`[data-tour="${name}"]`);
  if (!el || !el.isConnected) return null;
  const children = Array.from(el.children) as HTMLElement[];
  const rects = (children.length > 0 ? children : [el]).map((c) => c.getBoundingClientRect());
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
  const bottom = Math.min(maxBottom ?? vb.bottom - 4, bottom0 + padding);
  if (right <= left || bottom <= top) return null;
  return { top, left, width: right - left, height: bottom - top };
}

// Не показываем рамку толщиной в несколько пикселей (переходное состояние
// layout, ещё не отрисованный контент) — только реальные, заметные target'ы.
const MIN_SPOTLIGHT_HEIGHT = 16;

interface Props {
  courses: Course[];
}

export default function GuestWelcomeStep({ courses }: Props) {
  const navigate = useNavigate();
  const { tourSeen, markTourSeen } = useTourSeen();
  const [dismissed, setDismissed] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const pythonCourse = useMemo(() => courses.find((c) => /python/i.test(c.title)), [courses]);
  const sqlCourse = useMemo(() => courses.find((c) => /sql/i.test(c.title)), [courses]);

  const visible = !tourSeen && !dismissed && Boolean(pythonCourse || sqlCourse);

  // Снимаем зарезервированный отступ сразу, как только шаг закрывается —
  // чтобы страница курсов не оставалась с лишним пустым местом внизу.
  useEffect(() => {
    if (visible) return;
    const scrollRoot = document.querySelector('.sf-main') as HTMLElement | null;
    if (scrollRoot) scrollRoot.style.paddingBottom = '';
  }, [visible]);

  // Реальный scroll-контейнер страницы курсов — .sf-main (flex-1 overflow-auto
  // в Layout.tsx), а не window/html: .sf-main зажат высотой .sf-shell
  // (min-h-screen) и скроллится сам, наружу это не пробрасывается.
  useEffect(() => {
    if (!visible) return;
    const marginTop = 12;
    const gap = 10;
    // Автопрокрутку делаем один раз — дальше не боремся с пользователем,
    // если он решил проскроллить сам. Геометрию (rect) продолжаем
    // актуализировать всегда при любом реальном изменении DOM/размера.
    let autoScrolled = false;

    const applyRect = (next: Rect | null, elExists: boolean) => {
      // Не перетираем последний корректный rect промежуточным/схлопнувшимся
      // значением — иначе на экране на миг мелькает пустая тонкая рамка.
      if (next && next.height >= MIN_SPOTLIGHT_HEIGHT && next.width >= MIN_SPOTLIGHT_HEIGHT) {
        setRect(next);
      } else if (!elExists) {
        setRect(null);
      }
    };

    const update = () => {
      const el = document.querySelector('[data-tour="course-cards"]');
      if (!el || !el.isConnected) {
        setRect(null);
        return;
      }
      const mobile = viewportWidth() <= 760;
      const scrollRoot = document.querySelector('.sf-main') as HTMLElement | null;

      if (!mobile) {
        if (scrollRoot) scrollRoot.style.paddingBottom = '';
        applyRect(getTargetRect('course-cards'), true);
        return;
      }

      // Мобильный: панель — fixed bottom sheet, её реальный верхний край
      // меряем через DOM (высота зависит от того, сколько курсов доступно).
      const panelTop = panelRef.current?.getBoundingClientRect().top ?? window.innerHeight;
      const maxBottom = Math.max(marginTop + 40, panelTop - gap);

      if (scrollRoot) {
        // Резервируем снизу .sf-main место под панель — иначе цель,
        // расположенная ближе к концу контента, чем высота панели,
        // никогда не сможет доскроллиться выше неё.
        const reserve = Math.max(0, window.innerHeight - panelTop) + gap;
        const reservePx = `${Math.ceil(reserve)}px`;
        if (scrollRoot.style.paddingBottom !== reservePx) {
          scrollRoot.style.paddingBottom = reservePx;
        }
      }

      if (!autoScrolled && scrollRoot) {
        const r = el.getBoundingClientRect();
        if (r.top > marginTop + 6 || r.top > maxBottom || r.bottom < 0) {
          scrollRoot.scrollBy({ top: r.top - marginTop });
          requestAnimationFrame(() => requestAnimationFrame(update));
        } else {
          autoScrolled = true;
        }
      }

      applyRect(getTargetRect('course-cards', maxBottom), true);
    };

    // Двойной rAF перед первым замером — даём React закоммитить, а
    // браузеру пересчитать layout.
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(update); });

    const el = document.querySelector('[data-tour="course-cards"]');
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (el && resizeObserver) resizeObserver.observe(el);
    if (panelRef.current && resizeObserver) resizeObserver.observe(panelRef.current);

    const scrollRootEl = document.querySelector('.sf-main');

    const root = document.getElementById('root');
    const mutationObserver = new MutationObserver(update);
    if (root) mutationObserver.observe(root, { childList: true, subtree: true, attributes: true, characterData: true });

    // Таймер — только резервный механизм, не основной канал обновления.
    const interval = window.setInterval(update, 500);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { capture: true, passive: true });
    scrollRootEl?.addEventListener('scroll', update, { passive: true });
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearInterval(interval);
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, { capture: true } as EventListenerOptions);
      scrollRootEl?.removeEventListener('scroll', update);
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
      <div className="fixed inset-0 z-[10050] pointer-events-none" role="dialog" aria-modal="true">
        {rect ? (
          <>
            {/* Затемняем всё, кроме подсвеченной области — она остаётся кликабельной насквозь. */}
            <div className="fixed bg-black/60 pointer-events-auto" style={{ top: 0, left: 0, width: '100vw', height: Math.max(0, rect.top) }} />
            <div className="fixed bg-black/60 pointer-events-auto" style={{ top: rect.top, left: 0, width: Math.max(0, rect.left), height: rect.height }} />
            <div className="fixed bg-black/60 pointer-events-auto" style={{ top: rect.top, left: rect.left + rect.width, width: Math.max(0, viewportWidth() - rect.left - rect.width), height: rect.height }} />
            <div className="fixed bg-black/60 pointer-events-auto" style={{ top: rect.top + rect.height, left: 0, width: '100vw', height: Math.max(0, window.innerHeight - rect.top - rect.height) }} />
            <div
              className="fixed rounded-2xl border-2 border-primary-500 pointer-events-none"
              style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, boxShadow: '0 0 0 4px rgba(59,130,246,0.25)' }}
            />
            <div
              className="fixed flex items-center gap-2 rounded-full bg-white border border-surface-200 shadow-md px-3 py-2 text-sm font-semibold text-dark-700 pointer-events-none"
              style={{ top: rect.top + rect.height + 14, left: rect.left + rect.width / 2, transform: 'translateX(-50%)' }}
            >
              <span>👆</span> Нажмите на курс
            </div>
          </>
        ) : (
          <div className="fixed inset-0 bg-black/60 pointer-events-auto" />
        )}
      </div>

      {/* Панель — сосед затемняющей обёртки (не потомок), чтобы её z-index
          (10060) реально стоял выше затемнения (10050). На мобильном —
          простой fixed bottom sheet со своей прокруткой при нехватке места. */}
      <div
        ref={panelRef}
        className="card shadow-xl pointer-events-auto"
        style={
          isMobile
            ? { position: 'fixed', left: 12, right: 12, bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))', maxWidth: 640, margin: '0 auto', maxHeight: '38vh', overflowY: 'auto', zIndex: 10060 }
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
