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

// Подсвечиваем реально занятую детьми область, а не весь grid-контейнер —
// иначе при 2 карточках в 3-колоночной сетке рамка захватывает пустое место справа.
function getTargetRect(name: string, maxBottom: number = window.innerHeight - 4): Rect | null {
  const el = document.querySelector(`[data-tour="${name}"]`);
  if (!el || !el.isConnected) return null;
  const children = Array.from(el.children) as HTMLElement[];
  const rects = (children.length > 0 ? children : [el]).map((c) => c.getBoundingClientRect());
  const left0 = Math.min(...rects.map((r) => r.left));
  const top0 = Math.min(...rects.map((r) => r.top));
  const right0 = Math.max(...rects.map((r) => r.right));
  const bottom0 = Math.max(...rects.map((r) => r.bottom));
  if (right0 - left0 <= 0 || bottom0 - top0 <= 0) return null;
  const padding = 10;
  const left = Math.max(4, left0 - padding);
  const top = Math.max(4, top0 - padding);
  const right = Math.min(window.innerWidth - 4, right0 + padding);
  const bottom = Math.min(maxBottom, bottom0 + padding);
  if (right <= left || bottom <= top) return null;
  return { top, left, width: right - left, height: bottom - top };
}

interface Props {
  courses: Course[];
}

export default function GuestWelcomeStep({ courses }: Props) {
  const navigate = useNavigate();
  const { tourSeen, markTourSeen } = useTourSeen();
  const [dismissed, setDismissed] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  // На мобильном панель — не фиксированный оверлей поверх низа экрана, а
  // часть потока документа сразу под карточками курсов: страница становится
  // выше и просто скроллится, чтобы показать всё целиком, без внутренней
  // прокрутки самой панели. top — в координатах документа (с учётом скролла).
  // null = обычное позиционирование (десктоп/планшет, панель у нижнего края).
  const [mobilePanelTop, setMobilePanelTop] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const pythonCourse = useMemo(() => courses.find((c) => /python/i.test(c.title)), [courses]);
  const sqlCourse = useMemo(() => courses.find((c) => /sql/i.test(c.title)), [courses]);

  const visible = !tourSeen && !dismissed && Boolean(pythonCourse || sqlCourse);

  useEffect(() => {
    if (!visible) return;
    let scrolledIntoView = false;
    const update = () => {
      const el = document.querySelector('[data-tour="course-cards"]');
      const mobile = window.innerWidth <= 760;

      if (!mobile) {
        setMobilePanelTop(null);
      } else if (el && !scrolledIntoView) {
        scrolledIntoView = true;
        // Подводим карточки к верху экрана и ставим панель сразу под ними —
        // в координатах документа, а не вьюпорта. Дальше страница просто
        // становится выше и скроллится целиком, показывая всё без обрезки
        // и без прокрутки внутри самой панели.
        const marginTop = 12;
        const gap = 10;
        const r = el.getBoundingClientRect();
        const delta = r.top - marginTop;
        const docTop = window.scrollY + delta + marginTop + r.height + gap;
        setMobilePanelTop(docTop);
        if (Math.abs(delta) > 4) window.scrollBy({ top: delta, behavior: 'smooth' });
      }

      // Блок больше не обрезаем по границе панели — она теперь не может его
      // перекрыть, т.к. стоит ниже в потоке документа, а не поверх.
      setRect(getTargetRect('course-cards'));
    };
    update();
    const interval = window.setInterval(update, 200);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { capture: true, passive: true });
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, { capture: true } as EventListenerOptions);
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

  return (
    <>
      <div className="fixed inset-0 z-[10050] pointer-events-none" role="dialog" aria-modal="true">
        {rect ? (
          <>
            {/* Затемняем всё, кроме подсвеченной области — она остаётся кликабельной насквозь. */}
            <div className="fixed bg-black/60 pointer-events-auto" style={{ top: 0, left: 0, width: '100vw', height: Math.max(0, rect.top) }} />
            <div className="fixed bg-black/60 pointer-events-auto" style={{ top: rect.top, left: 0, width: Math.max(0, rect.left), height: rect.height }} />
            <div className="fixed bg-black/60 pointer-events-auto" style={{ top: rect.top, left: rect.left + rect.width, width: Math.max(0, window.innerWidth - rect.left - rect.width), height: rect.height }} />
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

      {/*
        Панель вынесена ИЗ фиксированной обёртки: на мобильном (mobilePanelTop
        не null) она позиционируется absolute в координатах документа —
        значит участвует в его высоте и скроллится вместе со страницей,
        а не зависает поверх контента.
      */}
      <div
        ref={panelRef}
        className={`card shadow-xl pointer-events-auto ${mobilePanelTop !== null ? 'absolute' : 'fixed'}`}
        style={
          mobilePanelTop !== null
            ? { left: 16, right: 16, top: mobilePanelTop, maxWidth: 640, margin: '0 auto', zIndex: 10060 }
            : { left: 16, right: 16, bottom: 16, maxWidth: 640, margin: '0 auto', maxHeight: '50vh', overflowY: 'auto', zIndex: 10060, position: 'fixed' }
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

        <div className="mt-3 ml-0 sm:ml-12 text-sm text-surface-500 leading-snug sm:leading-relaxed">
          Сейчас вам доступна демо-версия курсов Python и SQL: можно открыть часть практических задач
          и посмотреть, как устроено обучение. Выберите направление — дальше вы увидите, как открыть
          задачу, написать решение и проверить результат.
        </div>

        <div className="mt-4 ml-0 sm:ml-12 flex flex-col sm:flex-row gap-2">
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
          <button type="button" onClick={skip} className="w-full sm:flex-1 justify-center btn-secondary btn-sm whitespace-normal sm:whitespace-nowrap">
            Разобраться самостоятельно
          </button>
        </div>
      </div>
    </>
  );
}
