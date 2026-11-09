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
};
