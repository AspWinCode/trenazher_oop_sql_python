import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Submission, Task, TaskHint } from '../../types';
import { getTourContent } from './tourContent';
import { useAuthStore } from '../../store/auth';
import { persistTourSeen } from './useTourSeen';

interface Props {
  task: Task;
  code: string;
  setCode: (code: string) => void;
  submission: Submission | null;
  submitting: boolean;
  submitSolution: (taskId: number, code: string) => Promise<void>;
  hints: TaskHint[];
  showHints: boolean;
  setShowHints: (v: boolean) => void;
  onFinish: () => void;
}

type StepId =
  | 'sidebar'
  | 'problem'
  | 'schema'
  | 'sample'
  | 'editor'
  | 'submit-wrong-1'
  | 'wrong-result'
  | 'submit-wrong-2'
  | 'hint'
  | 'submit-correct'
  | 'success'
  | 'try-yourself';

type SubmitKind = 'wrong-1' | 'wrong-2' | 'correct';

// К какой попытке относится сабмит, определяем по текущему шагу тура —
// это позволяет реагировать на отправку решения независимо от того,
// была ли нажата кнопка тура или настоящая кнопка «Отправить решение».
const SUBMIT_STEP_KIND: Partial<Record<StepId, SubmitKind>> = {
  'submit-wrong-1': 'wrong-1',
  'submit-wrong-2': 'wrong-2',
  'submit-correct': 'correct',
};

// Таргеты компактные: 'hint-content' — только сам блок подсказки (не вся
// колонка с историей отправок), 'result-summary' — верхняя часть карточки
// результата (вердикт + время), а не весь список тестов целиком.
const STEP_TARGET: Record<StepId, string> = {
  sidebar: 'sidebar',
  problem: 'condition',
  schema: 'schema',
  sample: 'sample',
  editor: 'editor',
  'submit-wrong-1': 'submit',
  'wrong-result': 'result',
  'submit-wrong-2': 'submit',
  hint: 'hint-content',
  'submit-correct': 'submit',
  success: 'result-summary',
  'try-yourself': 'editor',
};

// На мобильном для submit-шагов подсвечиваем не только кнопку, а всю
// карточку редактора (data-tour="editor") — она и так включает toolbar,
// код в Monaco и sf-editor-actions с настоящей кнопкой submit внутри,
// так что отдельный wrapper не нужен. Иначе на узком экране пользователь
// видит только кнопку и не видит код, который отправляет. Desktop не
// трогаем — там spotlight по-прежнему только вокруг кнопки.
const MOBILE_WIDE_SUBMIT_STEPS = new Set<StepId>(['submit-wrong-1', 'submit-wrong-2', 'submit-correct']);

