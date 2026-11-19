import { useCallback, useEffect, useState } from 'react';
import { progressApi, submissionsApi, tasksApi } from '../../../api';
import { useAuthStore } from '../../../store/auth';
import type { Submission, Task, TaskHint } from '../../../types';

const DEFAULT_PLACEHOLDERS: Record<string, string> = {
  sql_query: '-- Ваш SQL запрос\nSELECT ',
  cpp_io: '#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n',
  js_io: '// Ваше решение\nconst readline = require("readline");\nconst rl = readline.createInterface({ input: process.stdin });\n\nrl.on("line", (line) => {\n    \n});\n',
};

function resolveInitialCode(taskType: string): string {
  return DEFAULT_PLACEHOLDERS[taskType] || '# Ваше решение\n';
}

// Черновик привязан к пользователю — иначе код, написанный в демо (гостем),
// подхватывался бы для той же задачи после входа в реальный аккаунт.
function storageKey(userId: number | undefined, taskId: number) {
  return `code_task_${userId ?? 'anon'}_${taskId}`;
}

// Старый (до-пользовательский) ключ. Под ним лежат черновики, сохранённые до
// перехода на ключ с userId — их нужно один раз перенести, а не потерять.
function legacyStorageKey(taskId: number) {
  return `code_task_${taskId}`;
}

// Черновик ответа интерактивного упражнения — тот же принцип, что и у кода:
// без этого перезагрузка страницы сбрасывала уже выбранные пары/порядок/категории.
function answerStorageKey(userId: number | undefined, taskId: number) {
  return `answer_task_${userId ?? 'anon'}_${taskId}`;
}

export function useTaskData(taskId?: string) {
  const userId = useAuthStore((s) => s.user?.id);
  const isGuest = useAuthStore((s) => s.user?.is_guest ?? false);
  const [task, setTask] = useState<Task | null>(null);
  const [code, setCode] = useState('');
  // Lazy initializer, not an effect: renderers like OrderingRenderer seed a
  // default answer back up on their own mount effect if `value` is still
  // empty, and child effects run before parent effects on the same commit —
  // an effect-based restore here would lose the race and the seed would
  // overwrite the just-read draft before this ever saw it.
  const [interactiveAnswer, setInteractiveAnswerState] = useState<unknown>(() => {
    if (!taskId) return undefined;
    const id = Number(taskId);
    if (Number.isNaN(id)) return undefined;
    try {
      const saved = localStorage.getItem(answerStorageKey(userId, id));
      return saved !== null ? JSON.parse(saved) : undefined;
    } catch {
      return undefined;
    }
  });
  const [history, setHistory] = useState<Submission[]>([]);
  const [hints, setHints] = useState<TaskHint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHints, setShowHints] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);

  const refreshHistory = useCallback((tid: number) => {
    submissionsApi.list(tid).then(({ data }) => setHistory(data));
  }, []);

  const refreshHints = useCallback((tid: number) => {
    progressApi.getHints(tid).then(({ data }) => {
      setHints((prev) => {
        // Автоматически показываем подсказки если появились новые
        if (data.length > prev.length && data.length > 0) {
          setShowHints(true);
        }
        return data;
      });
    }).catch(() => {});
  }, []);

  const handleSetCode = useCallback((newCode: string) => {
    setCode(newCode);
    if (taskId) {
      try {
        localStorage.setItem(storageKey(userId, Number(taskId)), newCode);
        setDraftSavedAt(new Date());
      } catch {}
    }
  }, [taskId, userId]);

  const clearDraft = useCallback(() => {
    if (taskId) {
      try { localStorage.removeItem(storageKey(userId, Number(taskId))); } catch {}
      if (task) setCode(resolveInitialCode(task.task_type));
      setDraftSavedAt(null);
    }
  }, [taskId, userId, task]);

  const hasDraft = useCallback(() => {
    if (!taskId) return false;
    try { return localStorage.getItem(storageKey(userId, Number(taskId))) !== null; } catch { return false; }
  }, [taskId, userId]);

  const setInteractiveAnswer = useCallback((answer: unknown) => {
    setInteractiveAnswerState(answer);
    if (taskId) {
      try {
        localStorage.setItem(answerStorageKey(userId, Number(taskId)), JSON.stringify(answer));
      } catch {}
    }
  }, [taskId, userId]);

  // Восстановление черновика ответа не зависит от загрузки самой задачи —
  // достаточно taskId, поэтому делаем это в отдельном эффекте, а не внутри
  // then() запроса tasksApi.get (иначе при быстрой смене задачи может на
  // мгновение остаться ответ от предыдущей).
  useEffect(() => {
    if (!taskId) { setInteractiveAnswerState(undefined); return; }
    const id = Number(taskId);
    if (Number.isNaN(id)) { setInteractiveAnswerState(undefined); return; }
    try {
      const saved = localStorage.getItem(answerStorageKey(userId, id));
      setInteractiveAnswerState(saved !== null ? JSON.parse(saved) : undefined);
    } catch {
      setInteractiveAnswerState(undefined);
    }
  }, [taskId, userId]);

  useEffect(() => {
    if (!taskId) {
      setLoading(false);
      return;
    }

    const id = Number(taskId);
    if (Number.isNaN(id)) {
      setLoading(false);
      return;
    }

    setLoading(true);

    tasksApi.get(id)
      .then(({ data }) => {
        setTask(data);
        try {
          const key = storageKey(userId, id);
          let saved = localStorage.getItem(key);
          // Разовый перенос черновика со старого ключа (для реальных аккаунтов) —
          // чтобы код, сохранённый до привязки ключа к пользователю, не «пропал».
          if (saved === null && userId != null && !isGuest) {
            const legacy = localStorage.getItem(legacyStorageKey(id));
            if (legacy !== null) {
              saved = legacy;
              try { localStorage.setItem(key, legacy); } catch {}
            }
          }
          setCode(saved ?? resolveInitialCode(data.task_type));
        } catch {
          setCode(resolveInitialCode(data.task_type));
        }
      })
      .finally(() => setLoading(false));

    refreshHistory(id);
    refreshHints(id);
  }, [taskId, userId, isGuest, refreshHistory, refreshHints]);

  return {
    task,
    code,
    setCode: handleSetCode,
    interactiveAnswer,
    setInteractiveAnswer,
    history,
    hints,
    loading,
    showHints,
    setShowHints,
    refreshHistory,
    refreshHints,
    draftSavedAt,
    clearDraft,
    hasDraft,
  };
}
