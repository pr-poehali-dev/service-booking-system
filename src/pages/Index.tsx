import { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { api, SESSION } from '@/lib/api';

// ─── Типы ───────────────────────────────────────────────────────────────────
interface Master {
  id: number; user_id: number; name: string; about: string | null;
  photo1_url: string | null; photo2_url: string | null; photo3_url: string | null;
  rating: number; review_count: number; service_titles?: string[];
  services?: Service[];
}
interface Service { id: number; title: string; description: string | null; price_type: string; price: number; is_active?: boolean; }
interface Slot { id: number; slot_start: string; slot_end: string; is_blocked: boolean; has_booking: boolean; }
interface Booking {
  id: number; status: string; confirm_by: string | null; created_at: string;
  master_id?: number; master_name?: string; photo1_url?: string;
  client_id?: number; client_name?: string;
  service_title: string; price: number; price_type: string;
  slot_start: string; slot_end: string;
}

const MAX_SLOTS_PER_MASTER = 2;
type Tab = 'home' | 'schedule' | 'master' | 'bookings';
const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: 'home',     label: 'Каталог', icon: 'LayoutGrid' },
  { id: 'schedule', label: 'Запись',  icon: 'CalendarDays' },
  { id: 'master',   label: 'Кабинет', icon: 'Briefcase' },
  { id: 'bookings', label: 'Мои',     icon: 'Heart' },
];

function photos(m: Master): string[] {
  return [m.photo1_url, m.photo2_url, m.photo3_url].filter(Boolean) as string[];
}

function fmtPrice(s: Service): string {
  return s.price_type === 'per_hour'
    ? `${s.price.toLocaleString('ru')} ₽ / час`
    : `${s.price.toLocaleString('ru')} ₽`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru', { day: 'numeric', month: 'long' });
}
function minutesLeft(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((new Date(iso).getTime() - Date.now()) / 60000);
}

// ─── TopBar ──────────────────────────────────────────────────────────────────
function TopBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Icon name="Sparkles" size={16} />
          </div>
          <span className="font-display text-base font-bold tracking-tight">Лепесток</span>
        </div>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Icon name="Bell" size={18} />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" />
        </Button>
      </div>
    </header>
  );
}

