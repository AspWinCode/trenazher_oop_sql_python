import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Submission, Task, TaskHint } from '../../types';
import { getTourContent } from './tourContent';

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
  | 'sample'
  | 'editor'
  | 'submit-wrong-1'
  | 'wrong-result'
  | 'submit-wrong-2'
  | 'hint'
  | 'submit-correct'
  | 'success';

type PendingSubmit = 'wrong-1' | 'wrong-2' | 'correct' | null;

const STEP_TARGET: Record<StepId, string> = {
  sidebar: 'sidebar',
  problem: 'condition',
  sample: 'sample',
  editor: 'editor',
  'submit-wrong-1': 'submit',
  'wrong-result': 'result',
  'submit-wrong-2': 'submit',
  hint: 'hints',
  'submit-correct': 'submit',
  success: 'result',
};

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
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
  const content = useMemo(() => getTourContent(task.task_type), [task.task_type]);

  const [step, setStep] = useState<StepId>('sidebar');
  const [rect, setRect] = useState<Rect | null>(null);
  const [typing, setTyping] = useState(false);
  const pendingRef = useRef<PendingSubmit>(null);
  const [pending, setPending] = useState<PendingSubmit>(null);
  const hintsBeforeSecondAttempt = useRef(0);

  const close = useCallback(() => {
    onFinish();
  }, [onFinish]);

  // Пересчитываем позицию спотлайта под текущий шаг.
  useEffect(() => {
    if (!content) return;
    const targetName = STEP_TARGET[step];

    const update = () => setRect(getTargetRect(targetName));
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

  // Ждём завершения проверки решения и решаем, куда переходить дальше.
  useEffect(() => {
    if (!pending) return;
    if (submission?.status !== 'finished') return;

    const kind = pending;
    pendingRef.current = null;
    setPending(null);

    if (kind === 'wrong-1') {
      setStep('wrong-result');
    } else if (kind === 'wrong-2') {
      if (hints.length > hintsBeforeSecondAttempt.current) {
        setStep('hint');
      } else {
        // Подсказка не открылась (например, изменена настройка unlock_attempts) — не блокируем гостя.
        setStep('hint');
      }
    } else if (kind === 'correct') {
      setStep(submission.verdict === 'AC' ? 'success' : 'wrong-result');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submission?.status, submission?.verdict, pending]);

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

  function handleSubmit(kind: PendingSubmit) {
    if (submitting || pending) return;
    if (kind === 'wrong-2') hintsBeforeSecondAttempt.current = hints.length;
    pendingRef.current = kind;
    setPending(kind);
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
      body: 'Слева расположен список всех задач. Задачи доступны сразу, поэтому необязательно идти строго по порядку. Некоторые задачи можно пропускать, а к уже решённым возвращаться, чтобы потренироваться ещё раз.',
      actions: [
        { id: 'sidebar-next', label: 'Перейти к первой задаче', primary: true },
        { id: 'close', label: 'Закрыть помощника' },
      ],
    },
    problem: {
      icon: '1',
      title: 'Сначала прочитайте условие',
      body: 'Здесь описано, какую задачу должен решить ваш код: что поступает на вход программы и какой результат нужно вывести.',
      actions: [
        { id: 'next', label: 'Понял, идём дальше', primary: true },
        { id: 'close', label: 'Дальше сам разберусь' },
      ],
    },
    sample: {
      icon: '2',
      title: 'Это пример входных и выходных данных',
      body: 'Такие данные система передаст вашему коду на вход. Программа должна вернуть результат именно в том виде, который указан в условии.',
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
      body: 'Нажмите «Отправить решение»: система выполнит программу на нескольких тестах и покажет результат.',
      actions: [
        { id: 'submit-wrong-1', label: 'Отправить решение', primary: true },
        { id: 'close', label: 'Дальше сам разберусь' },
      ],
    },
    'wrong-result': {
      icon: '5',
      title: 'Проверка показала ошибку',
      body: content.wrongExplanation,
      actions: [
        { id: 'continue-after-wrong', label: 'Понял, давай продолжим', primary: true },
        { id: 'close', label: 'Дальше сам разберусь' },
      ],
    },
    'submit-wrong-2': {
      icon: '6',
      title: 'Отправим решение ещё раз',
      body: 'Дополнительные подсказки открываются после нескольких неверных попыток. Нажмите «Отправить решение» ещё раз.',
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
      body: 'Мы исправили код по подсказке. Отправьте решение ещё раз и посмотрите на результат.',
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
  };

  function handleAction(id: string) {
    switch (id) {
      case 'close':
        close();
        break;
      case 'sidebar-next':
        setStep('problem');
        break;
      case 'next':
        setStep(step === 'problem' ? 'sample' : 'editor');
        break;
      case 'write-wrong':
        handleWriteWrongCode();
        break;
      case 'submit-wrong-1':
        handleSubmit('wrong-1');
        break;
      case 'continue-after-wrong':
        setStep('submit-wrong-2');
        break;
      case 'submit-wrong-2':
        handleSubmit('wrong-2');
        break;
      case 'apply-hint':
        handleApplyHint();
        break;
      case 'submit-correct':
        handleSubmit('correct');
        break;
      default:
        break;
    }
  }

  const waiting = Boolean(pending);
  const activePanel = waiting
    ? { icon: '↻', title: 'Проверяем решение', body: 'Система запускает код на открытом и скрытых тестах. Подождите немного.', actions: [{ id: 'close', label: 'Закрыть помощника' }] }
    : panels[step];

  if (!activePanel) return null;

  const panelWidth = 420;
  let panelStyle: React.CSSProperties = { position: 'fixed', left: 16, right: 16, bottom: 16, width: 'auto' };

  if (targetRect && window.innerWidth > 760) {
    const gap = 16;
    const margin = 12;
    const spaceRight = window.innerWidth - targetRect.left - targetRect.width;
    const spaceBelow = window.innerHeight - targetRect.top - targetRect.height;

    if (spaceRight >= panelWidth + gap + margin) {
      panelStyle = {
        position: 'fixed',
        left: targetRect.left + targetRect.width + gap,
        top: Math.min(Math.max(margin, targetRect.top), window.innerHeight - 260 - margin),
        width: panelWidth,
      };
    } else if (spaceBelow >= 220) {
      panelStyle = {
        position: 'fixed',
        left: Math.min(Math.max(margin, targetRect.left), window.innerWidth - panelWidth - margin),
        top: targetRect.top + targetRect.height + gap,
        width: panelWidth,
      };
    } else {
      panelStyle = {
        position: 'fixed',
        left: Math.max(margin, window.innerWidth - panelWidth - margin),
        bottom: margin,
        width: panelWidth,
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

      <div className="card fixed shadow-xl pointer-events-auto" style={{ ...panelStyle, zIndex: 10000 }}>
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

        <div className="mt-3 ml-12 text-sm text-surface-500 leading-relaxed">
          {typing ? 'Помощник печатает код в редакторе…' : activePanel.body}
        </div>

        <div className="mt-4 ml-12 flex flex-wrap gap-2">
          {activePanel.actions.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={typing || waiting}
              onClick={() => handleAction(a.id)}
              className={a.primary ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
