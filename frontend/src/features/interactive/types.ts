export type MechanicCode = 'multiple_choice' | 'matching' | 'ordering' | 'fill_blanks' | 'input_answer';

export const MECHANIC_LABELS: Record<MechanicCode, string> = {
  multiple_choice: 'Выбери правильный ответ',
  matching: 'Соедини пары',
  ordering: 'Расставь в правильном порядке',
  fill_blanks: 'Заполни пропуски',
  input_answer: 'Введи ответ',
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

export type MechanicConfig =
  | MultipleChoiceConfig
  | MatchingConfig
  | OrderingConfig
  | FillBlanksConfig
  | InputAnswerConfig;

export type MechanicAnswer =
  | MultipleChoiceAnswer
  | MatchingAnswer
  | OrderingAnswer
  | FillBlanksAnswer
  | InputAnswerAnswer;

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