// ─── Профиль мастера (шторка) ────────────────────────────────────────────────
function MasterProfileSheet({ master, onBook, children }: {
  master: Master;
  onBook?: (m: Master) => void;
  children: React.ReactNode;
}) {
  const [photo, setPhoto] = useState(0);
  const imgs = photos(master);
  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-3xl px-4 pb-8">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" />
        {imgs.length > 0 && (
          <>
            <div className="mt-4 overflow-hidden rounded-2xl bg-muted">
              <img src={imgs[photo]} alt={master.name} className="aspect-[4/3] w-full object-cover" />
            </div>
            {imgs.length > 1 && (
              <div className="mt-2 flex gap-2">
                {imgs.map((p, i) => (
                  <button key={i} onClick={() => setPhoto(i)}
                    className={`overflow-hidden rounded-xl border-2 transition-all ${photo === i ? 'border-primary' : 'border-transparent opacity-60'}`}>
                    <img src={p} alt="" className="h-14 w-14 object-cover" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        <div className="mt-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">{master.name}</h2>
            <p className="text-sm text-muted-foreground">{master.review_count} отзывов</p>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5">
            <Icon name="Star" size={14} className="fill-primary text-primary" />
            <span className="font-mono-tnum text-sm font-semibold">{master.rating || '—'}</span>
          </div>
        </div>
        {master.about && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{master.about}</p>}
        {master.services && master.services.length > 0 && (
          <div className="mt-4 space-y-2">
            {master.services.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2">
                <span className="text-sm font-medium">{s.title}</span>
                <span className="font-mono-tnum text-sm text-primary">{fmtPrice(s)}</span>
              </div>
            ))}
          </div>
        )}
        {onBook && (
          <Button className="mt-5 h-12 w-full rounded-2xl text-base" onClick={() => onBook(master)}>
            <Icon name="CalendarPlus" size={18} className="mr-2" /> Выбрать время
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Каталог ─────────────────────────────────────────────────────────────────
function Home({ onSchedule }: { onSchedule: (m: Master) => void }) {
  const [masters, setMasters] = useState<Master[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMasters().then((data) => {
      if (Array.isArray(data)) setMasters(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6 px-4 pb-6 pt-5">
      <div className="animate-fade-up overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground">
        <Badge className="mb-3 bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20">
          Запись онлайн
        </Badge>
        <h1 className="font-display text-2xl font-bold leading-tight">
          Подберите мастера<br />и запишитесь за минуту
        </h1>
        <p className="mt-2 text-sm text-primary-foreground/80">
          Бронируйте время сразу у нескольких — подтвердит первый свободный.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">Мастера рядом</h2>
        <button className="flex items-center gap-1 text-sm font-medium text-primary">
          <Icon name="Map" size={15} /> На карте
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="h-20 w-20 shrink-0 rounded-2xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {masters.map((m, i) => (
            <MasterProfileSheet key={m.id} master={m} onBook={onSchedule}>
              <Card className="flex animate-fade-up cursor-pointer items-center gap-3 overflow-hidden border-border p-3 transition-transform active:scale-[0.98]"
                style={{ animationDelay: `${i * 0.06}s` }}>
                {m.photo1_url
                  ? <img src={m.photo1_url} alt={m.name} className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
                  : <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-secondary">
                      <Icon name="User" size={32} className="text-muted-foreground" />
                    </div>
                }
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate font-display font-semibold">{m.name}</h3>
                    <span className="flex shrink-0 items-center gap-0.5 text-sm font-semibold">
                      <Icon name="Star" size={13} className="fill-primary text-primary" />
                      {m.rating > 0 ? m.rating : '—'}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(m.service_titles || []).slice(0, 3).map((t) => (
                      <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">{t}</span>
                    ))}
                  </div>
                  <div className="mt-1.5 text-xs text-muted-foreground">{m.review_count} отзывов</div>
                </div>
              </Card>
            </MasterProfileSheet>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Расписание / запись ─────────────────────────────────────────────────────
function Schedule({ focusMaster }: { focusMaster: Master | null }) {
  const [masters, setMasters] = useState<Master[]>([]);
  const [slots, setSlots] = useState<Record<number, Slot[]>>({});
  const [picked, setPicked] = useState<Record<number, number[]>>({});
  const [pickedService, setPickedService] = useState<Record<number, number>>({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.getMasters().then((data) => {
      if (Array.isArray(data)) {
        const list = focusMaster ? data.filter((m: Master) => m.id === focusMaster.id) : data;
        setMasters(list);
        list.forEach((m: Master) => {
          api.getSlots(m.id).then((sl) => {
            if (Array.isArray(sl)) setSlots((prev) => ({ ...prev, [m.id]: sl }));
          });
          api.getServices(m.id).then((sv) => {
            if (Array.isArray(sv) && sv.length > 0) {
              setPickedService((prev) => ({ ...prev, [m.id]: sv[0].id }));
            }
          });
        });
      }
    });
  }, [focusMaster]);

  const toggle = (mid: number, slotId: number) => {
    setPicked((prev) => {
      const cur = prev[mid] || [];
      if (cur.includes(slotId)) return { ...prev, [mid]: cur.filter((s) => s !== slotId) };
      if (cur.length >= MAX_SLOTS_PER_MASTER) {
        toast.error(`Не более ${MAX_SLOTS_PER_MASTER} интервалов у одного мастера`);
        return prev;
      }
      return { ...prev, [mid]: [...cur, slotId] };
    });
  };

  const cartCount = Object.values(picked).flat().length;

  const sendBookings = async () => {
    if (cartCount === 0) return;
    setSending(true);
    let ok = 0, fail = 0;
    for (const [mid, slotIds] of Object.entries(picked)) {
      const svcId = pickedService[Number(mid)];
      if (!svcId) { fail += slotIds.length; continue; }
      for (const slotId of slotIds) {
        const res = await api.createBooking(SESSION.clientToken, {
          master_id: Number(mid), service_id: svcId, slot_id: slotId,
        });
        if (res?.id) ok++;
        else { fail++; toast.error(res?.error || 'Ошибка при бронировании'); }
      }
    }
    setSending(false);
    if (ok > 0) {
      toast.success(`Отправлено ${ok} запрос(а). У мастеров 2 часа на подтверждение`);
      setPicked({});
    }
  };

  return (
    <div className="px-4 pb-28 pt-5">
      <h2 className="font-display text-lg font-bold">Выбор времени</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">До {MAX_SLOTS_PER_MASTER} интервалов у каждого мастера</p>

      <div className="mt-5 space-y-4">
        {masters.length === 0 && (
          <div className="space-y-4">
            {[1,2].map(i => <Card key={i} className="p-4"><Skeleton className="h-32 w-full" /></Card>)}
          </div>
        )}
        {masters.map((m) => {
          const mSlots = slots[m.id] || [];
          const count = (picked[m.id] || []).length;
          return (
            <Card key={m.id} className="border-border p-4">
              <div className="mb-3 flex items-center gap-3">
                {m.photo1_url
                  ? <Avatar className="h-9 w-9"><AvatarImage src={m.photo1_url} /><AvatarFallback>{m.name[0]}</AvatarFallback></Avatar>
                  : <Avatar className="h-9 w-9"><AvatarFallback>{m.name[0]}</AvatarFallback></Avatar>
                }
                <div className="flex-1">
                  <div className="font-display text-sm font-semibold leading-tight">{m.name}</div>
                  <div className="text-xs text-muted-foreground">{(m.service_titles || []).slice(0,2).join(' · ')}</div>
                </div>
                <Badge variant="secondary" className="font-mono-tnum">{count}/{MAX_SLOTS_PER_MASTER}</Badge>
              </div>

              {mSlots.length === 0
                ? <p className="py-2 text-center text-sm text-muted-foreground">Нет доступных слотов</p>
                : (
                  <div className="grid grid-cols-4 gap-2">
                    {mSlots.map((s) => {
                      const busy = s.is_blocked || s.has_booking;
                      const sel = (picked[m.id] || []).includes(s.id);
                      return (
                        <button key={s.id} disabled={busy} onClick={() => toggle(m.id, s.id)}
                          className={`rounded-xl py-2.5 text-center text-sm font-mono-tnum transition-all active:scale-95 ${
                            busy ? 'cursor-not-allowed bg-muted text-muted-foreground opacity-50'
                                 : sel ? 'bg-primary text-primary-foreground'
                                       : 'bg-success/15 text-success hover:bg-success/25'
                          }`}>
                          {fmtTime(s.slot_start)}
                        </button>
                      );
                    })}
                  </div>
                )
              }
            </Card>
          );
        })}
      </div>

      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-30 mx-auto max-w-2xl px-4">
          <Card className="animate-fade-up border-primary/30 p-3 shadow-xl">
            <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <Icon name="ShoppingBag" size={15} /> Запросов: {cartCount}
            </div>
            <Button className="h-11 w-full rounded-xl" disabled={sending} onClick={sendBookings}>
              {sending ? 'Отправляем...' : `Отправить запросы`}
              <Icon name="Send" size={15} className="ml-1.5" />
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Кабинет мастера ─────────────────────────────────────────────────────────
function MasterCabinet() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [profile, setProfile] = useState<Master | null>(null);
  const [loading, setLoading] = useState(true);
  const [editAbout, setEditAbout] = useState(false);
  const [aboutText, setAboutText] = useState('');
  const [showAddSvc, setShowAddSvc] = useState(false);
  const [newSvc, setNewSvc] = useState({ title: '', price: '', price_type: 'fixed' });

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [bk, pr] = await Promise.all([
      api.getBookings(SESSION.masterToken),
      api.getMaster(1),
    ]);
    if (Array.isArray(bk)) setBookings(bk);
    if (pr?.id) {
      setProfile(pr);
      setAboutText(pr.about || '');
      if (Array.isArray(pr.services)) setServices(pr.services);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const updateStatus = async (id: number, status: string) => {
    await api.updateBooking(SESSION.masterToken, id, status);
    toast.success(status === 'confirmed' ? 'Бронь подтверждена!' : status === 'done' ? 'Услуга отмечена как оказанная' : 'Бронь отменена');
    loadAll();
  };

  const saveAbout = async () => {
    await api.updateMaster(SESSION.masterToken, { about: aboutText });
    toast.success('Описание сохранено');
    setEditAbout(false);
  };

  const addService = async () => {
    if (!newSvc.title || !newSvc.price) return toast.error('Введите название и цену');
    const res = await api.addService(SESSION.masterToken, {
      title: newSvc.title, price_type: newSvc.price_type, price: parseFloat(newSvc.price),
    });
    if (res?.id) { toast.success('Услуга добавлена'); setShowAddSvc(false); setNewSvc({ title: '', price: '', price_type: 'fixed' }); loadAll(); }
    else toast.error(res?.error || 'Ошибка');
  };

  const pending   = bookings.filter(b => b.status === 'pending');
  const confirmed = bookings.filter(b => b.status === 'confirmed');
  const done      = bookings.filter(b => b.status === 'done');

  if (loading) return (
    <div className="space-y-4 px-4 pt-5">
      {[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
    </div>
  );

  return (
    <div className="space-y-5 px-4 pb-24 pt-5">
      <h2 className="font-display text-lg font-bold">Кабинет мастера</h2>

      <div className="grid grid-cols-3 gap-2">
        {[['Всего', bookings.length, 'Calendar'], ['Ждут', pending.length, 'Clock'], ['Выполнено', done.length, 'BadgeCheck']].map(([l, v, ic], i) => (
          <Card key={i} className="border-border p-3 text-center">
            <Icon name={ic as string} size={18} className="mx-auto mb-1 text-primary" />
            <div className="font-mono-tnum text-lg font-bold leading-none">{v}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{l}</div>
          </Card>
        ))}
      </div>

      {/* Записи */}
      <Card className="border-border p-4">
        <h3 className="mb-3 font-display font-semibold">Записи</h3>
        {bookings.length === 0 && <p className="text-sm text-muted-foreground">Записей пока нет</p>}
        <div className="space-y-3">
          {bookings.map((b) => {
            const mins = minutesLeft(b.confirm_by);
            return (
              <div key={b.id} className="rounded-2xl border border-border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono-tnum font-semibold text-primary">{fmtTime(b.slot_start)}</div>
                    <div className="text-sm font-medium">{b.client_name}</div>
                    <div className="text-xs text-muted-foreground">{b.service_title}</div>
                  </div>
                  <div className="text-right">
                    {b.status === 'pending' && mins !== null && (
                      <Badge className="bg-accent/40 text-accent-foreground hover:bg-accent/40">
                        <Icon name="Timer" size={12} className="mr-1" />
                        {mins > 0 ? `${mins} мин` : 'истекает'}
                      </Badge>
                    )}
                    {b.status === 'confirmed' && <Badge className="bg-success/15 text-success hover:bg-success/15">Подтверждено</Badge>}
                    {b.status === 'cancelled' && <Badge variant="secondary">Отменено</Badge>}
                    {b.status === 'done' && <Badge variant="secondary">Оказана</Badge>}
                  </div>
                </div>
                {b.status === 'pending' && (
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" className="h-9 flex-1 rounded-xl bg-success text-success-foreground hover:bg-success/90" onClick={() => updateStatus(b.id, 'confirmed')}>
                      <Icon name="Check" size={15} className="mr-1" /> Подтвердить
                    </Button>
                    <Button size="sm" variant="outline" className="h-9 flex-1 rounded-xl" onClick={() => updateStatus(b.id, 'cancelled')}>
                      <Icon name="X" size={15} className="mr-1" /> Отклонить
                    </Button>
                  </div>
                )}
                {b.status === 'confirmed' && (
                  <Button size="sm" className="mt-2 h-9 w-full rounded-xl" onClick={() => updateStatus(b.id, 'done')}>
                    <Icon name="BadgeCheck" size={15} className="mr-1" /> Подтвердить оказание услуги
                  </Button>
                )}
                {b.status === 'done' && (
                  <Button size="sm" variant="outline" className="mt-2 h-9 w-full rounded-xl" onClick={() => toast('Оценка клиенту — пока в разработке')}>
                    <Icon name="Star" size={15} className="mr-1" /> Оценить клиента
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Фото */}
      {profile && (
        <Card className="border-border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display font-semibold">Мои фото</h3>
            <Button size="sm" variant="outline" className="h-8 rounded-xl"><Icon name="Upload" size={14} className="mr-1" /> Заменить</Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[profile.photo1_url, profile.photo2_url, profile.photo3_url].map((p, i) =>
              p ? (
                <div key={i} className="relative overflow-hidden rounded-xl">
                  <img src={p} alt="" className="aspect-square w-full object-cover" />
                  {i === 0 && <Badge className="absolute left-1.5 top-1.5 bg-primary text-primary-foreground hover:bg-primary text-[10px]">В каталоге</Badge>}
                </div>
              ) : (
                <div key={i} className="flex aspect-square items-center justify-center rounded-xl bg-muted">
                  <Icon name="ImagePlus" size={24} className="text-muted-foreground" />
                </div>
              )
            )}
          </div>
        </Card>
      )}

      {/* Описание */}
      <Card className="border-border p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-display font-semibold">О себе</h3>
          {!editAbout && <Button size="sm" variant="outline" className="h-8 rounded-xl" onClick={() => setEditAbout(true)}><Icon name="Pencil" size={14} /></Button>}
        </div>
        {editAbout ? (
          <>
            <textarea
              value={aboutText}
              onChange={e => setAboutText(e.target.value)}
              className="w-full rounded-xl border border-border bg-secondary/40 p-3 text-sm outline-none focus:ring-1 focus:ring-primary"
              rows={4}
            />
            <div className="mt-2 flex gap-2">
              <Button size="sm" className="h-9 flex-1 rounded-xl" onClick={saveAbout}>Сохранить</Button>
              <Button size="sm" variant="outline" className="h-9 flex-1 rounded-xl" onClick={() => setEditAbout(false)}>Отмена</Button>
            </div>
          </>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">{profile?.about || 'Добавьте описание о себе'}</p>
        )}
      </Card>

      {/* Услуги */}
      <Card className="border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display font-semibold">Услуги</h3>
          <Button size="sm" variant="outline" className="h-8 rounded-xl" onClick={() => setShowAddSvc(!showAddSvc)}>
            <Icon name="Plus" size={14} className="mr-1" /> Добавить
          </Button>
        </div>
        {showAddSvc && (
          <div className="mb-3 space-y-2 rounded-2xl bg-secondary/40 p-3">
            <input placeholder="Название услуги" value={newSvc.title}
              onChange={e => setNewSvc(p => ({ ...p, title: e.target.value }))}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary" />
            <input placeholder="Цена (₽)" type="number" value={newSvc.price}
              onChange={e => setNewSvc(p => ({ ...p, price: e.target.value }))}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary" />
            <select value={newSvc.price_type} onChange={e => setNewSvc(p => ({ ...p, price_type: e.target.value }))}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none">
              <option value="fixed">Фиксированная цена</option>
              <option value="per_hour">За час</option>
            </select>
            <Button size="sm" className="w-full rounded-xl" onClick={addService}>Сохранить</Button>
          </div>
        )}
        <div className="space-y-2">
          {services.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-xl bg-secondary/60 p-3">
              <div>
                <div className="text-sm font-medium">{s.title}</div>
                <div className="font-mono-tnum text-xs text-muted-foreground">{fmtPrice(s)}</div>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8"><Icon name="Pencil" size={14} /></Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Мои записи (клиент) ─────────────────────────────────────────────────────
function MyBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingMap, setRatingMap] = useState<Record<number, number>>({});

  useEffect(() => {
    api.getBookings(SESSION.clientToken).then((data) => {
      if (Array.isArray(data)) setBookings(data);
      setLoading(false);
    });
  }, []);

  const pending   = bookings.filter(b => b.status === 'pending');
  const confirmed = bookings.filter(b => b.status === 'confirmed');
  const done      = bookings.filter(b => b.status === 'done');

  const sendRating = async (bookingId: number, score: number) => {
    const res = await api.addRating(SESSION.clientToken, { booking_id: bookingId, score });
    if (res?.ok) {
      setRatingMap(p => ({ ...p, [bookingId]: score }));
      toast.success('Оценка отправлена!');
    } else toast.error(res?.error || 'Ошибка');
  };

  const cancelBooking = async (id: number) => {
    await api.updateBooking(SESSION.clientToken, id, 'cancelled');
    toast('Бронь отменена');
    setBookings(bk => bk.map(b => b.id === id ? { ...b, status: 'cancelled' } : b));
  };

  function BookingCard({ b }: { b: Booking }) {
    return (
      <Card className={`border-border p-3 ${b.status === 'confirmed' ? 'border-success/30 bg-success/5' : ''}`}>
        <div className="flex items-center gap-3">
          {b.photo1_url
            ? <Avatar className="h-10 w-10"><AvatarImage src={b.photo1_url} /></Avatar>
            : <Avatar className="h-10 w-10"><AvatarFallback>{(b.master_name || '?')[0]}</AvatarFallback></Avatar>
          }
          <div className="flex-1">
            <div className="font-display text-sm font-semibold">{b.master_name}</div>
            <div className="text-xs text-muted-foreground">
              {fmtDate(b.slot_start)} · <span className="font-mono-tnum">{fmtTime(b.slot_start)}</span>
            </div>
            <div className="text-xs text-muted-foreground">{b.service_title}</div>
          </div>
          {b.status === 'pending' && (() => {
            const mins = minutesLeft(b.confirm_by);
            return mins !== null ? (
              <Badge className="bg-accent/40 text-accent-foreground hover:bg-accent/40">
                <Icon name="Timer" size={12} className="mr-1" />
                {mins > 0 ? `${mins} мин` : 'истекает'}
              </Badge>
            ) : null;
          })()}
          {b.status === 'confirmed' && <Badge className="bg-success/15 text-success hover:bg-success/15"><Icon name="CircleCheck" size={12} className="mr-1" />Активна</Badge>}
          {b.status === 'cancelled' && <Badge variant="secondary">Отменена</Badge>}
        </div>
        {b.status === 'pending' && (
          <Button size="sm" variant="outline" className="mt-2 h-8 w-full rounded-xl" onClick={() => cancelBooking(b.id)}>
            Отменить запрос
          </Button>
        )}
        {b.status === 'done' && (
          <div className="mt-3 rounded-xl bg-secondary/50 p-3">
            {ratingMap[b.id] ? (
              <div className="flex items-center gap-1 text-sm font-medium text-primary">
                <Icon name="Star" size={15} className="fill-primary" /> Оценка {ratingMap[b.id]} поставлена
              </div>
            ) : (
              <>
                <p className="mb-2 text-xs text-muted-foreground">Оцените мастера</p>
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
          <p className="text-sm text-muted-foreground">Перейдите в «Запись», чтобы выбрать мастера</p>
        </div>
      ) : (
        <Tabs defaultValue="pending">
          <TabsList className="grid w-full grid-cols-3 rounded-2xl">
            <TabsTrigger value="pending" className="rounded-xl text-xs">
              Ожидают {pending.length > 0 && <span className="ml-1 rounded-full bg-primary/20 px-1.5 text-[10px] font-bold text-primary">{pending.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="confirmed" className="rounded-xl text-xs">Активные</TabsTrigger>
            <TabsTrigger value="done" className="rounded-xl text-xs">Оказаны</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4 space-y-3">
            <div className="rounded-2xl bg-accent/20 p-3 text-xs text-accent-foreground">
              <Icon name="Info" size={13} className="mr-1 inline" />
              У мастеров 2 часа на подтверждение — иначе бронь снимается автоматически.
            </div>
            {pending.length === 0 ? <p className="text-center text-sm text-muted-foreground py-4">Нет ожидающих запросов</p>
              : pending.map(b => <BookingCard key={b.id} b={b} />)}
          </TabsContent>

          <TabsContent value="confirmed" className="mt-4 space-y-3">
            {confirmed.length === 0 ? <p className="text-center text-sm text-muted-foreground py-4">Нет активных записей</p>
              : confirmed.map(b => <BookingCard key={b.id} b={b} />)}
          </TabsContent>

          <TabsContent value="done" className="mt-4 space-y-3">
            {done.length === 0 ? <p className="text-center text-sm text-muted-foreground py-4">Нет завершённых записей</p>
              : done.map(b => <BookingCard key={b.id} b={b} />)}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ─── BottomNav ────────────────────────────────────────────────────────────────
function BottomNav({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl items-stretch justify-around">
        {NAV.map((item) => (
          <button key={item.id} onClick={() => onChange(item.id)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors ${active === item.id ? 'text-primary' : 'text-muted-foreground'}`}>
            <Icon name={item.icon} size={21} />
            <span className="text-[11px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
const Index = () => {
  const [tab, setTab] = useState<Tab>('home');
  const [scheduleMaster, setScheduleMaster] = useState<Master | null>(null);

  const goSchedule = (m: Master) => {
    setScheduleMaster(m);
    setTab('schedule');
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      <TopBar />
      <main className="mx-auto max-w-2xl pb-16">
        {tab === 'home'     && <Home onSchedule={goSchedule} />}
        {tab === 'schedule' && <Schedule focusMaster={scheduleMaster} />}
        {tab === 'master'   && <MasterCabinet />}
        {tab === 'bookings' && <MyBookings />}
      </main>
      <BottomNav active={tab} onChange={(t) => { if (t !== 'schedule') setScheduleMaster(null); setTab(t); }} />
    </div>
  );
};

export default Index;
