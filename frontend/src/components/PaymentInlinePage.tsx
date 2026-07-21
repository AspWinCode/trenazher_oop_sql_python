import { useState } from 'react';
import { paymentsApi } from '../api';
import type { Course } from '../types';

type PlanId = 'python' | 'sql' | 'bundle';

interface Plan {
  id: PlanId;
  title: string;
  description: string;
  oldPrice: number;
  price: number;
  badge?: string;
}

const PLANS: Plan[] = [
  {
    id: 'python',
    title: 'Доступ к задачам Python',
    description: '186 практических задач по Python',
    oldPrice: 16000,
    price: 5995,
  },
  {
    id: 'sql',
    title: 'Доступ к задачам SQL',
    description: '149 практических задач по SQL',
    oldPrice: 14000,
    price: 4995,
  },
  {
    id: 'bundle',
    title: 'Пакет Python + SQL',
    description: 'Полный доступ ко всем задачам',
    oldPrice: 21000,
    price: 8995,
    badge: 'Выгоднее',
  },
];

function fmt(n: number) {
  return new Intl.NumberFormat('ru-RU').format(n) + ' ₽';
}

interface Props {
  courses: Course[];
}

export default function PaymentInlinePage({ courses }: Props) {
  const [planId, setPlanId] = useState<PlanId>('python');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [consented, setConsented] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'name' | 'email' | 'phone' | 'consent', boolean>>>({});

  const selectedPlan = PLANS.find(p => p.id === planId) ?? PLANS[0];

  const findCourseId = (id: PlanId): number | null => {
    const keyword = id === 'bundle' ? 'python' : id;
    const c = courses.find(c => c.title.toLowerCase().includes(keyword));
    return c?.id ?? courses[0]?.id ?? null;
  };

  const clearField = (field: keyof typeof fieldErrors) => {
    setFieldErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errs: typeof fieldErrors = {};
    if (name.trim().length < 2) errs.name = true;
    if (!email.trim().includes('@')) errs.email = true;
    if (phone.trim().replace(/\D/g, '').length < 7) errs.phone = true;
    if (!consented) errs.consent = true;

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setFormError('Проверьте, пожалуйста, заполнение формы.');
      return;
    }

    const courseId = findCourseId(planId);
    if (!courseId) {
      setFormError('Не удалось определить курс. Попробуйте позже.');
      return;
    }

    setLoading(true);
    setFormError(null);
    try {
      const { data } = await paymentsApi.initPayment(courseId);
      window.location.href = data.payment_url;
    } catch {
      setFormError('Не удалось перейти к оплате. Попробуйте ещё раз.');
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-surface-50">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Заголовок */}
        <div className="rounded-2xl overflow-hidden mb-6"
          style={{ background: 'radial-gradient(circle at 90% 10%, rgba(0,131,255,0.28), transparent 38%), #061b2c' }}>
          <div className="px-8 py-7">
            <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold mb-3"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: '#bfdbfe' }}>
              Полный доступ к практике
            </div>
            <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">
              Выберите подходящий вариант
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
              После оплаты откроются все задачи выбранного курса, а прогресс будет сохраняться в личном кабинете.
            </p>
          </div>
        </div>

        {/* Форма */}
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6">
          <form onSubmit={handleSubmit} noValidate>

            {/* Выбор плана */}
            <fieldset className="sf-payment-form__plans">
              <legend className="sf-payment-form__section-title">Выберите доступ</legend>
              <div className="sf-payment-plans">
                {PLANS.map(plan => (
                  <label key={plan.id} className="sf-payment-plan">
                    <input
                      className="sf-payment-plan__radio"
                      type="radio"
                      name="inline-plan"
                      value={plan.id}
                      checked={planId === plan.id}
                      onChange={() => setPlanId(plan.id)}
                    />
                    <span className="sf-payment-plan__card">
                      <span className="sf-payment-plan__check" aria-hidden="true">
                        <svg viewBox="0 0 20 20" fill="none">
                          <path d="m5 10 3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span className="sf-payment-plan__main">
                        <span className="sf-payment-plan__header">
                          <span className="sf-payment-plan__title">{plan.title}</span>
                          {plan.badge && <span className="sf-payment-plan__badge">{plan.badge}</span>}
                        </span>
                        <span className="sf-payment-plan__description">{plan.description}</span>
                      </span>
                      <span className="sf-payment-plan__prices">
                        <span className="sf-payment-plan__old-price">{fmt(plan.oldPrice)}</span>
                        <span className="sf-payment-plan__price">{fmt(plan.price)}</span>
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Контактные данные */}
            <div className="sf-payment-form__section">
              <div className="sf-payment-form__section-title">Контактные данные</div>
              <div className="sf-payment-form__fields">
                <label className="sf-payment-field">
                  <span className="sf-payment-field__label">Имя</span>
                  <input
                    className={`sf-payment-field__input${fieldErrors.name ? ' sf-payment-field__input--invalid' : ''}`}
                    type="text"
                    placeholder="Как к вам обращаться"
                    autoComplete="name"
                    value={name}
                    onChange={e => { setName(e.target.value); clearField('name'); }}
                  />
                  <span className="sf-payment-field__error">Укажите имя</span>
                </label>
                <label className="sf-payment-field">
                  <span className="sf-payment-field__label">Электронная почта</span>
                  <input
                    className={`sf-payment-field__input${fieldErrors.email ? ' sf-payment-field__input--invalid' : ''}`}
                    type="email"
                    placeholder="example@mail.ru"
                    autoComplete="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); clearField('email'); }}
                  />
                  <span className="sf-payment-field__error">Укажите корректную электронную почту</span>
                </label>
                <label className="sf-payment-field">
                  <span className="sf-payment-field__label">Телефон</span>
                  <input
                    className={`sf-payment-field__input${fieldErrors.phone ? ' sf-payment-field__input--invalid' : ''}`}
                    type="tel"
                    placeholder="+7 999 123-45-67"
                    autoComplete="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={e => { setPhone(e.target.value); clearField('phone'); }}
                  />
                  <span className="sf-payment-field__error">Укажите корректный номер телефона</span>
                </label>
              </div>
            </div>

            {/* Согласие */}
            <div className={`sf-payment-consent${fieldErrors.consent ? ' sf-payment-consent--invalid' : ''}`}>
              <label className="sf-payment-consent__label">
                <input
                  className="sf-payment-consent__checkbox"
                  type="checkbox"
                  checked={consented}
                  onChange={e => { setConsented(e.target.checked); clearField('consent'); }}
                />
                <span className="sf-payment-consent__text">
                  Даю согласие на{' '}
                  <a href="https://sf.education/legalinfo" target="_blank" rel="noreferrer">
                    обработку персональных данных
                  </a>
                  {' '}и{' '}
                  <a href="https://sf.education/legalinfo" target="_blank" rel="noreferrer">
                    условия публичной оферты
                  </a>
                </span>
              </label>
              <span className="sf-payment-consent__error">Необходимо дать согласие для продолжения</span>
            </div>

            {/* Ошибка формы */}
            {formError && (
              <div className="sf-payment-form__message sf-payment-form__message--error" role="alert">
                {formError}
              </div>
            )}

            {/* Кнопка */}
            <button
              className={`sf-payment-form__submit${loading ? ' sf-payment-form__submit--loading' : ''}`}
              type="submit"
              disabled={loading}
            >
              <span>{loading ? 'Переход к оплате...' : `Оплатить ${fmt(selectedPlan.price)}`}</span>
              <span className="sf-payment-form__spinner" aria-hidden="true" />
            </button>


          </form>
        </div>
      </div>
    </div>
  );
}
