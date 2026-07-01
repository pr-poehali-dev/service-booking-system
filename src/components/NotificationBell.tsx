import { useState, useEffect, useRef } from 'react';
import Icon from '@/components/ui/icon';
import { notificationsApi } from '@/lib/api';

interface Notification {
  id: number;
  booking_id: number | null;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

// По заголовку уведомления определяем нужный фильтр
function titleToFilter(title: string): 'pending' | 'confirmed' | 'done' {
  if (title === 'Новая заявка' || title === 'Клиент отменил запись') return 'pending';
  if (title === 'Заявка подтверждена') return 'confirmed';
  if (title === 'Услуга оказана') return 'done';
  return 'pending';
}

interface Props {
  token: string;
  onGoBooking?: (bookingId: number, filter: 'pending' | 'confirmed' | 'done') => void;
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  return new Date(iso).toLocaleDateString('ru', { day: 'numeric', month: 'short' });
}

export default function NotificationBell({ token, onGoBooking }: Props) {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  // -1 = первая загрузка, не показывать toast на старые уведомления
  const prevUnread = useRef(-1);
  const panelRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await notificationsApi.list(tokenRef.current);
        if (cancelled || !res?.items) return;
        setItems(res.items);
        const u: number = res.unread ?? 0;
        // Показываем badge анимацию только при появлении НОВЫХ (не при первой загрузке)
        if (prevUnread.current !== -1 && u > prevUnread.current) {
          // Мигнуть иконкой — просто обновляем счётчик, этого достаточно
        }
        prevUnread.current = u;
        setUnread(u);
      } catch {
        // сетевая ошибка — молчим
      }
    };

    load();
    const interval = setInterval(load, 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
   
  }, []);  // [] — интервал стартует один раз, читает token через ref

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = async () => {
    const wasOpen = open;
    setOpen(o => !o);
    if (!wasOpen && unread > 0) {
      await notificationsApi.readAll(token);
      setItems(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnread(0);
      prevUnread.current = 0;
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleOpen}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl hover:bg-secondary"
        aria-label="Уведомления"
      >
        <Icon name="Bell" size={18} className="text-muted-foreground" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-0.5 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-4 right-4 top-16 z-50 mx-auto w-80 max-w-full rounded-2xl border border-border bg-background shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-11 sm:w-80">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold">Уведомления</span>
            {items.some(n => !n.is_read) && (
              <button
                onClick={async () => {
                  await notificationsApi.readAll(token);
                  setItems(prev => prev.map(n => ({ ...n, is_read: true })));
                  setUnread(0);
                  prevUnread.current = 0;
                }}
                className="text-[11px] text-primary hover:underline"
              >
                Прочитать все
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Нет уведомлений</p>
            ) : (
              items.map(n => (
                <div
                  key={n.id}
                  onClick={() => {
                    if (n.booking_id && onGoBooking) {
                      onGoBooking(n.booking_id, titleToFilter(n.title));
                      // Скрываем уведомление из списка сразу после клика
                      setItems(prev => prev.filter(item => item.id !== n.id));
                      setUnread(prev => Math.max(0, prev - (n.is_read ? 0 : 1)));
                      prevUnread.current = Math.max(0, prevUnread.current - (n.is_read ? 0 : 1));
                      setOpen(false);
                    }
                  }}
                  className={`border-b border-border/50 px-4 py-3 last:border-0 transition-colors ${
                    !n.is_read ? 'bg-primary/5' : ''
                  } ${n.booking_id && onGoBooking ? 'cursor-pointer hover:bg-secondary/60' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-[13px] font-medium leading-tight ${!n.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {n.title}
                    </p>
                    <div className="flex shrink-0 items-center gap-1">
                      {!n.is_read && <span className="mt-0.5 h-2 w-2 rounded-full bg-primary" />}
                      {n.booking_id && onGoBooking && <Icon name="ChevronRight" size={12} className="text-muted-foreground/50" />}
                    </div>
                  </div>
                  <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground/60">{timeAgo(n.created_at)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}