import { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import NotificationBell from '@/components/NotificationBell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  mastersApi, servicesApi, bookingsApi, ratingsApi, authApi,
  saveSession, type UserSession,
} from '@/lib/api';
import SlotCalendar from '@/components/SlotCalendar';
import PhotoUpload from '@/components/PhotoUpload';
import {
  type Master, type Service, type Booking, type Tab,
  NAV, NAV_ADMIN, fmtPrice, fmtTime, fmtDate, minutesLeft,
} from '@/types/app';

// ─── TopBar ──────────────────────────────────────────────────────────────────
export function TopBar({ session, onLogout }: { session: UserSession; onLogout: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Icon name="Sparkles" size={16} />
          </div>
          <span className="font-display text-base font-bold tracking-tight">Лепесток</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden flex-col items-end sm:flex">
            <span className="text-sm font-medium leading-tight">{session.name}</span>
            <span className="text-xs text-muted-foreground leading-tight">{session.email}</span>
          </div>
          <NotificationBell token={session.session_token} />
          <button onClick={onLogout} className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-secondary">
            <Icon name="LogOut" size={17} className="text-muted-foreground" />
          </button>
        </div>
      </div>
    </header>
  );
}

// ─── BottomNav ────────────────────────────────────────────────────────────────
export function BottomNav({ active, onChange, isAdmin }: {
  active: Tab; onChange: (t: Tab) => void; isAdmin?: boolean;
}) {
  const nav = isAdmin ? NAV_ADMIN : NAV;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl items-stretch justify-around">
        {nav.map(item => (
          <button key={item.id} onClick={() => onChange(item.id)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors ${
              active === item.id ? 'text-primary' : 'text-muted-foreground'
            }`}>
            <Icon name={item.icon} size={21} />
            <span className="text-[11px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

// ─── Кабинет мастера ──────────────────────────────────────────────────────────
export function MasterCabinet({ session, setSession }: {
  session: UserSession; setSession: (s: UserSession) => void;
}) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [profile, setProfile] = useState<Master | null>(null);
  const [loading, setLoading] = useState(true);
  const [editProfile, setEditProfile] = useState(false);
  const [form, setForm] = useState({ name: '', about: '', address: '' });
  const [showAddSvc, setShowAddSvc] = useState(false);
  const [newSvc, setNewSvc] = useState({ title: '', description: '', price: '', price_type: 'fixed' });
  const [newSvcPhotos, setNewSvcPhotos] = useState<[string|null, string|null, string|null]>([null, null, null]);
  const [editingSvc, setEditingSvc] = useState<number | null>(null);
  const [editSvcForm, setEditSvcForm] = useState({ title: '', description: '', price: '', price_type: 'fixed' });
  const [editSvcPhotos, setEditSvcPhotos] = useState<[string|null, string|null, string|null]>([null, null, null]);
  const [activeTab, setActiveTab] = useState<'bookings' | 'services' | 'schedule'>('bookings');
  const [bookingFilter, setBookingFilter] = useState<'pending' | 'confirmed' | 'done'>('confirmed');
  const [becomingMaster, setBecomingMaster] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!session.master_id) return;
    setLoading(true);
    const [bk, pr] = await Promise.all([
      bookingsApi.list(session.session_token, 'master'),
      mastersApi.get(session.master_id),
    ]);
    if (Array.isArray(bk)) setBookings(bk);
    if (pr?.id) {
      setProfile(pr);
      setForm({ name: pr.name || '', about: pr.about || '', address: pr.address || '' });
      setProfilePhoto(pr.photo_url || null);
      if (Array.isArray(pr.services)) setServices(pr.services);
    }
    setLoading(false);
  }, [session]);

  // Polling: новые брони появляются автоматически каждые 20 сек
  useEffect(() => {
    loadAll();
    if (!session.master_id) return;
    const interval = setInterval(async () => {
      const bk = await bookingsApi.list(session.session_token, 'master');
      if (Array.isArray(bk)) setBookings(bk);
    }, 20_000);
    return () => clearInterval(interval);
  }, [loadAll, session.master_id, session.session_token]);

  const updateStatus = async (id: number, status: string) => {
    await bookingsApi.updateStatus(session.session_token, id, status);
    const msg = status === 'confirmed' ? 'Бронь подтверждена!' : status === 'done' ? 'Услуга оказана' : 'Бронь отменена';
    toast.success(msg);
    loadAll();
  };

  const handleProfilePhotoChange = async (url: string | null) => {
    setProfilePhoto(url);
    await mastersApi.update(session.session_token, { photo_url: url || '' });
    toast.success(url ? 'Фото обновлено' : 'Фото удалено');
    loadAll();
  };

  const saveProfile = async () => {
    await mastersApi.update(session.session_token, {
      name: form.name, about: form.about, address: form.address,
      ...(profilePhoto !== null ? { photo_url: profilePhoto } : {}),
    });
    const updated = { ...session, name: form.name, address: form.address };
    setSession(updated);
    saveSession(updated);
    toast.success('Профиль сохранён');
    setEditProfile(false);
    loadAll();
  };

  const addService = async () => {
    if (!newSvc.title || !newSvc.price) return toast.error('Введите название и цену');
    const res = await servicesApi.create(session.session_token, {
      title: newSvc.title, description: newSvc.description || undefined,
      price_type: newSvc.price_type, price: parseFloat(newSvc.price),
      photo1_url: newSvcPhotos[0] || undefined,
      photo2_url: newSvcPhotos[1] || undefined,
      photo3_url: newSvcPhotos[2] || undefined,
    });
    if (res?.id) {
      toast.success('Услуга добавлена');
      setShowAddSvc(false);
      setNewSvc({ title: '', description: '', price: '', price_type: 'fixed' });
      setNewSvcPhotos([null, null, null]);
      loadAll();
    } else toast.error(res?.error || 'Ошибка');
  };

  const deleteService = async (id: number) => {
    await servicesApi.remove(session.session_token, id);
    toast.success('Услуга удалена');
    loadAll();
  };

  const startEditSvc = (s: Service) => {
    setEditingSvc(s.id);
    setEditSvcForm({ title: s.title, description: s.description || '', price: String(s.price), price_type: s.price_type });
    setEditSvcPhotos([s.photo1_url, s.photo2_url, s.photo3_url]);
    setShowAddSvc(false);
  };

  const saveEditSvc = async () => {
    if (!editingSvc) return;
    if (!editSvcForm.title || !editSvcForm.price) return toast.error('Введите название и цену');
    const res = await servicesApi.update(session.session_token, editingSvc, {
      title: editSvcForm.title,
      description: editSvcForm.description || null,
      price_type: editSvcForm.price_type,
      price: parseFloat(editSvcForm.price),
      photo1_url: editSvcPhotos[0] ?? '',
      photo2_url: editSvcPhotos[1] ?? '',
      photo3_url: editSvcPhotos[2] ?? '',
    });
    if (res?.ok) {
      toast.success('Услуга обновлена');
      setEditingSvc(null);
      loadAll();
    } else toast.error(res?.error || 'Ошибка');
  };

  const becomeMaster = async () => {
    setBecomingMaster(true);
    const res = await authApi.becomeMaster(session.session_token);
    setBecomingMaster(false);
    if (res?.master_id) {
      const updated = { ...session, is_master: true, master_id: res.master_id };
      setSession(updated);
      saveSession(updated);
      toast.success('Профиль мастера создан!');
    } else {
      toast.error(res?.error || 'Ошибка');
    }
  };

  if (!session.master_id) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-20 text-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-secondary">
          <Icon name="Briefcase" size={32} className="text-primary" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">Хотите принимать клиентов?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Откройте кабинет мастера — добавляйте услуги, управляйте расписанием и принимайте записи.
          </p>
        </div>
        <Button className="h-12 w-full max-w-xs rounded-2xl" disabled={becomingMaster} onClick={becomeMaster}>
          {becomingMaster ? 'Создаём профиль...' : 'Стать мастером'}
          <Icon name="Sparkles" size={17} className="ml-2" />
        </Button>
        <p className="text-xs text-muted-foreground">Вы по-прежнему сможете записываться к другим мастерам</p>
      </div>
    );
  }

  const active  = bookings.filter(b => b.status !== 'cancelled');
  const pending = bookings.filter(b => b.status === 'pending');
  const done    = bookings.filter(b => b.status === 'done');

  return (
    <div className="px-4 pb-24 pt-5">
      <h2 className="mb-4 font-display text-lg font-bold">Кабинет мастера</h2>

      {profile?.ref_code && (
        <Card className="mb-4 border-border p-3">
          <p className="mb-1 text-[11px] text-muted-foreground">Ваша реферальная ссылка</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-secondary px-2 py-1.5 text-[11px] font-mono text-foreground">
              {`${window.location.origin}?ref=${profile.ref_code}`}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}?ref=${profile!.ref_code}`);
                toast.success('Ссылка скопирована');
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary hover:bg-primary/10"
            >
              <Icon name="Copy" size={14} />
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">Поделитесь ссылкой — знакомые зарегистрируются как ваши приглашённые</p>
        </Card>
      )}

      <div className="mb-4 grid grid-cols-3 gap-2">
        {[['Записей', active.length, 'Calendar'], ['Ждут', pending.length, 'Clock'], ['Готово', done.length, 'BadgeCheck']].map(([l, v, ic], i) => (
          <Card key={i} className="border-border p-3 text-center">
            <Icon name={ic as string} size={18} className="mx-auto mb-1 text-primary" />
            <div className="font-mono-tnum text-lg font-bold">{v}</div>
            <div className="text-[11px] text-muted-foreground">{l}</div>
          </Card>
        ))}
      </div>

      {/* Профиль */}
      {!loading && profile && (
        <Card className="mb-4 border-border p-4">
          {editProfile ? (
            <div className="space-y-3">
              <p className="font-display text-sm font-semibold">Редактировать профиль</p>
              <div className="flex items-center gap-4">
                <PhotoUpload
                  token={session.session_token}
                  url={profilePhoto}
                  target="master"
                  size="lg"
                  shape="round"
                  onUploaded={handleProfilePhotoChange}
                />
                <p className="text-xs text-muted-foreground">Фото профиля<br/>отображается в каталоге</p>
              </div>
              {[
                { key: 'name', placeholder: 'Имя и фамилия' },
                { key: 'address', placeholder: 'Адрес кабинета / студии' },
              ].map(f => (
                <input key={f.key} placeholder={f.placeholder}
                  value={form[f.key as keyof typeof form]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                />
              ))}
              <textarea placeholder="О себе" value={form.about} rows={3}
                onChange={e => setForm(p => ({ ...p, about: e.target.value }))}
                className="w-full rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex gap-2">
                <Button size="sm" className="h-9 flex-1 rounded-xl" onClick={saveProfile}>Сохранить</Button>
                <Button size="sm" variant="outline" className="h-9 flex-1 rounded-xl" onClick={() => setEditProfile(false)}>Отмена</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {profilePhoto
                  ? <img src={profilePhoto} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
                  : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary">
                      <Icon name="User" size={22} className="text-muted-foreground" />
                    </div>
                }
                <div className="min-w-0">
                  <p className="font-display font-semibold">{profile.name}</p>
                  {profile.address && (
                    <p className="flex items-center gap-0.5 text-xs text-muted-foreground truncate">
                      <Icon name="MapPin" size={11} />{profile.address}
                    </p>
                  )}
                  {profile.about && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{profile.about}</p>}
                </div>
              </div>
              <Button size="sm" variant="outline" className="h-8 shrink-0 rounded-xl" onClick={() => setEditProfile(true)}>
                <Icon name="Pencil" size={14} />
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Табы */}
      <div className="mb-4 flex gap-1">
        {(['bookings', 'services', 'schedule'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
            }`}>
            {t === 'bookings' ? 'Записи' : t === 'services' ? 'Услуги' : 'Расписание'}
          </button>
        ))}
      </div>

      {/* ЗАПИСИ */}
      {activeTab === 'bookings' && (
        <div className="space-y-3">
          {/* Фильтр по статусу */}
          {(() => {
            const pending   = bookings.filter(b => b.status === 'pending');
            const confirmed = bookings.filter(b => b.status === 'confirmed');
            const done      = bookings.filter(b => b.status === 'done');
            const FILTERS: { key: 'pending' | 'confirmed' | 'done'; label: string; count: number }[] = [
              { key: 'pending',   label: 'Ожидают',   count: pending.length },
              { key: 'confirmed', label: 'Активные',  count: confirmed.length },
              { key: 'done',      label: 'Завершены', count: done.length },
            ];
            const filtered = bookings.filter(b => b.status === bookingFilter);
            return (
              <>
                <div className="flex gap-1">
                  {FILTERS.map(f => (
                    <button key={f.key} onClick={() => setBookingFilter(f.key)}
                      className={`flex flex-1 items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-medium transition-colors ${
                        bookingFilter === f.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                      }`}>
                      {f.label}
                      {f.count > 0 && (
                        <span className={`rounded-full px-1.5 text-[10px] font-bold ${
                          bookingFilter === f.key ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/15 text-primary'
                        }`}>{f.count}</span>
                      )}
                    </button>
                  ))}
                </div>
                {loading ? <Skeleton className="h-32 rounded-2xl" /> : filtered.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Нет заявок</p>
                ) : filtered.map(b => {
                  const mins = minutesLeft(b.confirm_by);
                  return (
                    <div key={b.id} className="rounded-2xl border border-border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono-tnum font-semibold text-primary">{fmtTime(b.slot_start)}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{fmtDate(b.slot_start)}</span>
                          <div className="flex items-center gap-1.5 text-sm font-medium">
                            {b.client_name}
                            {(b.client_rating ?? 0) > 0 && (
                              <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                                <Icon name="Star" size={11} className="fill-primary text-primary" />
                                {b.client_rating}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{b.service_title}</div>
                        </div>
                        <div>
                          {b.status === 'pending' && mins !== null && (
                            <Badge className="bg-accent/40 text-accent-foreground hover:bg-accent/40">
                              <Icon name="Timer" size={12} className="mr-1" />
                              {mins > 0 ? `${mins} мин` : 'истекает'}
                            </Badge>
                          )}
                          {b.status === 'confirmed' && <Badge className="bg-success/15 text-success hover:bg-success/15">Активна</Badge>}
                          {b.status === 'cancelled' && <Badge variant="secondary">Отменена</Badge>}
                          {b.status === 'done' && <Badge variant="secondary">Оказана</Badge>}
                        </div>
                      </div>
                      {b.status === 'pending' && (
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" className="h-9 flex-1 rounded-xl bg-success text-success-foreground hover:bg-success/90" onClick={() => updateStatus(b.id, 'confirmed')}>
                            <Icon name="Check" size={15} className="mr-1" /> Принять
                          </Button>
                          <Button size="sm" variant="outline" className="h-9 flex-1 rounded-xl" onClick={() => updateStatus(b.id, 'cancelled')}>
                            <Icon name="X" size={15} className="mr-1" /> Отклонить
                          </Button>
                        </div>
                      )}
                      {b.status === 'confirmed' && (
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" className="h-9 flex-1 rounded-xl" onClick={() => updateStatus(b.id, 'done')}>
                            <Icon name="BadgeCheck" size={15} className="mr-1" /> Оказана
                          </Button>
                          <Button size="sm" variant="outline" className="h-9 flex-1 rounded-xl text-destructive hover:text-destructive" onClick={() => updateStatus(b.id, 'cancelled')}>
                            <Icon name="X" size={15} className="mr-1" /> Отменить
                          </Button>
                        </div>
                      )}
                      {b.status === 'done' && (
                        <div className="mt-2">
                          {(b.my_rating ?? 0) > 0 ? (
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Icon name="Star" size={13} className="fill-primary text-primary" />
                              Вы оценили клиента: {b.my_rating}
                            </p>
                          ) : (
                            <div>
                              <p className="mb-1 text-xs text-muted-foreground">Оцените клиента:</p>
                              <div className="flex gap-1">
                                {[1,2,3,4,5].map(s => (
                                  <button key={s}
                                    onClick={async () => {
                                      const res = await ratingsApi.add(session.session_token, { booking_id: b.id, score: s });
                                      if (res?.ok) { toast.success('Оценка сохранена'); loadAll(); }
                                      else toast.error(res?.error || 'Ошибка');
                                    }}
                                    className="text-muted-foreground transition-colors hover:text-primary"
                                  >
                                    <Icon name="Star" size={24} className="hover:fill-primary" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            );
          })()}
        </div>
      )}

      {/* УСЛУГИ */}
      {activeTab === 'services' && (
        <div className="space-y-3">
          <Button variant="outline" className="h-10 w-full rounded-xl" onClick={() => setShowAddSvc(!showAddSvc)}>
            <Icon name="Plus" size={16} className="mr-1.5" /> Добавить услугу
          </Button>
          {showAddSvc && (
            <Card className="space-y-3 border-border p-4">
              {[
                { key: 'title', placeholder: 'Название услуги', type: 'text' },
                { key: 'description', placeholder: 'Описание (необязательно)', type: 'text' },
                { key: 'price', placeholder: 'Цена (₽)', type: 'number' },
              ].map(f => (
                <input key={f.key} type={f.type} placeholder={f.placeholder}
                  value={newSvc[f.key as keyof typeof newSvc]}
                  onChange={e => setNewSvc(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                />
              ))}
              <select value={newSvc.price_type} onChange={e => setNewSvc(p => ({ ...p, price_type: e.target.value }))}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none">
                <option value="fixed">Фиксированная цена</option>
                <option value="per_hour">За час</option>
                <option value="per_minute">За минуту</option>
              </select>
              <div>
                <p className="mb-2 text-xs text-muted-foreground">Фотографии услуги (до 3)</p>
                <div className="flex gap-3">
                  {([0, 1, 2] as const).map(i => (
                    <PhotoUpload key={i} token={session.session_token} url={newSvcPhotos[i]} target="service" size="md"
                      onUploaded={url => setNewSvcPhotos(p => { const n = [...p] as typeof p; n[i] = url; return n; })} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="h-9 flex-1 rounded-xl" onClick={addService}>Сохранить</Button>
                <Button size="sm" variant="outline" className="h-9 flex-1 rounded-xl" onClick={() => { setShowAddSvc(false); setNewSvcPhotos([null,null,null]); }}>Отмена</Button>
              </div>
            </Card>
          )}
          {services.length === 0 && !showAddSvc && (
            <p className="py-4 text-center text-sm text-muted-foreground">Услуг пока нет</p>
          )}
          {services.map(s => (
            <div key={s.id} className="rounded-2xl border border-border overflow-hidden">
              {editingSvc === s.id ? (
                <div className="space-y-3 p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Редактирование</p>
                  {[
                    { key: 'title', placeholder: 'Название услуги', type: 'text' },
                    { key: 'description', placeholder: 'Описание (необязательно)', type: 'text' },
                    { key: 'price', placeholder: 'Цена (₽)', type: 'number' },
                  ].map(f => (
                    <input key={f.key} type={f.type} placeholder={f.placeholder}
                      value={editSvcForm[f.key as keyof typeof editSvcForm]}
                      onChange={e => setEditSvcForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                    />
                  ))}
                  <select value={editSvcForm.price_type}
                    onChange={e => setEditSvcForm(p => ({ ...p, price_type: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none">
                    <option value="fixed">Фиксированная цена</option>
                    <option value="per_hour">За час</option>
                    <option value="per_minute">За минуту</option>
                  </select>
                  <div>
                    <p className="mb-2 text-xs text-muted-foreground">Фотографии услуги (до 3)</p>
                    <div className="flex gap-3">
                      {([0, 1, 2] as const).map(i => (
                        <PhotoUpload key={i} token={session.session_token} url={editSvcPhotos[i]} target="service" size="md"
                          onUploaded={url => setEditSvcPhotos(p => { const n = [...p] as typeof p; n[i] = url; return n; })} />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-9 flex-1 rounded-xl" onClick={saveEditSvc}>Сохранить</Button>
                    <Button size="sm" variant="outline" className="h-9 flex-1 rounded-xl" onClick={() => setEditingSvc(null)}>Отмена</Button>
                  </div>
                </div>
              ) : (
                <div>
                  {s.photo1_url && (
                    <img src={s.photo1_url} alt={s.title} className="aspect-[16/7] w-full object-cover" />
                  )}
                  <div className="flex items-start justify-between p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{s.title}</p>
                      {s.description && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{s.description}</p>}
                      <p className="font-mono-tnum mt-1 text-xs text-primary">{fmtPrice(s)}</p>
                    </div>
                    <div className="ml-2 flex shrink-0 gap-1">
                      <button onClick={() => startEditSvc(s)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary">
                        <Icon name="Pencil" size={14} />
                      </button>
                      <button onClick={() => deleteService(s.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-destructive hover:bg-destructive/10">
                        <Icon name="Trash2" size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* РАСПИСАНИЕ */}
      {activeTab === 'schedule' && session.master_id && (
        <SlotCalendar masterId={session.master_id} token={session.session_token} />
      )}
    </div>
  );
}

// ─── Мои записи ──────────────────────────────────────────────────────────────
export function MyBookings({ session }: { session: UserSession }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingMap, setRatingMap] = useState<Record<number, number>>({});

  const loadBookings = useCallback(async () => {
    const data = await bookingsApi.list(session.session_token, 'client');
    if (Array.isArray(data)) setBookings(data);
    setLoading(false);
  }, [session.session_token]);

  useEffect(() => {
    loadBookings();
    // Polling: статус заявок обновляется автоматически каждые 20 сек
    const interval = setInterval(loadBookings, 20_000);
    return () => clearInterval(interval);
  }, [loadBookings]);

  const cancelBooking = async (id: number) => {
    await bookingsApi.updateStatus(session.session_token, id, 'cancelled');
    toast('Бронь отменена');
    setBookings(bk => bk.map(b => b.id === id ? { ...b, status: 'cancelled' } : b));
  };

  const sendRating = async (bookingId: number, score: number) => {
    const res = await ratingsApi.add(session.session_token, { booking_id: bookingId, score });
    if (res?.ok) { setRatingMap(p => ({ ...p, [bookingId]: score })); toast.success('Оценка отправлена!'); }
    else toast.error(res?.error || 'Ошибка');
  };

  const pending   = bookings.filter(b => b.status === 'pending');
  const confirmed = bookings.filter(b => b.status === 'confirmed');
  const done      = bookings.filter(b => b.status === 'done');

  function BookingCard({ b }: { b: Booking }) {
    const mins = minutesLeft(b.confirm_by);
    return (
      <Card className={`border-border p-3 ${b.status === 'confirmed' ? 'border-success/30 bg-success/5' : ''}`}>
        <div className="flex items-center gap-3">
          {b.photo_url
            ? <Avatar className="h-10 w-10"><AvatarImage src={b.photo_url} /></Avatar>
            : <Avatar className="h-10 w-10"><AvatarFallback>{(b.master_name || '?')[0]}</AvatarFallback></Avatar>
          }
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold">{b.master_name}</p>
            <p className="text-xs text-muted-foreground">{b.service_title}</p>
            <p className="font-mono-tnum text-xs text-primary">
              {fmtDate(b.slot_start)} · {fmtTime(b.slot_start)}
            </p>
          </div>
          <div className="shrink-0">
            {b.status === 'pending' && mins !== null && (
              <Badge className="bg-accent/40 text-accent-foreground hover:bg-accent/40 text-[10px]">
                <Icon name="Timer" size={11} className="mr-0.5" />{mins > 0 ? `${mins}м` : '!'}
              </Badge>
            )}
            {b.status === 'confirmed' && (
              <Badge className="bg-success/15 text-success hover:bg-success/15">
                <Icon name="CircleCheck" size={12} className="mr-1" />Активна
              </Badge>
            )}
            {b.status === 'cancelled' && <Badge variant="secondary">Отменена</Badge>}
          </div>
        </div>
        {b.status === 'pending' && (
          <Button size="sm" variant="outline" className="mt-2 h-8 w-full rounded-xl" onClick={() => cancelBooking(b.id)}>
            Отменить запрос
          </Button>
        )}
        {b.status === 'confirmed' && new Date(b.slot_start) > new Date() && (
          <Button size="sm" variant="outline" className="mt-2 h-8 w-full rounded-xl text-destructive hover:text-destructive" onClick={() => cancelBooking(b.id)}>
            <Icon name="X" size={14} className="mr-1" /> Отменить запись
          </Button>
        )}
        {b.status === 'done' && (
          <div className="mt-3 rounded-xl bg-secondary/50 p-3">
            {ratingMap[b.id] ? (
              <p className="flex items-center gap-1 text-sm font-medium text-primary">
                <Icon name="Star" size={15} className="fill-primary" /> Оценка {ratingMap[b.id]} поставлена
              </p>
            ) : (
              <>
                <p className="mb-1.5 text-xs text-muted-foreground">Оцените мастера</p>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(s => (
                    <button key={s} onClick={() => sendRating(b.id, s)}>
                      <Icon name="Star" size={26} className="text-muted transition-colors hover:fill-primary hover:text-primary" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="px-4 pb-24 pt-5">
      <h2 className="mb-4 font-display text-lg font-bold">Мои записи</h2>
      {loading ? (
        <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}</div>
      ) : bookings.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Icon name="CalendarX" size={40} className="text-muted-foreground" />
          <p className="text-muted-foreground">Записей пока нет</p>
        </div>
      ) : (
        <Tabs defaultValue="pending">
          <TabsList className="grid w-full grid-cols-3 rounded-2xl">
            <TabsTrigger value="pending" className="rounded-xl text-xs">
              Ожидают{pending.length > 0 && (
                <span className="ml-1 rounded-full bg-primary/20 px-1.5 text-[10px] font-bold text-primary">{pending.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="confirmed" className="rounded-xl text-xs">Активные</TabsTrigger>
            <TabsTrigger value="done" className="rounded-xl text-xs">Завершены</TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className="mt-3 space-y-3">
            <div className="rounded-2xl bg-accent/20 p-3 text-xs text-accent-foreground">
              <Icon name="Info" size={13} className="mr-1 inline" />
              У мастеров 2 часа на подтверждение — иначе бронь снимается автоматически.
            </div>
            {pending.length === 0
              ? <p className="py-4 text-center text-sm text-muted-foreground">Нет ожидающих</p>
              : pending.map(b => <BookingCard key={b.id} b={b} />)}
          </TabsContent>
          <TabsContent value="confirmed" className="mt-3 space-y-3">
            {confirmed.length === 0
              ? <p className="py-4 text-center text-sm text-muted-foreground">Нет активных</p>
              : confirmed.map(b => <BookingCard key={b.id} b={b} />)}
          </TabsContent>
          <TabsContent value="done" className="mt-3 space-y-3">
            {done.length === 0
              ? <p className="py-4 text-center text-sm text-muted-foreground">Нет завершённых</p>
              : done.map(b => <BookingCard key={b.id} b={b} />)}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}