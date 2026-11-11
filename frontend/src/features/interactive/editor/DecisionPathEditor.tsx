import type { DecisionPathConfig, EditorProps } from '../types';

let idCounter = 0;
const nextId = (p: string) => `${p}_${Date.now()}_${idCounter++}`;
const splitLines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const splitCsv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

const EMPTY: DecisionPathConfig = { start_step_id: '', steps: [], correct_paths: [[]] };

export default function DecisionPathEditor({ config, onChange }: EditorProps<DecisionPathConfig>) {
  const cfg = config ?? EMPTY;

  const addStep = () => {
    const id = nextId('step');
    const steps = [...cfg.steps, { id, prompt: '', options: [] }];
    onChange({ ...cfg, steps, start_step_id: cfg.start_step_id || id });
  };
  const updatePrompt = (stepId: string, prompt: string) => {
    onChange({ ...cfg, steps: cfg.steps.map((s) => (s.id === stepId ? { ...s, prompt } : s)) });
  };
  const removeStep = (stepId: string) => {
    onChange({
      ...cfg,
      steps: cfg.steps.filter((s) => s.id !== stepId),
      start_step_id: cfg.start_step_id === stepId ? '' : cfg.start_step_id,
    });
  };

  const addOption = (stepId: string) => {
    onChange({
      ...cfg,
      steps: cfg.steps.map((s) =>
        s.id === stepId ? { ...s, options: [...s.options, { id: nextId('opt'), text: '', next_step_id: null }] } : s,
      ),
    });
  };
  const updateOption = (stepId: string, optId: string, patch: Partial<DecisionPathConfig['steps'][number]['options'][number]>) => {
    onChange({
      ...cfg,
      steps: cfg.steps.map((s) =>
        s.id === stepId ? { ...s, options: s.options.map((o) => (o.id === optId ? { ...o, ...patch } : o)) } : s,
      ),
    });
  };
  const removeOption = (stepId: string, optId: string) => {
    onChange({
      ...cfg,
      steps: cfg.steps.map((s) => (s.id === stepId ? { ...s, options: s.options.filter((o) => o.id !== optId) } : s)),
    });
  };

  const pathsText = cfg.correct_paths.map((p) => p.join(', ')).join('\n');

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium block mb-1">Начальный шаг</label>
        <select
          value={cfg.start_step_id}
          onChange={(e) => onChange({ ...cfg, start_step_id: e.target.value })}
          className="border border-surface-300 rounded px-2 py-1 text-sm"
        >
          <option value="" disabled>— выбрать —</option>
          {cfg.steps.map((s) => <option key={s.id} value={s.id}>{s.prompt || s.id}</option>)}
        </select>
      </div>

      {cfg.steps.map((step) => (
        <div key={step.id} className="border border-surface-200 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <code className="text-xs bg-surface-100 px-1 rounded">{step.id}</code>
            <input
              type="text"
              value={step.prompt}
              onChange={(e) => updatePrompt(step.id, e.target.value)}
              placeholder="Текст шага / вопроса"
              className="flex-1 border border-surface-300 rounded px-2 py-1 text-sm"
            />
            <button type="button" onClick={() => removeStep(step.id)} className="text-red-500 text-sm">✕ шаг</button>
          </div>
          {step.options.map((opt) => (
            <div key={opt.id} className="flex items-center gap-2 pl-4">
              <code className="text-xs bg-surface-100 px-1 rounded">{opt.id}</code>
              <input
                type="text"
                value={opt.text}
                onChange={(e) => updateOption(step.id, opt.id, { text: e.target.value })}
                placeholder="Текст варианта действия"
                className="flex-1 border border-surface-300 rounded px-2 py-1 text-sm"
              />
              <select
                value={opt.next_step_id ?? ''}
                onChange={(e) => updateOption(step.id, opt.id, { next_step_id: e.target.value || null })}
                className="border border-surface-300 rounded px-2 py-1 text-sm"
              >
                <option value="">— конец —</option>
                {cfg.steps.filter((s) => s.id !== step.id).map((s) => (
                  <option key={s.id} value={s.id}>{s.prompt || s.id}</option>
                ))}
              </select>
              <button type="button" onClick={() => removeOption(step.id, opt.id)} className="text-red-500 text-sm">✕</button>
            </div>
          ))}
          <button type="button" onClick={() => addOption(step.id)} className="btn-sm border border-surface-300 ml-4">+ Вариант</button>
        </div>
      ))}
      <button type="button" onClick={addStep} className="btn-sm border border-surface-300">+ Шаг</button>

      <div>
        <label className="text-sm font-medium block mb-1">
          Правильные маршруты (id вариантов через запятую, один маршрут на строку)
        </label>
        <textarea
          defaultValue={pathsText}
          onBlur={(e) => onChange({ ...cfg, correct_paths: splitLines(e.target.value).map(splitCsv) })}
          rows={2}
          className="w-full border border-surface-300 rounded px-2 py-1 text-sm font-mono"
          placeholder="o1, o3"
        />
      </div>
    </div>
  );
}
