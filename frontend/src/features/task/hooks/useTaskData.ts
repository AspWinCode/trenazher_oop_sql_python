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

export function useTaskData(taskId?: string) {
  const userId = useAuthStore((s) => s.user?.id);
  const isGuest = useAuthStore((s) => s.user?.is_guest ?? false);
  const [task, setTask] = useState<Task | null>(null);
  const [code, setCode] = useState('');
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
