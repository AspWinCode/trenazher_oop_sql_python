export type MechanicCode =
  | 'multiple_choice'
  | 'matching'
  | 'ordering'
  | 'fill_blanks'
  | 'input_answer'
  | 'categorization'
  | 'odd_one_out'
  | 'multi_select_elements'
  | 'pattern_completion'
  | 'table_fill';

export const MECHANIC_LABELS: Record<MechanicCode, string> = {
  multiple_choice: 'Выбери правильный ответ',
  matching: 'Соедини пары',
  ordering: 'Расставь в правильном порядке',
  fill_blanks: 'Заполни пропуски',
  input_answer: 'Введи ответ',
  categorization: 'Распредели по категориям',
  odd_one_out: 'Найди лишний элемент',
  multi_select_elements: 'Найди все подходящие элементы',
  pattern_completion: 'Продолжи закономерность',
  table_fill: 'Заполни таблицу',
};

// --- multiple_choice ---
export interface MultipleChoiceOption {
  id: string;
  text: string;
}
export interface MultipleChoiceConfig {
  mode: 'single' | 'multi';
  options: MultipleChoiceOption[];
  correct_option_ids: string[];
  shuffle?: boolean;
}
export interface MultipleChoiceAnswer {
  selected_option_ids: string[];
}

// --- matching ---
export interface MatchingItem {
  id: string;
  text: string;
}
export interface MatchingConfig {
  left: MatchingItem[];
  right: MatchingItem[];
  correct_pairs: [string, string][];
}
export interface MatchingAnswer {
  pairs: [string, string][];
}

// --- ordering ---
export interface OrderingItem {
  id: string;
  text: string;
}
export interface OrderingConfig {
  items: OrderingItem[];
  correct_order: string[];
}
export interface OrderingAnswer {
  order: string[];
}

// --- fill_blanks ---
export type BlankInputMode = 'text' | 'number' | 'select' | 'drag';
export interface FillBlankDef {
  id: string;
  input_mode: BlankInputMode;
  options?: string[];
  correct_values: string[];
  tolerance?: number;
  case_sensitive?: boolean;
}
export interface FillBlanksConfig {
  template: string;
  blanks: FillBlankDef[];
}
export interface FillBlanksAnswer {
  blanks: Record<string, string>;
}

// --- input_answer ---
export interface InputAnswerConfig {
  answer_type: 'text' | 'number';
  accepted_answers?: string[];
  case_sensitive?: boolean;
  numeric_value?: number;
  tolerance?: number;
  tolerance_mode?: 'absolute' | 'relative';
}
export interface InputAnswerAnswer {
  answer: string | number;
}

// --- categorization ---
export interface CategoryDef {
  id: string;
  label: string;
}
export interface CategorizationItem {
  id: string;
  text: string;
}
export interface CategorizationConfig {
  categories: CategoryDef[];
  items: CategorizationItem[];
  correct_assignments: Record<string, string[]>;
}
export interface CategorizationAnswer {
  assignments: Record<string, string>;
}

// --- odd_one_out ---
export interface OddOneOutItem {
  id: string;
  text: string;
}
export interface OddOneOutConfig {
  items: OddOneOutItem[];
  correct_odd_ids: string[];
  explanation?: string;
}
export interface OddOneOutAnswer {
  selected_ids: string[];
}

// --- multi_select_elements ---
export interface MultiSelectItem {
  id: string;
  text: string;
}
export interface MultiSelectElementsConfig {
  prompt?: string;
  items: MultiSelectItem[];
  correct_ids: string[];
}
export interface MultiSelectElementsAnswer {
  selected_ids: string[];
}

// --- pattern_completion ---
export interface PatternCompletionConfig {
  sequence_shown: string[];
  next_values: string[];
  input_mode: 'text' | 'number';
  tolerance?: number;
  alternate_answers?: string[][];
}
export interface PatternCompletionAnswer {
  values: string[];
}

// --- table_fill ---
export interface TableColumnDef {
  id: string;
  label: string;
}
export interface TableRowDef {
  id: string;
  label: string;
}
export interface TableCellSpec {
  type: 'text' | 'number';
  values: string[];
  tolerance?: number;
  case_sensitive?: boolean;
}
export interface TableFillConfig {
  columns: TableColumnDef[];
  rows: TableRowDef[];
  locked_cells?: Record<string, string>;
  correct_cells: Record<string, TableCellSpec>;
}
export interface TableFillAnswer {
  cells: Record<string, string>;
}

export type MechanicConfig =
  | MultipleChoiceConfig
  | MatchingConfig
  | OrderingConfig
  | FillBlanksConfig
  | InputAnswerConfig
  | CategorizationConfig
  | OddOneOutConfig
  | MultiSelectElementsConfig
  | PatternCompletionConfig
  | TableFillConfig;

export type MechanicAnswer =
  | MultipleChoiceAnswer
  | MatchingAnswer
  | OrderingAnswer
  | FillBlanksAnswer
  | InputAnswerAnswer
  | CategorizationAnswer
  | OddOneOutAnswer
  | MultiSelectElementsAnswer
  | PatternCompletionAnswer
  | TableFillAnswer;

export interface RendererProps<TConfig = any, TAnswer = any> {
  config: TConfig;
  value: TAnswer | undefined;
  onAnswerChange: (answer: TAnswer) => void;
  disabled?: boolean;
}

export interface EditorProps<TConfig = any> {
  config: TConfig | null;
  onChange: (config: TConfig) => void;
}
