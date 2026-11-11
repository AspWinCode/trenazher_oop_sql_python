import type { ComponentType } from 'react';
import type { EditorProps, MechanicCode, RendererProps } from './types';

import MultipleChoiceRenderer from './renderer/MultipleChoiceRenderer';
import MatchingRenderer from './renderer/MatchingRenderer';
import OrderingRenderer from './renderer/OrderingRenderer';
import FillBlanksRenderer from './renderer/FillBlanksRenderer';
import InputAnswerRenderer from './renderer/InputAnswerRenderer';
import CategorizationRenderer from './renderer/CategorizationRenderer';
import OddOneOutRenderer from './renderer/OddOneOutRenderer';
import MultiSelectElementsRenderer from './renderer/MultiSelectElementsRenderer';
import PatternCompletionRenderer from './renderer/PatternCompletionRenderer';
import TableFillRenderer from './renderer/TableFillRenderer';
import SolutionCorrectionRenderer from './renderer/SolutionCorrectionRenderer';
import SituationAnalysisRenderer from './renderer/SituationAnalysisRenderer';
import FindErrorRenderer from './renderer/FindErrorRenderer';
import GroupingRenderer from './renderer/GroupingRenderer';
import RestoreStructureRenderer from './renderer/RestoreStructureRenderer';
import FormulaBuilderRenderer from './renderer/FormulaBuilderRenderer';
import ObjectAssemblyRenderer from './renderer/ObjectAssemblyRenderer';
import ParameterAdjustmentRenderer from './renderer/ParameterAdjustmentRenderer';
import HotspotRenderer from './renderer/HotspotRenderer';
import PointSelectionRenderer from './renderer/PointSelectionRenderer';
import DiagramBuilderRenderer from './renderer/DiagramBuilderRenderer';
import HierarchyBuilderRenderer from './renderer/HierarchyBuilderRenderer';
import DecisionPathRenderer from './renderer/DecisionPathRenderer';
import SimulationRenderer from './renderer/SimulationRenderer';
import ComparisonRenderer from './renderer/ComparisonRenderer';

import MultipleChoiceEditor from './editor/MultipleChoiceEditor';
import MatchingEditor from './editor/MatchingEditor';
import OrderingEditor from './editor/OrderingEditor';
import FillBlanksEditor from './editor/FillBlanksEditor';
import InputAnswerEditor from './editor/InputAnswerEditor';
import CategorizationEditor from './editor/CategorizationEditor';
import OddOneOutEditor from './editor/OddOneOutEditor';
import MultiSelectElementsEditor from './editor/MultiSelectElementsEditor';
import PatternCompletionEditor from './editor/PatternCompletionEditor';
import TableFillEditor from './editor/TableFillEditor';
import SolutionCorrectionEditor from './editor/SolutionCorrectionEditor';
import SituationAnalysisEditor from './editor/SituationAnalysisEditor';
import FindErrorEditor from './editor/FindErrorEditor';
import GroupingEditor from './editor/GroupingEditor';
import RestoreStructureEditor from './editor/RestoreStructureEditor';
import FormulaBuilderEditor from './editor/FormulaBuilderEditor';
import ObjectAssemblyEditor from './editor/ObjectAssemblyEditor';
import ParameterAdjustmentEditor from './editor/ParameterAdjustmentEditor';
import HotspotEditor from './editor/HotspotEditor';
import PointSelectionEditor from './editor/PointSelectionEditor';
import DiagramBuilderEditor from './editor/DiagramBuilderEditor';
import HierarchyBuilderEditor from './editor/HierarchyBuilderEditor';
import DecisionPathEditor from './editor/DecisionPathEditor';
import SimulationEditor from './editor/SimulationEditor';
import ComparisonEditor from './editor/ComparisonEditor';

interface RegistryEntry {
  label: string;
  Renderer: ComponentType<RendererProps<any, any>>;
  Editor: ComponentType<EditorProps<any>>;
}