function getStepTarget(step: StepId, mobile: boolean): string {
  if (mobile && MOBILE_WIDE_SUBMIT_STEPS.has(step)) {
    return 'editor';
  }
  return STEP_TARGET[step];
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// visualViewport точнее window.innerHeight на мобильном Chrome — учитывает
// скрытие/появление адресной строки и открытую клавиатуру.
function viewportHeight(): number {
  return window.visualViewport?.height ?? window.innerHeight;
}
function viewportWidth(): number {
  return window.visualViewport?.width ?? window.innerWidth;
}

// getBoundingClientRect() всегда в координатах layout-вьюпорта. visualViewport
// может быть сдвинут относительно него (offsetTop/offsetLeft) — не только
// иметь другие height/width — например, при открытой клавиатуре на части
// мобильных браузеров или при pinch-zoom. Приводим границу "видимой области"
// к тем же координатам, что и getBoundingClientRect().
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

function getTargetRect(name: string, maxBottom?: number): Rect | null {
  const el = document.querySelector(`[data-tour="${name}"]`) as HTMLElement | null;
  if (!el || !el.isConnected) return null;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  const vb = visualViewportBounds();
  // Если target лежит внутри реального scroll-контейнера задачи, обрезаем
  // его границами ЭТОГО контейнера, а не только вьюпорта — иначе, если
  // элемент физически прокрутился выше scrollRoot, его getBoundingClientRect()
  // может уходить за верхнюю границу scrollRoot (то есть под sf-task-header),
  // и подсветка ошибочно рисуется поверх заголовка задачи.
  const scrollRoot = el.closest('[data-tour-scroll-root]') as HTMLElement | null;
  const sr = scrollRoot?.getBoundingClientRect();
  const padding = name === 'sidebar' ? 0 : 12;

  const clipTop = Math.max(vb.top + 4, sr ? sr.top + 4 : vb.top + 4);
  const clipLeft = Math.max(vb.left + 4, sr ? sr.left + 4 : vb.left + 4);
  const clipRight = Math.min(vb.right - 4, sr ? sr.right - 4 : vb.right - 4);
  const clipBottom = Math.min(maxBottom ?? vb.bottom - 4, sr ? sr.bottom - 4 : vb.bottom - 4);

  const left = Math.max(clipLeft, r.left - padding);
  const top = Math.max(clipTop, r.top - padding);
  const right = Math.min(clipRight, r.right + padding);
  const bottom = Math.min(clipBottom, r.bottom + padding);
  if (right <= left || bottom <= top) return null;
  return { top, left, width: right - left, height: bottom - top };
}

// Порог для отсечения «схлопнувшейся»/ещё не отрисованной геометрии — не
// показываем рамку толщиной в несколько пикселей (это не настоящая цель, а
// промежуточное состояние layout). Реальные target'ы (кнопка submit ~40px,
// текстовые блоки, карточки) всегда заметно выше этого порога.
const MIN_SPOTLIGHT_HEIGHT = 16;

export default function GuestFirstTaskTour({
  task, code, setCode, submission, submitting, submitSolution,
  hints, showHints, setShowHints, onFinish,
}: Props) {
  const content = useMemo(() => getTourContent(task), [task]);

  // Витринный пример входа для задачи — если его нет, шаг «Пример» вообще
  // не показываем (а не тихо скипаем его через таймаут); если есть —
  // подставляем реальное значение в текст шага, а не общую формулировку.
  const sampleValue = useMemo(() => {
    const isCodeTest = task.task_type === 'python_oop'
      || task.task_type === 'python_numpy'
      || task.task_type === 'sql_query';
    const publicTest = (task.tests ?? []).find((t) => {
      if (t.test_type !== 'public') return false;
      const input = isCodeTest ? t.example_input : t.input_data;
      const output = isCodeTest ? t.example_output : t.expected_output;
      return Boolean(input || output);
    });
    if (!publicTest) return null;
    return (isCodeTest ? publicTest.example_input : publicTest.input_data) ?? null;
  }, [task]);
  const hasSample = sampleValue !== null;

  // У SQL-задач есть блок «Структура базы данных» — для него отдельный шаг тура.
  const hasSchema = task.task_type === 'sql_query' && Boolean(task.sql_schema);

  // Порядок вводных шагов: одни только для SQL (schema), другие — только
  // если у задачи есть витринный пример (sample). Собираем цепочку заранее,
  // чтобы кнопка «Понял, идём дальше» вела на следующий реально существующий шаг.
  const infoFlow = useMemo<StepId[]>(() => {
    const flow: StepId[] = ['problem'];
    if (hasSchema) flow.push('schema');
    if (hasSample) flow.push('sample');
    flow.push('editor');
    return flow;
  }, [hasSchema, hasSample]);

  // Полная последовательность реальных шагов задачи — для индикатора
  // «Шаг N из M». Шаг «sidebar» сюда не входит (это шаг 0, ещё до открытия
  // задачи), «try-yourself» делит номер с «success» (это альтернативная
  // концовка того же шага, а не отдельный шаг). Технические waiting-состояния
  // (проверяем решение / готовим подсказку) не считаются отдельными шагами —
  // у них нет своего StepId, они лишь временно подменяют контент панели.
  const stepOrder = useMemo<StepId[]>(() => [
    ...infoFlow,
    'submit-wrong-1', 'wrong-result', 'submit-wrong-2', 'hint', 'submit-correct', 'success',
  ], [infoFlow]);

  const userId = useAuthStore((s) => s.user?.id);

  const [step, setStep] = useState<StepId>('sidebar');
  const [rect, setRect] = useState<Rect | null>(null);
  const [typing, setTyping] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  // Высота панели — нужна для позиционирования на десктопе (панель рядом
  // с целью, не должна вылезать за низ экрана). На мобильном панель —
  // fixed bottom sheet с постоянным CSS-позиционированием, её фактическую
  // геометрию эффект ниже читает напрямую через panelRef.getBoundingClientRect().
  const [panelHeight, setPanelHeight] = useState(260);
  useLayoutEffect(() => {
    if (panelRef.current) setPanelHeight(panelRef.current.offsetHeight);
  });
  // Сабмит, который уже обработан туром — чтобы не реагировать на него повторно.
  const lastHandledSubmissionId = useRef<number | null>(submission?.id ?? null);
  // Ждём, пока после 2-й неверной попытки реально подгрузится подсказка,
  // прежде чем показывать шаг «hint» — иначе он на миг ссылается на ещё
  // не отрисованный блок.
  const [awaitingHint, setAwaitingHint] = useState(false);

  const close = useCallback(() => {
    onFinish();
  }, [onFinish]);

  // Помечаем тур просмотренным сразу по факту успеха (не дожидаясь клика
  // по кнопке закрытия) — если родительский компонент по какой-то причине
  // перемонтирует тур, свежий экземпляр увидит актуальный флаг и не
  // начнёт показ заново с первого шага.
  useEffect(() => {
    if (step === 'success') {
      persistTourSeen(userId);
    }
  }, [step, userId]);

  // Скрываем плавающий баннер демо-режима, пока идёт тур — он перекрывает
  // подсвечиваемые блоки (как это было и в исходном скрипте-гиде).
  useEffect(() => {
    document.body.classList.add('guest-tour-active');
    return () => document.body.classList.remove('guest-tour-active');
  }, []);

  // На мобильном сайдбар скрыт за гамбургером — на шаге «sidebar» просим
  // Layout временно его раскрыть, чтобы подсветка указывала на видимый элемент.
  useEffect(() => {
    const isSidebarStep = STEP_TARGET[step] === 'sidebar';
    window.dispatchEvent(new CustomEvent('guest-tour:sidebar', { detail: isSidebarStep }));
    return () => {
      if (isSidebarStep) window.dispatchEvent(new CustomEvent('guest-tour:sidebar', { detail: false }));
    };
  }, [step]);

  // На весь срок жизни тура резервируем под fixed bottom sheet место снизу
  // реального scroll-контейнера задачи (data-tour-scroll-root). Без этого
  // overflow-y-auto не даёт прокрутить к цели, если она физически находится
  // ближе к концу контента, чем высота панели: браузер считает контейнер
  // «прокрученным до конца», хотя визуально нижняя часть спрятана под
  // панелью (ровно так submit-wrong-2/submit-correct утыкались в
  // заголовок — самой кнопке было физически некуда доскроллиться). Отступ
  // снимаем при закрытии тура/при переходе на десктоп.
  useEffect(() => {
    return () => {
      const scrollRoot = document.querySelector('[data-tour-scroll-root]') as HTMLElement | null;
      if (scrollRoot) scrollRoot.style.paddingBottom = '';
    };
  }, []);

  // Пересчитываем позицию спотлайта под текущий шаг.
  useEffect(() => {
    if (!content) return;
    const marginTop = 12;
    const gap = 10;
    // Автопрокрутку к цели делаем один раз за шаг — дальше пользователь
    // волен сам скроллить, мы не должны с ним бороться. Геометрию
    // (rect) продолжаем актуализировать всегда.
    let autoScrolled = false;
    // update() дёргается из нескольких независимых источников одновременно
    // (interval, оба scroll-слушателя, resize, ResizeObserver, MutationObserver) —
    // особенно часто сразу после отправки решения, когда в DOM одновременно
    // рендерится новая карточка результата. Без этого флага каждый такой
    // параллельный вызов мог посчитать СВОЮ дельту скролла и запустить
    // ещё один scrollTo поверх ещё не отработавшего предыдущего — скролл
    // не успевал устояться, а замер геометрии попадал в момент "между"
    // прокрутками и стабильно возвращал null. Пока один автоскролл +
    // двойной rAF не завершились, новый scrollTo не запускаем.
    let scrollInFlight = false;
    // Вложенный двойной rAF автоскролла (ниже, в блоке needsScroll) не
    // отменяется своим обычным идентификатором — requestAnimationFrame
    // возвращает handle только для САМОГО ВНЕШНЕГО вызова в цепочке, а
    // сама цепочка планируется заново при каждом срабатывании needsScroll.
    // Если step сменится до того, как эта цепочка успеет отработать,
    // cleanup эффекта её не остановит "сам по себе" — обработчик всё ещё
    // держит ссылку на СТАРЫЕ update()/targetName и после отмонтирования
    // логики может вызвать setRect() с геометрией уже неактуального шага.
    // Поэтому: (1) id обоих кадров сохраняем и отменяем в cleanup, (2)
    // update() и оба продолжения rAF-цепочки в начале проверяют alive.
    let alive = true;
    let scrollRaf1 = 0;
    let scrollRaf2 = 0;

    // При смене шага старый spotlight нельзя оставлять висеть на экране —
    // иначе при переходе, например, problem -> sample -> editor рамка на
    // миг (или до первого валидного замера) остаётся на ПРЕДЫДУЩЕМ target'е.
    // "Сохранение последнего валидного rect" ниже (в applyRect) защищает
    // только от мерцания МЕЖДУ обновлениями ОДНОГО и того же шага — сброс
    // здесь обязателен перед этим.
    setRect(null);

    const applyRect = (next: Rect | null, elExists: boolean) => {
      if (!alive) return;
      // Не перетираем последний КОРРЕКТНЫЙ rect промежуточным/схлопнувшимся
      // значением (ещё не отрисованный layout, переходное состояние между
      // старой и новой целью) — иначе на экране на миг мелькает пустая
      // тонкая рамка без содержимого. Обнуляем rect только если цели
      // реально больше нет в DOM. Это относится только к обновлениям
      // ТЕКУЩЕГО шага — при смене step сам эффект перезапускается и rect
      // уже сброшен в null выше.
      if (next && next.height >= MIN_SPOTLIGHT_HEIGHT && next.width >= MIN_SPOTLIGHT_HEIGHT) {
        setRect(next);
      } else if (!elExists) {
        setRect(null);
      }
    };

    const update = () => {
      if (!alive) return;
      const mobile = viewportWidth() <= 760;
      const targetName = getStepTarget(step, mobile);
      const el = document.querySelector(`[data-tour="${targetName}"]`) as HTMLElement | null;

      // Дополнительный акцент на настоящей кнопке submit — только на
      // мобильном и только на submit-шагах, где spotlight охватывает весь
      // editor целиком (иначе кнопка теряется на фоне всего блока кода).
      // Класс переключается на реальном DOM-узле напрямую (как и запись
      // paddingBottom на scrollRoot чуть ниже) — тот же приём, что уже
      // используется в этом эффекте, без прокидывания пропсов в другой
      // компонент.
      const submitEl = document.querySelector('[data-tour="submit"]') as HTMLElement | null;
      const shouldAccentSubmit = mobile && MOBILE_WIDE_SUBMIT_STEPS.has(step);
      submitEl?.classList.toggle('ring-2', shouldAccentSubmit);
      submitEl?.classList.toggle('ring-primary-400', shouldAccentSubmit);
      submitEl?.classList.toggle('shadow-lg', shouldAccentSubmit);

      if (!el || !el.isConnected) {
        setRect(null);
        return;
      }

      // sidebar не внутри scroll-root задачи (это отдельный флаутовый
      // drawer в Layout) — оставляем как отдельный случай, как и на
      // десктопе: browser-native scrollIntoView сам найдёт нужный
      // скролл-контейнер по цепочке предков.
      if (!mobile || targetName === 'sidebar') {
        if (!mobile) {
          const scrollRoot = document.querySelector('[data-tour-scroll-root]') as HTMLElement | null;
          if (scrollRoot) scrollRoot.style.paddingBottom = '';
        }
        if (!mobile && !autoScrolled && targetName !== 'sidebar') {
          autoScrolled = true;
          try { el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' }); }
          catch { el.scrollIntoView(); }
        }
        applyRect(getTargetRect(targetName), true);
        return;
      }

      // Мобильный, не sidebar: панель — fixed bottom sheet, её РЕАЛЬНЫЙ
      // верхний край меряем через DOM (высота карточки зависит от текста
      // конкретного шага — не вычисляем заранее, а читаем готовый layout).
      const panelTop = panelRef.current?.getBoundingClientRect().top ?? viewportHeight();
      // Доступная для подсветки область заканчивается строго над панелью:
      // spotlight никогда не должен продолжаться под карточкой.
      const maxBottom = Math.max(marginTop + 40, panelTop - gap);

      const scrollRoot = document.querySelector('[data-tour-scroll-root]') as HTMLElement | null;

      if (scrollRoot) {
        // Резервируем снизу scroll-контейнера место под панель — иначе
        // цель, физически расположенная ближе к концу контента, чем
        // высота панели, никогда не сможет доскроллиться выше неё
        // (overflow-y-auto упрётся в конец РЕАЛЬНОГО контента раньше, чем
        // цель окажется видна).
        const reserve = Math.max(0, viewportHeight() - panelTop) + gap;
        const reservePx = `${Math.ceil(reserve)}px`;
        if (scrollRoot.style.paddingBottom !== reservePx) {
          scrollRoot.style.paddingBottom = reservePx;
        }
      }

      if (!autoScrolled && !scrollInFlight && scrollRoot) {
        // На mobile submit-шагах target — весь editor, который часто
        // выше доступного места над панелью. Если выравнивать по верху
        // editor (как для обычных target'ов), кнопка submit внизу карточки
        // может остаться под bottom-sheet. Здесь важнее показать код и
        // саму кнопку, а не шапку тулбара — поэтому подводим к панели
        // именно НИЗ настоящей кнопки submit, а не верх editor.
        const isMobileWideSubmit = MOBILE_WIDE_SUBMIT_STEPS.has(step);
        const anchorEl = isMobileWideSubmit
          ? (document.querySelector('[data-tour="submit"]') as HTMLElement | null) ?? el
          : el;
        const r = anchorEl.getBoundingClientRect();
        const scrollRect = scrollRoot.getBoundingClientRect();

        let delta: number;
        let needsScroll: boolean;
        if (isMobileWideSubmit) {
          // Желаемое положение — низ кнопки submit ровно у верхней границы
          // maxBottom (то есть впритык над панелью).
          const desiredBottom = maxBottom;
          needsScroll = Math.abs(r.bottom - desiredBottom) > 6 || r.top < scrollRect.top;
          delta = r.bottom - desiredBottom;
        } else if (step === 'wrong-result') {
          // Локальная ветка только для этого шага. Общий fits/doesn't-fit
          // алгоритм ниже мог бы выровнять result по НИЖНЕМУ краю, если весь
          // блок технически помещается в доступную высоту (например когда
          // виден только один тест, а маленькая панель "Проверка показала
          // ошибку" оставляет много места) — тогда верх блока (Неверно/время)
          // уезжал вниз с зазором сверху, а не прижимался к header, и под
          // первый TestResultCard оставалось меньше места, чем возможно.
          // Здесь верх result всегда прижимаем к верхней границе видимой
          // области, независимо от того, помещается весь блок целиком или
          // нет — так вверху максимум места остаётся под verdict+время+
          // первый тест, а остальное (второй тест и ниже) по-прежнему
          // клипует существующий getTargetRect() по maxBottom.
          const desiredTop = scrollRect.top + 8;
          delta = r.top - desiredTop;
          needsScroll = Math.abs(delta) > 6;
        } else {
          // r.top/r.bottom — координаты во ВЬЮПОРТЕ, а scrollRoot начинается
          // не с верха вьюпорта, а ниже sf-task-header. "Видимая область" —
          // это полоса между низом header'а (visibleTop) и верхом панели
          // (visibleBottom), а не весь вьюпорт от 0.
          const visibleTop = scrollRect.top + marginTop;
          const visibleBottom = maxBottom;
          const availableHeight = Math.max(0, visibleBottom - visibleTop);
          const targetHeight = r.height;

          if (targetHeight <= availableHeight) {
            // Target физически помещается целиком между header и панелью —
            // "видно" значит виден ПОЛНОСТЬЮ, а не любым краем. Раньше
            // проверка "хотя бы что-то пересекается с видимой областью"
            // считала, например, узкую полоску верхних 10px блока sample
            // (при том что весь остальной блок уже под панелью) достаточной,
            // и getTargetRect затем клипал всё остальное — на экране
            // оставалась только эта полоска вместо всего блока.
            if (r.top < visibleTop) {
              delta = r.top - visibleTop;
              needsScroll = true;
            } else if (r.bottom > visibleBottom) {
              delta = r.bottom - visibleBottom;
              needsScroll = true;
            } else {
              delta = 0;
              needsScroll = false;
            }
          } else {
            // Target выше доступной области целиком (большой editor, длинный
            // result) — целиком не показать физически, выравниваем по верху,
            // getTargetRect обрежет по visibleBottom и покажет видимую часть.
            delta = r.top - visibleTop;
            needsScroll = Math.abs(delta) > 6;
          }
        }

        if (needsScroll) {
          // Абсолютный scrollTo вместо scrollBy: дельту считаем от ТЕКУЩЕГО
          // scrollTop один раз, до старта прокрутки, а не полагаемся на то,
          // что scrollBy применится мгновенно и синхронно для следующего
          // конкурентного вызова update().
          const destination = scrollRoot.scrollTop + delta;
          scrollInFlight = true;
          scrollRoot.scrollTo({ top: destination, behavior: 'auto' });
          // После scrollTo — двойной rAF и повторный замер: даём браузеру
          // применить прокрутку и пересчитать layout, прежде чем мерить
          // снова. Пока это не завершилось, ни один другой вызов update()
          // (из interval/scroll/resize/MutationObserver) не запустит ещё
          // один автоскролл поверх этого.
          scrollRaf1 = requestAnimationFrame(() => {
            scrollRaf2 = requestAnimationFrame(() => {
              scrollInFlight = false;
              if (!alive) return;
              update();
            });
          });
          // Не считаем spotlight в ЭТОМ вызове: пока scrollTo не применился
          // и layout не пересчитался, getTargetRect() увидел бы старую,
          // ещё не проскроллленную геометрию — ровно так на один кадр
          // мелькала обрезанная полоска вместо целого target'а. Актуальный
          // rect посчитает update(), вызванный из двойного rAF выше.
          return;
        }
        autoScrolled = true;
      }

      // Если цель выше доступной области целиком (например весь editor
      // не помещается над панелью) — maxBottom обрежет rect по границе
      // панели, и подсветится ровно видимая часть элемента, а не весь
      // элемент и не пустое место под панелью.
      applyRect(getTargetRect(targetName, maxBottom), true);
    };

    // Двойной requestAnimationFrame перед первым замером на новом шаге:
    // даём React закоммитить DOM, а браузеру — пересчитать layout (иначе
    // первый замер может застать ещё не отрисованное состояние).
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(update);
    });

    const el = document.querySelector(`[data-tour="${getStepTarget(step, viewportWidth() <= 760)}"]`);
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    // Наблюдаем и за целью, и за панелью — изменение текста карточки тура
    // (переход между шагами, разный объём подсказки) меняет её высоту, а
    // значит и доступную для spotlight область.
    if (el && resizeObserver) resizeObserver.observe(el);
    if (panelRef.current && resizeObserver) resizeObserver.observe(panelRef.current);

    const scrollRootEl = document.querySelector('[data-tour-scroll-root]');

    const root = document.getElementById('root');
    // Сам update() пишет scrollRootEl.style.paddingBottom (резерв под
    // панель) — это мутация атрибута style внутри наблюдаемого поддерева.
    // Отфильтровываем именно её, чтобы она не участвовала в позиционировании
    // тура: если В ЭТОЙ пачке мутаций есть хоть что-то, кроме изменения
    // style самого scrollRootEl, обрабатываем как обычно.
    const mutationObserver = new MutationObserver((mutations) => {
      const relevant = mutations.some((m) => !(
        m.type === 'attributes' && m.attributeName === 'style' && m.target === scrollRootEl
      ));
      if (relevant) update();
    });
    if (root) mutationObserver.observe(root, { childList: true, subtree: true, attributes: true, characterData: true });

    // Таймер — только резервный механизм на случай изменений, которые не
    // поймали ни ResizeObserver, ни MutationObserver (интервал большой —
    // это не основной канал обновления).
    const interval = window.setInterval(update, 500);

    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { capture: true, passive: true });
    scrollRootEl?.addEventListener('scroll', update, { passive: true });
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);

    return () => {
      // Первым делом — глушим update() и обе rAF-продолжения автоскролла:
      // они могли быть уже поставлены в очередь браузера и не отменяются
      // простым cancelAnimationFrame внешнего звена цепочки (см. комментарий
      // выше про scrollRaf1/scrollRaf2). После alive=false ни один из них
      // не сможет вызвать setRect() с геометрией уже отмонтированного шага.
      alive = false;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      cancelAnimationFrame(scrollRaf1);
      cancelAnimationFrame(scrollRaf2);
      window.clearInterval(interval);
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, { capture: true } as EventListenerOptions);
      scrollRootEl?.removeEventListener('scroll', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
      // Уходим с шага (или тур размонтируется) — акцент на кнопке submit
      // не должен оставаться висеть на следующем шаге/после закрытия тура.
      const submitEl = document.querySelector('[data-tour="submit"]') as HTMLElement | null;
      submitEl?.classList.remove('ring-2', 'ring-primary-400', 'shadow-lg');
    };
  }, [step, content]);

  useEffect(() => {
    if (step === 'hint' && showHints === false && hints.length > 0) {
      setShowHints(true);
    }
  }, [step, hints.length, showHints, setShowHints]);

  // Реагируем на завершение проверки, только если сейчас идёт «сабмит-шаг»
  // тура — независимо от того, какая кнопка («тур» или настоящая на
  // странице) запустила отправку решения.
  useEffect(() => {
    const kind = SUBMIT_STEP_KIND[step];
    if (!kind) return;
    if (!submission || submission.status !== 'finished') return;
    if (submission.id === lastHandledSubmissionId.current) return;

    lastHandledSubmissionId.current = submission.id;

    if (kind === 'wrong-1') {
      setStep('wrong-result');
    } else if (kind === 'wrong-2') {
      setAwaitingHint(true);
    } else if (kind === 'correct') {
      setStep(submission.verdict === 'AC' ? 'success' : 'try-yourself');
    }
  }, [step, submission?.id, submission?.status, submission?.verdict]);

  // Переходим на шаг с подсказкой, только когда она реально появилась
  // (или спустя разумный таймаут — например, если подсказки отключены).
  useEffect(() => {
    if (!awaitingHint) return;
    if (hints.length > 0) {
      setAwaitingHint(false);
      setStep('hint');
      return;
    }
    const timeout = window.setTimeout(() => {
      setAwaitingHint(false);
      setStep('hint');
    }, 4000);
    return () => window.clearTimeout(timeout);
  }, [awaitingHint, hints.length]);

  if (!content) return null;

  const targetRect = rect;

  async function typeCode(text: string) {
    setTyping(true);
    setCode('');
    const total = text.length;
    const start = performance.now();
    const duration = 1500;

    await new Promise<void>((resolve) => {
      let shown = 0;
      function frame(now: number) {
        const progress = Math.min(1, (now - start) / duration);
        let next = Math.floor(total * progress);
        if (progress < 1 && next <= shown) next = shown + 1;
        next = Math.min(next, total);
        if (next !== shown) {
          setCode(text.slice(0, next));
          shown = next;
        }
        if (progress < 1) {
          requestAnimationFrame(frame);
        } else {
          setCode(text);
          resolve();
        }
      }
      requestAnimationFrame(frame);
    });

    setTyping(false);
  }

  async function handleWriteWrongCode() {
    await typeCode(content!.wrongCode);
    setStep('submit-wrong-1');
  }

  function handleSubmit() {
    if (submitting) return;
    submitSolution(task.id, code);
  }

  function handleApplyHint() {
    setCode(content!.correctCode);
    setStep('submit-correct');
  }

  const panels: Partial<Record<StepId, { icon: string; title: string; body: string; actions: { id: string; label: string; primary?: boolean }[] }>> = {
    sidebar: {
      icon: '☰',
      title: 'Список всех задач курса',
      body: 'Слева — список всех задач. <strong>Все задачи доступны сразу</strong> — можно решать не по порядку.',
      actions: [
        { id: 'sidebar-next', label: 'Перейти к первой задаче', primary: true },
        { id: 'close', label: 'Закрыть помощника' },
      ],
    },
    problem: {
      icon: '1',
      title: 'Сначала прочитайте условие',
      body: 'Здесь описано, <strong>что должен делать ваш код</strong>: что на входе и что нужно вывести.',
      actions: [
        { id: 'next', label: 'Понял, идём дальше', primary: true },
        { id: 'close', label: 'Дальше сам разберусь' },
      ],
    },
    schema: {
      icon: '2',
      title: 'Посмотрите структуру базы',
      body: content.schemaExplanation ?? '',
      actions: [
        { id: 'next', label: 'Понял, идём дальше', primary: true },
        { id: 'close', label: 'Дальше сам разберусь' },
      ],
    },
    sample: {
      icon: '2',
      title: 'Пример входных и выходных данных',
      body: sampleValue
        ? `Значение <strong>${escapeHtml(sampleValue)}</strong> система передаст на вход — верните результат в указанном в условии виде.`
        : 'Такие данные система передаст на вход — верните результат в указанном в условии виде.',
      actions: [
        { id: 'next', label: 'Понял, идём дальше', primary: true },
        { id: 'close', label: 'Дальше сам разберусь' },
      ],
    },
    editor: {
      icon: '3',
      title: 'Напишем первый код вместе',
      body: 'Нажмите кнопку — помощник напечатает решение в редакторе.',
      actions: [
        { id: 'write-wrong', label: 'Написать первый код вместе', primary: true },
        { id: 'close', label: 'Продолжу самостоятельно' },
      ],
    },
    'submit-wrong-1': {
      icon: '4',
      title: 'Отправим решение на проверку',
      body: 'Нажмите <strong>«Отправить решение»</strong> — система проверит код на нескольких тестах.',
      actions: [
        { id: 'submit-wrong-1', label: 'Отправить решение', primary: true },
        { id: 'close', label: 'Дальше сам разберусь' },
      ],
    },
    'wrong-result': {
      icon: '5',
      title: 'Проверка показала ошибку',
      body: content.wrongResultExplanation,
      actions: [
        { id: 'continue-after-wrong', label: 'Понял, давай продолжим', primary: true },
        { id: 'close', label: 'Дальше сам разберусь' },
      ],
    },
    'submit-wrong-2': {
      icon: '6',
      title: 'Отправим решение ещё раз',
      body: 'После 2-й, 4-й и 6-й неверной попытки появляются подсказки. Отправим решение ещё раз.',
      actions: [
        { id: 'submit-wrong-2', label: 'Отправить решение ещё раз', primary: true },
        { id: 'close', label: 'Дальше сам разберусь' },
      ],
    },
    hint: {
      icon: '7',
      title: 'Появилась подсказка',
      body: content.hintExplanation,
      actions: [
        { id: 'apply-hint', label: 'Исправить код и продолжить', primary: true },
        { id: 'close', label: 'Дальше сам разберусь' },
      ],
    },
    'submit-correct': {
      icon: '8',
      title: 'Код исправлен — проверим снова',
      body: content.correctExplanation,
      actions: [
        { id: 'submit-correct', label: 'Отправить исправленный код', primary: true },
        { id: 'close', label: 'Дальше сам разберусь' },
      ],
    },
    success: {
      icon: '✓',
      title: 'Задача решена верно!',
      body: 'Код прошёл проверку. Теперь вы знаете, как решать задачи на платформе!',
      actions: [
        { id: 'close', label: 'Продолжить работу', primary: true },
      ],
    },
    'try-yourself': {
      icon: '✓',
      title: 'Дальше — ваша очередь',
      body: content.tryYourselfExplanation,
      actions: [
        { id: 'close', label: 'Понял, попробую сам', primary: true },
      ],
    },
  };

  function handleAction(id: string) {
    switch (id) {
      case 'close':
        close();
        break;
      case 'sidebar-next':
        setStep('problem');
        break;
      case 'next': {
        const idx = infoFlow.indexOf(step);
        setStep(idx >= 0 && idx < infoFlow.length - 1 ? infoFlow[idx + 1] : 'editor');
        break;
      }
      case 'write-wrong':
        handleWriteWrongCode();
        break;
      case 'submit-wrong-1':
        handleSubmit();
        break;
      case 'continue-after-wrong':
        setStep('submit-wrong-2');
        break;
      case 'submit-wrong-2':
        handleSubmit();
        break;
      case 'apply-hint':
        handleApplyHint();
        break;
      case 'submit-correct':
        handleSubmit();
        break;
      default:
        break;
    }
  }

  const waitingSubmission = Boolean(SUBMIT_STEP_KIND[step]) && Boolean(submission) && submission?.status !== 'finished';
  const waiting = waitingSubmission || awaitingHint;
  const activePanel = waiting
    ? {
        icon: '↻',
        title: awaitingHint ? 'Готовим подсказку' : 'Проверяем решение',
        body: awaitingHint
          ? 'Система подбирает подсказку для этой задачи. Секунду…'
          : 'Система запускает код на открытом и скрытых тестах. Подождите немного.',
        actions: [{ id: 'close', label: 'Закрыть помощника' }],
      }
    : panels[step];

  if (!activePanel) return null;

  // «Шаг N из M» — waiting-состояния не считаются отдельными шагами, они
  // просто временно подменяют контент панели поверх текущего step.
  const stepIndex = stepOrder.indexOf(step === 'try-yourself' ? 'success' : step);
  const stepNumber = stepIndex >= 0 ? stepIndex + 1 : null;

  const panelWidth = 480;
  const isMobile = viewportWidth() <= 760;
  // На мобильном панель — обычный fixed bottom sheet: всегда у нижнего
  // края экрана (с отступом под safe-area на iOS), с собственной
  // прокруткой, если текст шага не помещается. Её РЕАЛЬНУЮ высоту/верх
  // эффект слежения выше читает через panelRef.getBoundingClientRect() —
  // ничего вычислять заранее не нужно.
  let panelStyle: React.CSSProperties = isMobile
    ? {
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        width: 'auto',
        maxHeight: '42vh',
        overflowY: 'auto',
      }
    : { position: 'fixed', left: 16, right: 16, bottom: 16, width: 'auto', maxHeight: '60vh', overflowY: 'auto' };

  if (targetRect && !isMobile) {
    const gap = 16;
    const margin = 12;
    const spaceRight = window.innerWidth - targetRect.left - targetRect.width;
    const spaceLeft = targetRect.left;
    const spaceBelow = window.innerHeight - targetRect.top - targetRect.height;
    const spaceAbove = targetRect.top;
    const clampX = (left: number) => Math.min(Math.max(margin, left), window.innerWidth - panelWidth - margin);
    const clampTop = (top: number) => Math.min(Math.max(margin, top), window.innerHeight - margin - panelHeight);

    // Приоритет: справа → слева → снизу → сверху → прижать к углу.
    // Панель никогда не должна закрывать саму подсвеченную область.
    if (spaceRight >= panelWidth + gap + margin) {
      panelStyle = {
        position: 'fixed',
        left: targetRect.left + targetRect.width + gap,
        top: clampTop(targetRect.top),
        width: panelWidth,
        maxHeight: window.innerHeight - margin * 2,
        overflowY: 'auto',
      };
    } else if (spaceLeft >= panelWidth + gap + margin) {
      panelStyle = {
        position: 'fixed',
        left: targetRect.left - panelWidth - gap,
        top: clampTop(targetRect.top),
        width: panelWidth,
        maxHeight: window.innerHeight - margin * 2,
        overflowY: 'auto',
      };
    } else if (spaceBelow >= 200) {
      panelStyle = {
        position: 'fixed',
        left: clampX(targetRect.left),
        top: targetRect.top + targetRect.height + gap,
        width: panelWidth,
        maxHeight: Math.max(160, spaceBelow - gap - margin),
        overflowY: 'auto',
      };
    } else if (spaceAbove >= 200) {
      panelStyle = {
        position: 'fixed',
        left: clampX(targetRect.left),
        bottom: window.innerHeight - targetRect.top + gap,
        width: panelWidth,
        maxHeight: Math.max(160, spaceAbove - gap - margin),
        overflowY: 'auto',
      };
    } else {
      panelStyle = {
        position: 'fixed',
        left: clampX(window.innerWidth - panelWidth - margin),
        bottom: margin,
        width: panelWidth,
        maxHeight: '50vh',
        overflowY: 'auto',
      };
    }
  }

  const primaryAction = activePanel.actions.find((a) => a.primary);
  const secondaryActions = activePanel.actions.filter((a) => !a.primary);

  return (
    <>
      <div className="fixed inset-0 z-[10050] pointer-events-none" role="dialog" aria-modal="true">
        {targetRect ? (
          <>
            <div className="fixed bg-black/60 pointer-events-auto" style={{ top: 0, left: 0, width: '100vw', height: Math.max(0, targetRect.top) }} />
            <div className="fixed bg-black/60 pointer-events-auto" style={{ top: targetRect.top, left: 0, width: Math.max(0, targetRect.left), height: targetRect.height }} />
            <div className="fixed bg-black/60 pointer-events-auto" style={{ top: targetRect.top, left: targetRect.left + targetRect.width, width: Math.max(0, viewportWidth() - targetRect.left - targetRect.width), height: targetRect.height }} />
            <div className="fixed bg-black/60 pointer-events-auto" style={{ top: targetRect.top + targetRect.height, left: 0, width: '100vw', height: Math.max(0, viewportHeight() - targetRect.top - targetRect.height) }} />
            {/* Без CSS-transition на geometry намеренно — при частых пересчётах
                (печать кода, результаты тестов) transition не успевал доиграть,
                и рамка визуально «зависала» между двумя реальными элементами. */}
            <div
              className="fixed rounded-2xl border-2 border-primary-500 pointer-events-none"
              style={{ top: targetRect.top, left: targetRect.left, width: targetRect.width, height: targetRect.height, boxShadow: '0 0 0 4px rgba(59,130,246,0.25)' }}
            />
          </>
        ) : (
          <div className="fixed inset-0 bg-black/60 pointer-events-auto" />
        )}
      </div>

      {/* Панель — сосед затемняющей обёртки (не потомок), чтобы её
          z-index (10060) реально стоял выше затемнения (10050). На
          мобильном это простой fixed bottom sheet — координаты рамки
          подсветки выше в этом файле ограничены её реальным верхним краем. */}
      <div ref={panelRef} className="card shadow-xl pointer-events-auto" style={{ ...panelStyle, zIndex: 10060 }}>
        <div className="flex items-start gap-3">
          <div className="hidden sm:flex shrink-0 w-9 h-9 rounded-lg bg-primary-50 text-primary-600 items-center justify-center font-bold">
            {activePanel.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wide text-primary-500 mb-0.5 flex items-center gap-1.5">
              <span>IT Практикум · обучение</span>
              {stepNumber !== null && (
                <span className="text-surface-300 font-semibold normal-case tracking-normal">· Шаг {stepNumber} из {stepOrder.length}</span>
              )}
            </div>
            <h3 className="text-base font-bold text-dark-700">{activePanel.title}</h3>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Закрыть помощника"
            className="shrink-0 w-7 h-7 rounded-md text-surface-400 hover:bg-surface-100 hover:text-dark-700"
          >
            ×
          </button>
        </div>

        {typing ? (
          <div className="mt-2 ml-0 sm:ml-12 text-sm text-surface-500 leading-snug sm:leading-relaxed">
            Помощник печатает код в редакторе…
          </div>
        ) : (
          <div
            className="mt-2 ml-0 sm:ml-12 text-sm text-surface-500 leading-snug sm:leading-relaxed [&_strong]:text-dark-700 [&_strong]:font-semibold"
            dangerouslySetInnerHTML={{ __html: activePanel.body }}
          />
        )}

        {/* Один явный главный CTA — крупная синяя кнопка. Второстепенное
            действие (обычно дублирует × в шапке смыслом «пропустить») —
            неприметная текстовая ссылка под ней, чтобы не конкурировать
            с основным действием визуально. */}
        <div className="mt-3 ml-0 sm:ml-12">
          <div className="flex flex-col sm:flex-row gap-2">
            {primaryAction && (
              <button
                key={primaryAction.id}
                type="button"
                disabled={typing || waiting}
                onClick={() => handleAction(primaryAction.id)}
                className="btn-primary w-full sm:flex-1 justify-center whitespace-normal sm:whitespace-nowrap py-2.5"
              >
                {primaryAction.label}
              </button>
            )}
          </div>
          {secondaryActions.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={typing || waiting}
              onClick={() => handleAction(a.id)}
              className="mt-2 w-full text-center text-xs text-surface-400 hover:text-surface-600 transition-colors disabled:opacity-50"
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
