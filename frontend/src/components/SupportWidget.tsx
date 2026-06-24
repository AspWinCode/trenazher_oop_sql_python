import { useCallback, useEffect, useRef, useState } from 'react';
import { supportApi } from '../api';
import { useAuthStore } from '../store/auth';
import { SupportSocketClient } from '../services/realtime/supportSocket';
import type { SupportMessage } from '../types';

export default function SupportWidget() {
  const { user, token } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [unread, setUnread] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const socketRef = useRef<SupportSocketClient | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  const isGuest = user?.is_guest ?? false;
  // Виджет — только для зарегистрированных (не гость, не админ).
  const enabled = !!user && !isGuest && user.role !== 'admin';

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
  }, []);

  // Первичная загрузка треда.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    supportApi
      .getThread()
      .then(({ data }) => {
        if (cancelled || !data) { setLoaded(true); return; }
        setMessages(data.messages);
        setUnread(data.unread_for_student);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => { cancelled = true; };
  }, [enabled]);

  // WebSocket-подписка на ответы менеджера.
  useEffect(() => {
    if (!enabled || !token) return;
    const socket = new SupportSocketClient({
      token,
      onReply: ({ message }) => {
        setMessages((prev) =>
          prev.some((m) => m.id === message.id) ? prev : [...prev, message]
        );
        if (openRef.current) {
          supportApi.markRead().catch(() => {});
          scrollToBottom();
        } else {
          setUnread(true);
        }
      },
    });
    socketRef.current = socket;
    socket.start();
    return () => { socket.stop(); socketRef.current = null; };
  }, [enabled, token, scrollToBottom]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    setUnread(false);
    supportApi.markRead().catch(() => {});
    scrollToBottom();
  }, [scrollToBottom]);

  const handleSend = useCallback(async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const { data } = await supportApi.sendMessage(body);
      setMessages((prev) => [...prev, data]);
      setDraft('');
      scrollToBottom();
    } catch {
      /* ошибка отправки — оставляем черновик */
    } finally {
      setSending(false);
    }
  }, [draft, sending, scrollToBottom]);

  if (!enabled) return null;

  return (
    <>
      {/* Плавающая кнопка */}
      {!open && (
        <button
          onClick={handleOpen}
          className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-primary-600 hover:bg-primary-500 text-white shadow-lg flex items-center justify-center transition-colors"
          aria-label="Поддержка"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l.8-3.6A7.94 7.94 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {unread && (
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-white" />
          )}
        </button>
      )}

      {/* Панель */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[22rem] max-w-[calc(100vw-2.5rem)] h-[28rem] max-h-[calc(100vh-2.5rem)] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
          <div className="bg-primary-600 text-white px-4 py-3 flex items-center justify-between">
            <div>
              <div className="font-semibold text-sm">Поддержка</div>
              <div className="text-xs text-primary-100">Обычно отвечаем в течение дня</div>
            </div>
            <button onClick={() => setOpen(false)} className="text-primary-100 hover:text-white" aria-label="Закрыть">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
            {!loaded && <div className="text-center text-gray-400 text-sm mt-4">Загрузка…</div>}
            {loaded && messages.length === 0 && (
              <div className="text-center text-gray-400 text-sm mt-6 px-4">
                Задайте вопрос — менеджер ответит здесь.
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.sender === 'student' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                    m.sender === 'student'
                      ? 'bg-primary-600 text-white rounded-br-sm'
                      : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
                  }`}
                >
                  {m.body}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="p-2 border-t border-gray-200 bg-white flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder="Напишите сообщение…"
              rows={1}
              maxLength={4000}
              className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 max-h-24"
            />
            <button
              onClick={handleSend}
              disabled={sending || !draft.trim()}
              className="shrink-0 w-9 h-9 rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-40 text-white flex items-center justify-center transition-colors"
              aria-label="Отправить"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
