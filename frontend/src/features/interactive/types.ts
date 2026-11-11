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
  | 'table_fill'
  | 'solution_correction'
  | 'situation_analysis'
  | 'find_error'
  | 'grouping'
  | 'restore_structure'
  | 'formula_builder'
  | 'object_assembly'
  | 'parameter_adjustment'
  | 'hotspot'
  | 'point_selection'
  | 'diagram_builder'
  | 'hierarchy_builder'
  | 'decision_path'
  | 'simulation'
  | 'comparison';

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
  solution_correction: 'Исправь готовое решение',
  situation_analysis: 'Разбери ситуацию',
  find_error: 'Найди ошибку',
  grouping: 'Составь группы',
  restore_structure: 'Восстанови повреждённую конструкцию',
  formula_builder: 'Собери формулу',
  object_assembly: 'Собери объект из частей',
  parameter_adjustment: 'Настрой параметры',
  hotspot: 'Отметь нужные части',
  point_selection: 'Укажи точку на изображении',
  diagram_builder: 'Собери схему',
  hierarchy_builder: 'Построй иерархию',
  decision_path: 'Построй маршрут решения',
  simulation: 'Работа с симулятором',
  comparison: 'Сравни два объекта',
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

// --- solution_correction ---
export interface SolutionCorrectionConfig {
  prompt?: string;
  initial_content: string;
  correct_values: string[];
  case_sensitive?: boolean;
}
export interface SolutionCorrectionAnswer {
  corrected_content: string;
}

// --- situation_analysis ---
export interface SituationAnalysisConfig {
  description: string;
  question: string;
  mode: 'choice' | 'text';
  options?: MultipleChoiceOption[];
  correct_option_ids?: string[];
  accepted_answers?: string[];
  case_sensitive?: boolean;
  explanation?: string;
}
export interface SituationAnalysisAnswer {
  selected_option_ids?: string[];
  answer?: string;
}

// --- find_error ---
export interface FindErrorItem {
  id: string;
  text: string;
}
export interface FindErrorConfig {
  items: FindErrorItem[];
  correct_error_ids: string[];
  explanation?: string;
}
export interface FindErrorAnswer {
  selected_ids: string[];
}

// --- grouping ---
export interface GroupingItem {
  id: string;
  text: string;
}
export interface GroupingConfig {
  items: GroupingItem[];
  correct_groups: string[][];
}
export interface GroupingAnswer {
  groups: string[][];
}

// --- restore_structure ---
export interface RestoreSlot {
  id: string;
  label: string;
}
export interface RestorePoolItem {
  id: string;
  text: string;
}
export interface RestoreStructureConfig {
  slots: RestoreSlot[];
  pool: RestorePoolItem[];
  correct_placements: Record<string, string>;
}
export interface RestoreStructureAnswer {
  placements: Record<string, string>;
}

// --- formula_builder ---
export interface FormulaBlock {
  id: string;
  text: string;
}
export interface FormulaBuilderConfig {
  prompt?: string;
  slots: { id: string }[];
  blocks: FormulaBlock[];
  correct_sequences: string[][];
  allow_reuse?: boolean;
}
export interface FormulaBuilderAnswer {
  sequence: string[];
}

// --- object_assembly ---
export interface AssemblyZone {
  id: string;
  label: string;
}
export interface AssemblyPart {
  id: string;
  text: string;
}
export interface ObjectAssemblyConfig {
  zones: AssemblyZone[];
  parts: AssemblyPart[];
  correct_placements: Record<string, string>;
}
export interface ObjectAssemblyAnswer {
  placements: Record<string, string>;
}

// --- parameter_adjustment ---
export interface ParameterDef {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}
export interface ParameterAdjustmentConfig {
  prompt?: string;
  parameters: ParameterDef[];
  formula: string;
  target_min: number;
  target_max: number;
}
export interface ParameterAdjustmentAnswer {
  values: Record<string, number>;
}

// --- hotspot ---
export interface HotspotRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface HotspotConfig {
  image_url?: string;
  regions: HotspotRegion[];
  correct_region_ids: string[];
}
export interface HotspotAnswer {
  selected_region_ids: string[];
}

// --- point_selection ---
export interface TargetPoint {
  id: string;
  x: number;
  y: number;
  radius: number;
}
export interface PointSelectionConfig {
  image_url?: string;
  target_points: TargetPoint[];
}
export interface PointSelectionAnswer {
  points: { x: number; y: number }[];
}

// --- diagram_builder ---
export interface DiagramNode {
  id: string;
  label: string;
}
export interface DiagramBuilderConfig {
  directed?: boolean;
  nodes: DiagramNode[];
  correct_edges: [string, string][];
}
export interface DiagramBuilderAnswer {
  edges: [string, string][];
}

// --- hierarchy_builder ---
export interface HierarchyNode {
  id: string;
  label: string;
}
export interface HierarchyBuilderConfig {
  nodes: HierarchyNode[];
  correct_parents: Record<string, string | null>;
}
export interface HierarchyBuilderAnswer {
  parents: Record<string, string | null>;
}

// --- decision_path ---
export interface DecisionOption {
  id: string;
  text: string;
  next_step_id: string | null;
}
export interface DecisionStep {
  id: string;
  prompt: string;
  options: DecisionOption[];
}
export interface DecisionPathConfig {
  start_step_id: string;
  steps: DecisionStep[];
  correct_paths: string[][];
}
export interface DecisionPathAnswer {
  path: string[];
}

// --- simulation ---
export interface SimulationConfig {
  prompt?: string;
  parameters: ParameterDef[];
  formula: string;
  target_min: number;
  target_max: number;
}
export interface SimulationAnswer {
  values: Record<string, number>;
}

// --- comparison ---
export interface ComparisonRegion {
  id: string;
  side: 'left' | 'right';
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface ComparisonConfig {
  left_image_url?: string;
  right_image_url?: string;
  regions: ComparisonRegion[];
  correct_region_ids: string[];
}
export interface ComparisonAnswer {
  selected_region_ids: string[];
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
  | TableFillConfig
  | SolutionCorrectionConfig
  | SituationAnalysisConfig
  | FindErrorConfig
  | GroupingConfig
  | RestoreStructureConfig
  | FormulaBuilderConfig
  | ObjectAssemblyConfig
  | ParameterAdjustmentConfig
  | HotspotConfig
  | PointSelectionConfig
  | DiagramBuilderConfig
  | HierarchyBuilderConfig
  | DecisionPathConfig
  | SimulationConfig
  | ComparisonConfig;

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
  | TableFillAnswer
  | SolutionCorrectionAnswer
  | SituationAnalysisAnswer
  | FindErrorAnswer
  | GroupingAnswer
  | RestoreStructureAnswer
  | FormulaBuilderAnswer
  | ObjectAssemblyAnswer
  | ParameterAdjustmentAnswer
  | HotspotAnswer
  | PointSelectionAnswer
  | DiagramBuilderAnswer
  | HierarchyBuilderAnswer
  | DecisionPathAnswer
  | SimulationAnswer
  | ComparisonAnswer;

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
