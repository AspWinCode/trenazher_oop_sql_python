import { useCallback, useEffect, useRef, useState } from 'react';
import { supportApi } from '../api';
import { useAuthStore } from '../store/auth';
import { SupportSocketClient } from '../services/realtime/supportSocket';
import type { AdminSupportThread, AdminSupportThreadDetail } from '../types';

const REFRESH_MS = 20_000;

function threadName(t: { user_full_name: string | null; user_login: string }) {
  return t.user_full_name || t.user_login;
}

export default function AdminSupportPage() {
  const { token } = useAuthStore();
  const [threads, setThreads] = useState<AdminSupportThread[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<AdminSupportThreadDetail | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const selectedRef = useRef<number | null>(null);
  selectedRef.current = selectedId;

  const loadThreads = useCallback(() => {
    supportApi.adminListThreads().then(({ data }) => setThreads(data)).catch(() => {});
  }, []);

  const loadDetail = useCallback((id: number) => {
    supportApi.adminGetThread(id).then(({ data }) => {
      setDetail(data);
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView());
      // Открытие сбрасывает непрочитанное на бэке — обновим список.
      loadThreads();
    }).catch(() => {});
  }, [loadThreads]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  // Поллинг списка + живое обновление по WS.
  useEffect(() => {
    const id = setInterval(loadThreads, REFRESH_MS);
    return () => clearInterval(id);
  }, [loadThreads]);

  useEffect(() => {
    if (!token) return;
    const socket = new SupportSocketClient({
      token,
      onNewMessage: ({ thread_id }) => {
        loadThreads();
        if (selectedRef.current === thread_id) loadDetail(thread_id);
      },
    });
    socket.start();
    return () => socket.stop();
  }, [token, loadThreads, loadDetail]);

  const handleSelect = (id: number) => {
    setSelectedId(id);
    setDetail(null);
    loadDetail(id);
  };

  const handleReply = async () => {
    const body = draft.trim();
    if (!body || !selectedId || sending) return;
    setSending(true);
    try {
      await supportApi.adminReply(selectedId, body);
      setDraft('');
      loadDetail(selectedId);
    } catch {
      /* оставляем черновик */
    } finally {
      setSending(false);
    }
  };

  const handleClose = async () => {
    if (!selectedId) return;
    await supportApi.adminClose(selectedId).catch(() => {});
    loadDetail(selectedId);
    loadThreads();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-dark-900 mb-4">Поддержка</h1>
      <div className="flex gap-4 h-[calc(100vh-12rem)]">
        {/* Список тредов */}
        <div className="w-80 shrink-0 bg-white rounded-2xl border border-surface-200 overflow-y-auto">
          {threads.length === 0 && (
            <div className="text-center text-surface-400 text-sm py-10">Обращений пока нет</div>
          )}
          {threads.map((t) => (
            <button
              key={t.id}
              onClick={() => handleSelect(t.id)}
              className={`w-full text-left px-4 py-3 border-b border-surface-100 transition-colors ${
                selectedId === t.id ? 'bg-primary-50' : 'hover:bg-surface-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-dark-900 truncate">{threadName(t)}</span>
                {t.unread_for_admin && <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />}
              </div>
              <div className="text-xs text-surface-400 truncate mt-0.5">
                {t.last_message_preview || '—'}
              </div>
              {t.status === 'closed' && (
                <span className="inline-block mt-1 text-[10px] uppercase tracking-wide text-surface-400">Закрыт</span>
              )}
            </button>
          ))}
        </div>

        {/* Детали треда */}
        <div className="flex-1 bg-white rounded-2xl border border-surface-200 flex flex-col overflow-hidden">
          {!detail ? (
            <div className="flex-1 flex items-center justify-center text-surface-400 text-sm">
              Выберите обращение слева
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-surface-200 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-dark-900">{threadName(detail)}</div>
                  <div className="text-xs text-surface-400">{detail.user_login}</div>
                </div>
                {detail.status === 'open' && (
                  <button
                    onClick={handleClose}
                    className="text-xs text-surface-500 hover:text-red-500 transition-colors"
                  >
                    Закрыть обращение
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-surface-50">
                {detail.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender === 'manager' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                        m.sender === 'manager'
                          ? 'bg-primary-600 text-white rounded-br-sm'
                          : 'bg-white text-dark-800 border border-surface-200 rounded-bl-sm'
                      }`}
                    >
                      {m.body}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <div className="p-3 border-t border-surface-200 flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); }
                  }}
                  placeholder="Ответ студенту…"
                  rows={2}
                  maxLength={4000}
                  className="flex-1 resize-none rounded-lg border border-surface-300 px-3 py-2 text-sm text-dark-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  onClick={handleReply}
                  disabled={sending || !draft.trim()}
                  className="shrink-0 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
                >
                  Отправить
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
