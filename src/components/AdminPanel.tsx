import { useState, useEffect, useCallback } from 'react';
import { adminApi, type UserSession } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

interface AdminService {
  id: number; title: string; is_active: boolean;
  is_blocked: boolean; booking_count: number;
}
interface AdminMaster {
  id: number; name: string; email: string;
  is_blocked: boolean; rating: number;
  booking_count: number; ref_count: number; services: AdminService[];
}

export default function AdminPanel({ session }: { session: UserSession }) {
  const [masters, setMasters] = useState<AdminMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await adminApi.list(session.session_token);
    if (Array.isArray(data)) setMasters(data);
    setLoading(false);
  }, [session.session_token]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, successMsg: string) => {
    setBusy(true);
    const res = await fn() as { ok?: boolean; error?: string };
    setBusy(false);
    if (res?.ok) { toast.success(successMsg); load(); }
    else toast.error(res?.error || 'Ошибка');
  };

  const blockMaster = (m: AdminMaster) =>
    act(() => adminApi.blockMaster(session.session_token, m.id, !m.is_blocked),
      m.is_blocked ? 'Мастер разблокирован' : 'Мастер заблокирован');

  const deleteMaster = (m: AdminMaster) => {
    if (!confirm(`Удалить мастера «${m.name}»? Это действие необратимо.`)) return;
    act(() => adminApi.deleteMaster(session.session_token, m.id), 'Мастер удалён');
  };

  const blockService = (token: string, s: AdminService) =>
    act(() => adminApi.blockService(token, s.id, !s.is_blocked),
      s.is_blocked ? 'Услуга разблокирована' : 'Услуга заблокирована');

  const deleteService = (token: string, s: AdminService) => {
    if (!confirm(`Удалить услугу «${s.title}»?`)) return;
    act(() => adminApi.deleteService(token, s.id), 'Услуга удалена');
  };

  return (
    <div className="px-4 pb-24 pt-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon name="ShieldCheck" size={20} className="text-primary" />
        <h2 className="font-display text-lg font-bold">Панель администратора</h2>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
        </div>
      ) : masters.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Мастеров нет</p>
      ) : (
        <div className="space-y-3">
          {masters.map(m => (
            <Card key={m.id} className={`overflow-hidden border-border ${m.is_blocked ? 'opacity-60' : ''}`}>
              {/* Заголовок мастера */}
              <div
                className="flex cursor-pointer items-center gap-3 p-3"
                onClick={() => setExpanded(expanded === m.id ? null : m.id)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-display font-semibold">{m.name}</p>
                    {m.is_blocked && <Badge variant="destructive" className="text-[10px]">Заблокирован</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Брони: {m.booking_count} · Рейтинг: {m.rating > 0 ? m.rating : '—'} · Услуг: {m.services.length} · Рефералов: {m.ref_count}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    disabled={busy}
                    onClick={e => { e.stopPropagation(); blockMaster(m); }}
                    className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${
                      m.is_blocked
                        ? 'bg-success/15 text-success hover:bg-success/25'
                        : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    }`}
                    title={m.is_blocked ? 'Разблокировать' : 'Заблокировать'}
                  >
                    <Icon name={m.is_blocked ? 'LockOpen' : 'Lock'} size={14} />
                  </button>
                  <button
                    disabled={busy}
                    onClick={e => { e.stopPropagation(); deleteMaster(m); }}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20"
                    title="Удалить мастера"
                  >
                    <Icon name="Trash2" size={14} />
                  </button>
                  <Icon name={expanded === m.id ? 'ChevronUp' : 'ChevronDown'} size={16} className="text-muted-foreground" />
                </div>
              </div>

              {/* Услуги мастера (раскрывается) */}
              {expanded === m.id && (
                <div className="border-t border-border bg-secondary/30 px-3 py-2 space-y-2">
                  {m.services.length === 0 ? (
                    <p className="py-2 text-xs text-muted-foreground">Услуг нет</p>
                  ) : m.services.map(s => (
                    <div key={s.id}
                      className={`flex items-center justify-between gap-2 rounded-xl border border-border bg-background p-2 ${s.is_blocked ? 'opacity-60' : ''}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{s.title}</p>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>Брони: {s.booking_count}</span>
                          {s.is_blocked && <Badge variant="destructive" className="text-[9px] px-1 py-0">Заблокирована</Badge>}
                          {!s.is_active && !s.is_blocked && <Badge variant="secondary" className="text-[9px] px-1 py-0">Неактивна</Badge>}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          disabled={busy}
                          onClick={() => blockService(session.session_token, s)}
                          className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                            s.is_blocked
                              ? 'bg-success/15 text-success hover:bg-success/25'
                              : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          }`}
                          title={s.is_blocked ? 'Разблокировать' : 'Заблокировать'}
                        >
                          <Icon name={s.is_blocked ? 'LockOpen' : 'Lock'} size={12} />
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => deleteService(session.session_token, s)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20"
                          title="Удалить услугу"
                        >
                          <Icon name="Trash2" size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Button variant="outline" size="sm" className="mt-4 w-full rounded-xl" onClick={load} disabled={loading}>
        <Icon name="RefreshCw" size={14} className="mr-1.5" /> Обновить
      </Button>
    </div>
  );
}