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

const STEP_TARGET: Record<StepId, string> = {
  sidebar: 'sidebar',
  problem: 'condition',
  schema: 'schema',
  sample: 'sample',
  editor: 'editor',
  'submit-wrong-1': 'submit',
  'wrong-result': 'result',
  'submit-wrong-2': 'submit',
  hint: 'hints',
  'submit-correct': 'submit',
  success: 'result',
  'try-yourself': 'editor',
};

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

function getTargetRect(name: string): Rect | null {
  const el = document.querySelector(`[data-tour="${name}"]`);
  if (!el || !el.isConnected) return null;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  const padding = name === 'sidebar' ? 0 : 8;
  const left = Math.max(4, r.left - padding);
  const top = Math.max(4, r.top - padding);
  const right = Math.min(window.innerWidth - 4, r.right + padding);
  const bottom = Math.min(window.innerHeight - 4, r.bottom + padding);
  if (right <= left || bottom <= top) return null;
  return { top, left, width: right - left, height: bottom - top };
}

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

  const userId = useAuthStore((s) => s.user?.id);

  const [step, setStep] = useState<StepId>('sidebar');
  const [rect, setRect] = useState<Rect | null>(null);
  const [typing, setTyping] = useState(false);
  // Реальная высота панели — нужна, чтобы не давать панели уехать нижним
  // краем (кнопками) за пределы экрана, когда подсвеченный блок расположен
  // в нижней части страницы. Захардкоженный запас в px тут не годится:
  // высота панели сильно отличается между шагами (текст/число кнопок).
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState(260);
  useLayoutEffect(() => {
    if (panelRef.current) {
      setPanelHeight(panelRef.current.offsetHeight);
    }
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

  // Пересчитываем позицию спотлайта под текущий шаг.
  useEffect(() => {
    if (!content) return;
    const targetName = STEP_TARGET[step];
    let scrolledIntoView = false;

    const update = () => {
      const el = document.querySelector(`[data-tour="${targetName}"]`) as HTMLElement | null;
      // Прокручиваем к цели один раз, как только она появится в DOM —
      // иначе спотлайт и панель считаются от элемента, скрытого за краем экрана.
      if (el && !scrolledIntoView && targetName !== 'sidebar') {
        scrolledIntoView = true;
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        } catch {
          el.scrollIntoView();
        }
      }
      setRect(getTargetRect(targetName));
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
      body: 'Слева расположен список всех задач. <strong>Задачи доступны сразу</strong>, поэтому необязательно идти строго по порядку. Некоторые задачи можно пропускать, а к уже решённым возвращаться, чтобы потренироваться ещё раз.',
      actions: [
        { id: 'sidebar-next', label: 'Перейти к первой задаче', primary: true },
        { id: 'close', label: 'Закрыть помощника' },
      ],
    },
    problem: {
      icon: '1',
      title: 'Сначала прочитайте условие',
      body: 'Здесь описано, <strong>какую задачу должен решить ваш код</strong>: что поступает на вход программы и какой результат нужно вывести.',
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
      title: 'Это пример входных и выходных данных',
      body: sampleValue
        ? `Значение <strong>${escapeHtml(sampleValue)}</strong> система передаст вашему коду на вход. Программа должна обработать эти данные и вернуть результат именно в том виде, который указан в условии задачи.`
        : 'Такие данные система передаст вашему коду на вход. Программа должна вернуть результат именно в том виде, который указан в условии.',
      actions: [
        { id: 'next', label: 'Понял, идём дальше', primary: true },
        { id: 'close', label: 'Дальше сам разберусь' },
      ],
    },
    editor: {
      icon: '3',
      title: 'Напишем первый код вместе',
      body: 'Нажмите кнопку ниже — помощник напечатает решение в редакторе, чтобы вы увидели, как это работает.',
      actions: [
        { id: 'write-wrong', label: 'Написать первый код вместе', primary: true },
        { id: 'close', label: 'Продолжу самостоятельно' },
      ],
    },
    'submit-wrong-1': {
      icon: '4',
      title: 'Отправим решение на проверку',
      body: 'Нажмите <strong>«Отправить решение»</strong>: система выполнит программу на нескольких тестах и покажет результат.',
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
      body: 'Первый вариант не прошёл проверку. На платформе дополнительные подсказки появляются после <strong>2-й, 4-й и 6-й неверной попытки</strong>. Нажмите «Отправить решение» ещё раз, чтобы увидеть первую подсказку.',
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
      body: 'Код прошёл проверку. Вы познакомились с процессом работы на платформе — удачи в решении следующих задач!',
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

  const panelWidth = 480;
  let panelStyle: React.CSSProperties = { position: 'fixed', left: 16, right: 16, bottom: 16, width: 'auto', maxHeight: '60vh', overflowY: 'auto' };

  if (targetRect && window.innerWidth > 760) {
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

  return (
    <div className="fixed inset-0 z-[10050] pointer-events-none" role="dialog" aria-modal="true">
      {targetRect ? (
        <>
          <div className="fixed bg-black/60 pointer-events-auto" style={{ top: 0, left: 0, width: '100vw', height: Math.max(0, targetRect.top) }} />
          <div className="fixed bg-black/60 pointer-events-auto" style={{ top: targetRect.top, left: 0, width: Math.max(0, targetRect.left), height: targetRect.height }} />
          <div className="fixed bg-black/60 pointer-events-auto" style={{ top: targetRect.top, left: targetRect.left + targetRect.width, width: Math.max(0, window.innerWidth - targetRect.left - targetRect.width), height: targetRect.height }} />
          <div className="fixed bg-black/60 pointer-events-auto" style={{ top: targetRect.top + targetRect.height, left: 0, width: '100vw', height: Math.max(0, window.innerHeight - targetRect.top - targetRect.height) }} />
          <div
            className="fixed rounded-2xl border-2 border-primary-500 pointer-events-none transition-all duration-150"
            style={{ top: targetRect.top, left: targetRect.left, width: targetRect.width, height: targetRect.height, boxShadow: '0 0 0 4px rgba(59,130,246,0.25)' }}
          />
        </>
      ) : (
        <div className="fixed inset-0 bg-black/60 pointer-events-auto" />
      )}

      <div ref={panelRef} className="card fixed shadow-xl pointer-events-auto" style={{ ...panelStyle, zIndex: 10000 }}>
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center font-bold">
            {activePanel.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wide text-primary-500 mb-0.5">
              IT Практикум · обучение
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
          <div className="mt-3 ml-12 text-sm text-surface-500 leading-relaxed">
            Помощник печатает код в редакторе…
          </div>
        ) : (
          <div
            className="mt-3 ml-12 text-sm text-surface-500 leading-relaxed [&_strong]:text-dark-700 [&_strong]:font-semibold"
            dangerouslySetInnerHTML={{ __html: activePanel.body }}
          />
        )}

        <div className="mt-4 ml-12 flex gap-2">
          {activePanel.actions.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={typing || waiting}
              onClick={() => handleAction(a.id)}
              className={`flex-1 justify-center whitespace-nowrap ${a.primary ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
