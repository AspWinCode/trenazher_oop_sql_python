import type { Task } from '../../types';

export const GUEST_TOUR_ENABLED = true;

export const TOUR_TASK_TYPES: Task['task_type'][] = ['python_io', 'sql_query'];

export interface TourContent {
  wrongCode: string;
  correctCode: string;
  wrongExplanation: string;
  hintExplanation: string;
  // Python-пример решает реальную задачу 1.1 — можно честно дойти до статуса «Верно».
  // SQL-пример не привязан к конкретной задаче (схема у каждой SQL-задачи своя),
  // поэтому гарантировать реальный AC нельзя — тур завершается после подсказки,
  // не утверждая, что решение верное.
  canAutoSolve: boolean;
}

const PYTHON_TOUR: TourContent = {
  wrongCode: `s = input()

first_symbol = s[1]
last_symbol = s[-1]
length = len(s)
reversed_string = s[::-1]

print("Первый:", first_symbol)
print("Последний:", last_symbol)
print("Длина:", length)
print("Обратный:", reversed_string)`,

  correctCode: `s = input()

first_symbol = s[0]
last_symbol = s[-1]
length = len(s)
reversed_string = s[::-1]

print("Первый:", first_symbol)
print("Последний:", last_symbol)
print("Длина:", length)
print("Обратный:", reversed_string)`,

  wrongExplanation: 'Первый символ строки нужно получать через s[0], а не s[1] — индексация начинается с нуля.',
  hintExplanation: 'Индексы строк начинаются с 0, поэтому первый символ — это s[0].',
  canAutoSolve: true,
};

function extractTableName(schema?: string | null): string {
  const match = schema?.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["'`]?(\w+)["'`]?/i);
  return match?.[1] ?? 'items';
}

function buildSqlTour(schema?: string | null): TourContent {
  const table = extractTableName(schema);
  return {
    wrongCode: `SELECT *
FROM ${table}
LIMIT 5`,

    // ORDER BY 1 сортирует по первому столбцу результата — работает независимо
    // от реальных имён колонок конкретной задачи (мы их не знаем заранее).
    correctCode: `SELECT *
FROM ${table}
ORDER BY 1
LIMIT 5`,

    wrongExplanation: 'Результат не прошёл проверку — сравните вывод вашего запроса с ожидаемым эталоном ниже и найдите отличие.',
    hintExplanation: 'Добавьте ORDER BY, чтобы порядок строк был предсказуемым, и перепроверьте, все ли нужные условия и столбцы учтены в запросе.',
    canAutoSolve: false,
  };
}

export function getTourContent(task: Task): TourContent | null {
  if (task.task_type === 'python_io') return PYTHON_TOUR;
  if (task.task_type === 'sql_query') return buildSqlTour(task.sql_schema);
  return null;
}
