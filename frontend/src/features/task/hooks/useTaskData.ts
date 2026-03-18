import { useCallback, useEffect, useState } from 'react';
import { progressApi, submissionsApi, tasksApi } from '../../../api';
import type { Submission, Task, TaskHint } from '../../../types';

const DEFAULT_PLACEHOLDERS: Record<string, string> = {
  sql_query: '-- Ваш SQL запрос\nSELECT ',
  cpp_io: '#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n',
  js_io: '// Ваше решение\nconst readline = require("readline");\nconst rl = readline.createInterface({ input: process.stdin });\n\nrl.on("line", (line) => {\n    \n});\n',
};

function resolveInitialCode(taskType: string): string {
  return DEFAULT_PLACEHOLDERS[taskType] || '# Ваше решение\n';
}

export function useTaskData(taskId?: string) {
  const [task, setTask] = useState<Task | null>(null);
  const [code, setCode] = useState('');
  const [history, setHistory] = useState<Submission[]>([]);
  const [hints, setHints] = useState<TaskHint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHints, setShowHints] = useState(false);

  const refreshHistory = useCallback((tid: number) => {
    submissionsApi.list(tid).then(({ data }) => setHistory(data));
  }, []);

  const refreshHints = useCallback((tid: number) => {
    progressApi.getHints(tid).then(({ data }) => setHints(data)).catch(() => {});
  }, []);

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
        setCode(resolveInitialCode(data.task_type));
      })
      .finally(() => setLoading(false));

    refreshHistory(id);
    refreshHints(id);
  }, [taskId, refreshHistory, refreshHints]);

  return {
    task,
    code,
    setCode,
    history,
    hints,
    loading,
    showHints,
    setShowHints,
    refreshHistory,
    refreshHints,
  };
}
