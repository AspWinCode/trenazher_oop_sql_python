import type { Task } from '../../types';

export const GUEST_TOUR_ENABLED = true;

export const TOUR_TASK_TYPES: Task['task_type'][] = ['python_io', 'sql_query'];

export interface TourContent {
  wrongCode: string;
  correctCode: string;
  // Показывается на шаге «Структура базы данных» (только для SQL — у Python-задачи такого шага нет).
  schemaExplanation?: string;
  // Показывается на шаге «Проверка показала ошибку».
  wrongResultExplanation: string;
  // Показывается на шаге «Появилась подсказка» — что именно поправить.
  hintExplanation: string;
  // Показывается на шаге «Код исправлен — проверим снова», перед реальной отправкой.
  correctExplanation: string;
  // Показывается, если после исправления реальная проверка всё равно не прошла
  // (на случай, если контент задачи в админке изменится).
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

  wrongResultExplanation: 'Здесь отображается, как отработал ваш код. Слева показан <strong>результат программы</strong>, а справа — <strong>результат, который ожидала система</strong>. Если хотя бы у одного теста указан статус «Неверно», задача пока не решена.',
  hintExplanation: 'В подсказках разобраны места, где ученики чаще всего допускают ошибки. Здесь система обращает внимание, что первый символ строки нужно получать через <strong>s[0]</strong>.',
  correctExplanation: 'Мы заменили <strong>s[1]</strong> на <strong>s[0]</strong>. Теперь первый символ определяется правильно. Давайте снова отправим решение и проверим все тесты.',
  tryYourselfExplanation: 'Похоже, в решении осталось ещё что-то неучтённое. Доработайте код и отправьте его ещё раз — вы уже знаете, как это работает.',
};

// Задача 1.1 курса SQL — «Отбор товаров для теста ценовой эластичности» (таблица products).
// Условие: цена от 300 до 1200 включительно, discount_pct = 0, stock_qty > 0,
// вывести product_name, price, margin (= price - cost), отсортировать по цене по убыванию.
const SQL_TOUR: TourContent = {
  wrongCode: `SELECT
  product_name,
  price,
  price - cost AS margin
FROM products
WHERE price > 300
  AND price < 1200
  AND discount_pct = 0
  AND stock_qty > 0
ORDER BY price DESC;`,

  correctCode: `SELECT
  product_name,
  price,
  price - cost AS margin
FROM products
WHERE price BETWEEN 300 AND 1200
  AND discount_pct = 0
  AND stock_qty > 0
ORDER BY price DESC;`,

  schemaExplanation: 'Перед запросом полезно посмотреть схему и начальные данные. В этой задаче нам понадобятся поля <strong>product_name, price, cost, discount_pct и stock_qty</strong>.',
  wrongResultExplanation: 'Здесь видно, чем результат запроса отличается от ожидаемого. В нашем варианте одна из границ диапазона исключается, поэтому выборка получается неполной. <strong>Такой блок удобно использовать для диагностики запроса.</strong>',
  hintExplanation: 'В подсказках разобраны места, где ученики чаще всего допускают ошибки. Здесь система подсказывает использовать <strong>BETWEEN</strong>. Он включает обе границы диапазона: <strong>price BETWEEN 300 AND 1200</strong> эквивалентно условиям <strong>price &gt;= 300 AND price &lt;= 1200</strong>.',
  correctExplanation: 'Теперь диапазон задан включительно через <strong>BETWEEN 300 AND 1200</strong>. Осталось снова отправить решение и проверить результат.',
  tryYourselfExplanation: 'Похоже, в запросе осталось ещё что-то неучтённое. Доработайте его и отправьте ещё раз — вы уже знаете, как это работает.',
};

export function getTourContent(task: Task): TourContent | null {
  if (task.task_type === 'python_io') return PYTHON_TOUR;
  if (task.task_type === 'sql_query') return SQL_TOUR;
  return null;
}
