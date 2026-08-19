import type { Task } from '../../types';

export const GUEST_TOUR_ENABLED = true;

export const TOUR_TASK_TYPES: Task['task_type'][] = ['python_io', 'sql_query'];

export interface TourContent {
  wrongCode: string;
  correctCode: string;
  // Показывается на шаге «Появилась подсказка» — что именно поправить.
  hintExplanation: string;
  // Показывается на шаге «Код исправлен — проверим снова», перед реальной отправкой.
  correctExplanation: string;
  // Показывается, если после исправления реальная проверка всё равно не прошла
  // (для SQL это ожидаемо — схема и бизнес-логика у каждой задачи свои).
  tryYourselfExplanation: string;
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

  hintExplanation: 'В подсказках разобраны места, где ученики чаще всего допускают ошибки. Здесь система обращает внимание, что первый символ строки нужно получать через <strong>s[0]</strong>.',
  correctExplanation: 'Мы заменили <strong>s[1]</strong> на <strong>s[0]</strong>. Теперь первый символ определяется правильно. Давайте снова отправим решение и проверим все тесты.',
  tryYourselfExplanation: 'Похоже, в решении осталось ещё что-то неучтённое. Доработайте код и отправьте его ещё раз — вы уже знаете, как это работает.',
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

    hintExplanation: 'Добавьте <strong>ORDER BY</strong>, чтобы порядок строк был предсказуемым, и перепроверьте, все ли нужные условия и столбцы учтены в запросе.',
    correctExplanation: 'Мы добавили <strong>ORDER BY</strong>, чтобы порядок строк был предсказуемым. Отправим решение и посмотрим на результат — у этой конкретной задачи может быть своя бизнес-логика, которую мы заранее не знаем.',
    tryYourselfExplanation: 'Отправленный запрос не прошёл проверку — у этой задачи своя бизнес-логика (фильтры, нужные столбцы), которую мы не подгружали заранее. Доработайте запрос под условия именно этой задачи и отправьте его ещё раз — вы уже знаете, как это работает.',
  };
}

export function getTourContent(task: Task): TourContent | null {
  if (task.task_type === 'python_io') return PYTHON_TOUR;
  if (task.task_type === 'sql_query') return buildSqlTour(task.sql_schema);
  return null;
}
