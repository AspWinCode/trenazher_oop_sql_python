import type { TaskType } from '../../types';

export const GUEST_TOUR_ENABLED = true;

export const TOUR_TASK_TYPES: TaskType[] = ['python_io', 'sql_query'];

export interface TourContent {
  wrongCode: string;
  correctCode: string;
  wrongExplanation: string;
  hintExplanation: string;
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
};

const SQL_TOUR: TourContent = {
  wrongCode: `SELECT *
FROM customers
LIMIT 5`,

  correctCode: `SELECT *
FROM customers
ORDER BY id
LIMIT 5`,

  wrongExplanation: 'Без ORDER BY порядок строк в результате не гарантирован — система ожидает предсказуемую сортировку.',
  hintExplanation: 'Добавьте ORDER BY, чтобы порядок строк совпадал с ожидаемым результатом.',
};

export function getTourContent(taskType: TaskType): TourContent | null {
  if (taskType === 'python_io') return PYTHON_TOUR;
  if (taskType === 'sql_query') return SQL_TOUR;
  return null;
}