// One entry per mechanic. Adding mechanic #6+ later = one new renderer file +
// one new editor file + one new line here — nothing else needs to change.
export const ExerciseRegistry: Record<string, RegistryEntry> & Record<MechanicCode, RegistryEntry> = {
  multiple_choice: {
    label: 'Выбери правильный ответ',
    Renderer: MultipleChoiceRenderer,
    Editor: MultipleChoiceEditor,
  },
  matching: {
    label: 'Соедини пары',
    Renderer: MatchingRenderer,
    Editor: MatchingEditor,
  },
  ordering: {
    label: 'Расставь в правильном порядке',
    Renderer: OrderingRenderer,
    Editor: OrderingEditor,
  },
  fill_blanks: {
    label: 'Заполни пропуски',
    Renderer: FillBlanksRenderer,
    Editor: FillBlanksEditor,
  },
  input_answer: {
    label: 'Введи ответ',
    Renderer: InputAnswerRenderer,
    Editor: InputAnswerEditor,
  },
  categorization: {
    label: 'Распредели по категориям',
    Renderer: CategorizationRenderer,
    Editor: CategorizationEditor,
  },
  odd_one_out: {
    label: 'Найди лишний элемент',
    Renderer: OddOneOutRenderer,
    Editor: OddOneOutEditor,
  },
  multi_select_elements: {
    label: 'Найди все подходящие элементы',
    Renderer: MultiSelectElementsRenderer,
    Editor: MultiSelectElementsEditor,
  },
  pattern_completion: {
    label: 'Продолжи закономерность',
    Renderer: PatternCompletionRenderer,
    Editor: PatternCompletionEditor,
  },
  table_fill: {
    label: 'Заполни таблицу',
    Renderer: TableFillRenderer,
    Editor: TableFillEditor,
  },
  solution_correction: {
    label: 'Исправь готовое решение',
    Renderer: SolutionCorrectionRenderer,
    Editor: SolutionCorrectionEditor,
  },
  situation_analysis: {
    label: 'Разбери ситуацию',
    Renderer: SituationAnalysisRenderer,
    Editor: SituationAnalysisEditor,
  },
  find_error: {
    label: 'Найди ошибку',
    Renderer: FindErrorRenderer,
    Editor: FindErrorEditor,
  },
  grouping: {
    label: 'Составь группы',
    Renderer: GroupingRenderer,
    Editor: GroupingEditor,
  },
  restore_structure: {
    label: 'Восстанови повреждённую конструкцию',
    Renderer: RestoreStructureRenderer,
    Editor: RestoreStructureEditor,
  },
  formula_builder: {
    label: 'Собери формулу',
    Renderer: FormulaBuilderRenderer,
    Editor: FormulaBuilderEditor,
  },
  object_assembly: {
    label: 'Собери объект из частей',
    Renderer: ObjectAssemblyRenderer,
    Editor: ObjectAssemblyEditor,
  },
  parameter_adjustment: {
    label: 'Настрой параметры',
    Renderer: ParameterAdjustmentRenderer,
    Editor: ParameterAdjustmentEditor,
  },
  hotspot: {
    label: 'Отметь нужные части',
    Renderer: HotspotRenderer,
    Editor: HotspotEditor,
  },
  point_selection: {
    label: 'Укажи точку на изображении',
    Renderer: PointSelectionRenderer,
    Editor: PointSelectionEditor,
  },
  diagram_builder: {
    label: 'Собери схему',
    Renderer: DiagramBuilderRenderer,
    Editor: DiagramBuilderEditor,
  },
  hierarchy_builder: {
    label: 'Построй иерархию',
    Renderer: HierarchyBuilderRenderer,
    Editor: HierarchyBuilderEditor,
  },
  decision_path: {
    label: 'Построй маршрут решения',
    Renderer: DecisionPathRenderer,
    Editor: DecisionPathEditor,
  },
  simulation: {
    label: 'Работа с симулятором',
    Renderer: SimulationRenderer,
    Editor: SimulationEditor,
  },
  comparison: {
    label: 'Сравни два объекта',
    Renderer: ComparisonRenderer,
    Editor: ComparisonEditor,
  },
};
