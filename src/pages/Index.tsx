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
import {
  mastersApi, servicesApi, bookingsApi, ratingsApi, authApi,
  loadSession, saveSession, clearSession,
  type UserSession,
} from '@/lib/api';
import AuthScreen from '@/components/AuthScreen';
import SlotCalendar from '@/components/SlotCalendar';
import PhotoUpload from '@/components/PhotoUpload';
import AdminPanel from '@/components/AdminPanel';

// ─── Типы ────────────────────────────────────────────────────────────────────
interface Master {
  id: number; user_id: number; name: string; about: string | null; address: string | null;
  photo_url: string | null;
  rating: number; review_count: number; service_titles?: string[];
  services?: Service[];
}
interface Service {
  id: number; title: string; description: string | null;
  price_type: string; price: number; is_active?: boolean;
  photo1_url: string | null; photo2_url: string | null; photo3_url: string | null;
}
interface SlotT {
  id: number; slot_start: string; slot_end: string;
  is_blocked: boolean; has_booking: boolean;
}
interface Booking {
  id: number; status: string; confirm_by: string | null; created_at: string;
  master_id?: number; master_name?: string; photo_url?: string;
  client_id?: number; client_name?: string;
  client_rating?: number; my_rating?: number;
  service_title: string; price: number; price_type: string;
  slot_start: string; slot_end: string;
}

const MAX_SLOTS_PER_MASTER = 2;
type Tab = 'home' | 'schedule' | 'master' | 'bookings' | 'admin';
const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: 'home',     label: 'Каталог', icon: 'LayoutGrid' },
  { id: 'schedule', label: 'Запись',  icon: 'CalendarDays' },
  { id: 'master',   label: 'Кабинет', icon: 'Briefcase' },
  { id: 'bookings', label: 'Мои',     icon: 'Heart' },
];
const NAV_ADMIN: { id: Tab; label: string; icon: string }[] = [
  ...NAV,
  { id: 'admin', label: 'Админ', icon: 'ShieldCheck' },
];

function svcPhotos(s: Service) {
  return [s.photo1_url, s.photo2_url, s.photo3_url].filter(Boolean) as string[];
}
function fmtPrice(s: Service) {
  return s.price_type === 'per_hour'
    ? `${s.price.toLocaleString('ru')} ₽/ч`
    : `${s.price.toLocaleString('ru')} ₽`;
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru', { day: 'numeric', month: 'long' });
}
function minutesLeft(iso: string | null) {
  if (!iso) return null;
  return Math.floor((new Date(iso).getTime() - Date.now()) / 60000);
}

// ─── TopBar ──────────────────────────────────────────────────────────────────
function TopBar({ session, onLogout }: { session: UserSession; onLogout: () => void }) {
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
          <button onClick={onLogout} className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-secondary">
            <Icon name="LogOut" size={17} className="text-muted-foreground" />
          </button>
        </div>
      </div>
    </header>
  );
}

// ─── Профиль мастера (шторка) ─────────────────────────────────────────────────
function MasterSheet({ master, onBook, children }: {
  master: Master; onBook?: (m: Master) => void; children: React.ReactNode;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-3xl px-4 pb-8">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" />
        {master.photo_url && (
          <div className="mt-4 overflow-hidden rounded-2xl bg-muted">
            <img src={master.photo_url} alt={master.name} className="aspect-[4/3] w-full object-cover" />
          </div>
        )}
        <div className="mt-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold">{master.name}</h2>
            {master.address && (
              <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                <Icon name="MapPin" size={12} className="mt-0.5 shrink-0" />{master.address}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-secondary px-3 py-1.5">
            <Icon name="Star" size={14} className="fill-primary text-primary" />
            <span className="font-mono-tnum text-sm font-semibold">{master.rating > 0 ? master.rating : '—'}</span>
          </div>
        </div>
        {master.about && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{master.about}</p>}
        {master.services && master.services.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Услуги</p>
            {master.services.map(s => (
              <div key={s.id} className="rounded-xl bg-secondary/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{s.title}</span>
                  <span className="font-mono-tnum text-sm text-primary">{fmtPrice(s)}</span>
                </div>
                {s.description && <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>}
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

const ADDR_FILTER_KEY = 'lepestok_addr_filter';

// ─── Каталог ─────────────────────────────────────────────────────────────────
function Home({ onSchedule }: { onSchedule: (m: Master) => void }) {
  const [masters, setMasters] = useState<Master[]>([]);
  const [loading, setLoading] = useState(true);
  const [addrFilter, setAddrFilter] = useState<string>(
    () => localStorage.getItem(ADDR_FILTER_KEY) ?? ''
  );

  useEffect(() => {
    mastersApi.list().then(data => {
      if (Array.isArray(data)) setMasters(data);
      setLoading(false);
    });
  }, []);

  const handleAddrChange = (v: string) => {
    setAddrFilter(v);
    localStorage.setItem(ADDR_FILTER_KEY, v);
  };

  const filtered = addrFilter.trim()
    ? masters.filter(m => m.address?.toLowerCase().includes(addrFilter.toLowerCase()))
    : masters;

  return (
    <div className="space-y-5 px-4 pb-6 pt-5">
      <div className="animate-fade-up overflow-hidden rounded-3xl bg-primary p-5 text-primary-foreground">
        <Badge className="mb-3 bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20">
          Запись онлайн
        </Badge>
        <h1 className="font-display text-2xl font-bold leading-tight">
          Найдите мастера красоты<br />рядом с вами
        </h1>
        <p className="mt-2 text-sm text-primary-foreground/80">
          Бронируйте сразу у нескольких — подтвердит первый свободный.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <h2 className="font-display text-lg font-bold">Мастера</h2>
        <div className="relative flex flex-1 items-center">
          <input
            value={addrFilter}
            onChange={e => handleAddrChange(e.target.value)}
            placeholder="Адрес"
            className="h-8 w-full rounded-xl border border-border bg-secondary/50 pl-3 pr-8 text-sm outline-none focus:ring-1 focus:ring-primary"
          />
          {addrFilter && (
            <button onClick={() => handleAddrChange('')}
              className="absolute right-2 text-muted-foreground hover:text-foreground">
              <Icon name="X" size={14} />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="h-20 w-20 shrink-0 rounded-2xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-20" />
              </div>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Мастера по адресу не найдены</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((m, i) => (
            <MasterSheet key={m.id} master={m} onBook={onSchedule}>
              <Card
                className="flex animate-fade-up cursor-pointer items-center gap-3 overflow-hidden border-border p-3 transition-transform active:scale-[0.98]"
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                {m.photo_url
                  ? <img src={m.photo_url} alt={m.name} className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
                  : <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-secondary">
                      <Icon name="User" size={30} className="text-muted-foreground" />
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
                    {(m.service_titles || []).slice(0, 3).map(t => (
                      <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">{t}</span>
                    ))}
                  </div>
                  {m.address && (
                    <p className="mt-1 flex items-center gap-0.5 truncate text-[11px] text-muted-foreground">
                      <Icon name="MapPin" size={11} />{m.address}
                    </p>
                  )}
                </div>
              </Card>
            </MasterSheet>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Карточка услуги на вкладке «Запись» ─────────────────────────────────────
function ServiceCard({ master, service, onBook }: {
  master: Master; service: Service; onBook: (m: Master, s: Service) => void;
}) {
  const [sheetPhoto, setSheetPhoto] = useState(0);
  const svcImgs = svcPhotos(service);
  // Первое фото карточки: фото услуги если есть, иначе фото мастера
  const cardImg = service.photo1_url || master.photo_url;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Card className="flex cursor-pointer overflow-hidden border-border transition-transform active:scale-[0.98]">
          {cardImg ? (
            <img src={cardImg} alt={service.title} className="h-24 w-24 shrink-0 object-cover" />
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center bg-secondary">
              <Icon name="Scissors" size={24} className="text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold leading-snug">{service.title}</p>
              <span className="shrink-0 font-mono-tnum text-sm font-bold text-primary">{fmtPrice(service)}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{master.name}</p>
            {service.description && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{service.description}</p>
            )}
          </div>
        </Card>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-3xl px-4 pb-8">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" />
        {/* Фотогалерея услуги */}
        {svcImgs.length > 0 ? (
          <div className="mt-4">
            <div className="overflow-hidden rounded-2xl">
              <img src={svcImgs[sheetPhoto]} alt={service.title} className="aspect-[4/3] w-full object-cover" />
            </div>
            {svcImgs.length > 1 && (
              <div className="mt-2 flex gap-2">
                {svcImgs.map((p, i) => (
                  <button key={i} onClick={() => setSheetPhoto(i)}
                    className={`overflow-hidden rounded-xl border-2 transition-all ${sheetPhoto === i ? 'border-primary' : 'border-transparent opacity-60'}`}>
                    <img src={p} alt="" className="h-14 w-14 object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : master.photo_url ? (
          <div className="mt-4 overflow-hidden rounded-2xl">
            <img src={master.photo_url} alt={master.name} className="aspect-[4/3] w-full object-cover" />
          </div>
        ) : null}
        <div className="mt-4">
          <h2 className="font-display text-xl font-bold">{service.title}</h2>
          <p className="font-mono-tnum text-lg font-semibold text-primary">{fmtPrice(service)}</p>
          {service.description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{service.description}</p>}
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-secondary/50 p-3">
            {master.photo_url
              ? <Avatar className="h-10 w-10"><AvatarImage src={master.photo_url} /></Avatar>
              : <Avatar className="h-10 w-10"><AvatarFallback>{master.name[0]}</AvatarFallback></Avatar>
            }
            <div>
              <p className="font-semibold text-sm">{master.name}</p>
              {master.address && (
                <p className="flex items-center gap-0.5 text-xs text-muted-foreground">
                  <Icon name="MapPin" size={11} />{master.address}
                </p>
              )}
            </div>
          </div>
        </div>
        <Button className="mt-5 h-12 w-full rounded-2xl text-base" onClick={() => onBook(master, service)}>
          <Icon name="CalendarPlus" size={18} className="mr-2" /> Выбрать время
        </Button>
      </SheetContent>
    </Sheet>
  );
}

// ─── Вкладка «Запись» ─────────────────────────────────────────────────────────
function Schedule({ session, focusMaster }: { session: UserSession; focusMaster: Master | null }) {
  const [services, setServices] = useState<{ master: Master; service: Service }[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingMaster, setBookingMaster] = useState<Master | null>(null);
  const [bookingService, setBookingService] = useState<Service | null>(null);
  const [pickedSlots, setPickedSlots] = useState<Record<number, number[]>>({});
  const [sending, setSending] = useState(false);
  const [svcFilter, setSvcFilter] = useState('');

  const loadServices = useCallback(async () => {
    const data = await mastersApi.list();
    if (!Array.isArray(data)) { setLoading(false); return; }
    const list: Master[] = (focusMaster
      ? data.filter((m: Master) => m.id === focusMaster.id)
      : data
    ).filter((m: Master) => m.user_id !== session.id);
    const svList: { master: Master; service: Service }[] = [];
    await Promise.all(list.map(async m => {
      const svs = await servicesApi.list(m.id);
      if (Array.isArray(svs)) svs.forEach((s: Service) => svList.push({ master: m, service: s }));
    }));
    setServices(svList);
    setLoading(false);
  }, [focusMaster, session.id]);

  useEffect(() => {
    setLoading(true);
    loadServices();
    // Polling: обновляем услуги каждые 30 сек
    const interval = setInterval(loadServices, 30_000);
    return () => clearInterval(interval);
  }, [loadServices]);

  const handleBook = (m: Master, s: Service) => { setBookingMaster(m); setBookingService(s); };

  const handleSlotPick = (masterId: number, slot: SlotT) => {
    setPickedSlots(prev => {
      const cur = prev[masterId] || [];
      if (cur.includes(slot.id)) return { ...prev, [masterId]: cur.filter(id => id !== slot.id) };
      if (cur.length >= MAX_SLOTS_PER_MASTER) {
        toast.error(`Не более ${MAX_SLOTS_PER_MASTER} слотов у одного мастера`);
        return prev;
      }
      return { ...prev, [masterId]: [...cur, slot.id] };
    });
  };

  const cartCount = bookingMaster ? (pickedSlots[bookingMaster.id] || []).length : 0;

  const sendBookings = async () => {
    if (!bookingService || !bookingMaster || cartCount === 0) return;
    setSending(true);
    let ok = 0;
    for (const slotId of pickedSlots[bookingMaster.id] || []) {
      const res = await bookingsApi.create(session.session_token, {
        master_id: bookingMaster.id, service_id: bookingService.id, slot_id: slotId,
      });
      if (res?.id) ok++;
      else toast.error(res?.error || 'Ошибка');
    }
    setSending(false);
    if (ok > 0) {
      toast.success(`Отправлено ${ok} запрос(а). У мастера 2 часа на подтверждение`);
      setPickedSlots({});
      setBookingMaster(null);
      setBookingService(null);
    }
  };

  if (bookingMaster && bookingService) {
    return (
      <div className="px-4 pb-28 pt-5">
        <button
          onClick={() => { setBookingMaster(null); setBookingService(null); setPickedSlots({}); }}
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground"
        >
          <Icon name="ChevronLeft" size={16} /> Назад
        </button>
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-secondary/60 p-3">
          {(bookingService.photo1_url || bookingMaster.photo_url) && (
            <img src={bookingService.photo1_url || bookingMaster.photo_url!} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
          )}
          <div>
            <p className="text-sm font-semibold">{bookingService.title}</p>
            <p className="text-xs text-muted-foreground">{bookingMaster.name} · {fmtPrice(bookingService)}</p>
          </div>
        </div>
        <p className="mb-3 text-sm font-semibold">
          Выберите время <span className="font-normal text-muted-foreground">(до {MAX_SLOTS_PER_MASTER} слотов)</span>
        </p>
        <SlotCalendar
          masterId={bookingMaster.id}
          token={session.session_token}
          readOnly
          pickedSlotIds={pickedSlots[bookingMaster.id] || []}
          onSlotPick={slot => handleSlotPick(bookingMaster.id, slot)}
        />
        {cartCount > 0 && (
          <div className="fixed inset-x-0 bottom-16 z-30 mx-auto max-w-2xl px-4">
            <Card className="animate-fade-up border-primary/30 p-3 shadow-xl">
              <p className="mb-2 text-sm font-semibold">Выбрано: {cartCount} слот(а)</p>
              <Button className="h-11 w-full rounded-xl" disabled={sending} onClick={sendBookings}>
                {sending ? 'Отправляем...' : 'Отправить запрос'}
                <Icon name="Send" size={15} className="ml-1.5" />
              </Button>
            </Card>
          </div>
        )}
      </div>
    );
  }

  const filteredSvcs = svcFilter.trim()
    ? services.filter(({ service }) => service.title.toLowerCase().includes(svcFilter.toLowerCase()))
    : services;

  return (
    <div className="px-4 pb-6 pt-5">
      <h2 className="mb-3 font-display text-lg font-bold">Выбрать услугу</h2>
      <div className="relative mb-4 flex items-center">
        <input
          value={svcFilter}
          onChange={e => setSvcFilter(e.target.value)}
          placeholder="Поиск по названию услуги"
          className="h-9 w-full rounded-xl border border-border bg-secondary/50 pl-3 pr-8 text-sm outline-none focus:ring-1 focus:ring-primary"
        />
        {svcFilter && (
          <button onClick={() => setSvcFilter('')}
            className="absolute right-2 text-muted-foreground hover:text-foreground">
            <Icon name="X" size={14} />
          </button>
        )}
      </div>
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
        </div>
      ) : filteredSvcs.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {svcFilter ? 'Услуги не найдены' : 'Нет доступных услуг'}
        </p>
      ) : (
        <div className="space-y-3">
          {filteredSvcs.map(({ master, service }) => (
            <ServiceCard key={`${master.id}-${service.id}`} master={master} service={service} onBook={handleBook} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Кабинет мастера ──────────────────────────────────────────────────────────
function MasterCabinet({ session, setSession }: { session: UserSession; setSession: (s: UserSession) => void }) {
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
  const [becomingMaster, setBecomingMaster] = useState(false);

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

  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

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

  const pending   = bookings.filter(b => b.status === 'pending');
  const done      = bookings.filter(b => b.status === 'done');

  return (
    <div className="px-4 pb-24 pt-5">
      <h2 className="mb-4 font-display text-lg font-bold">Кабинет мастера</h2>

      <div className="mb-4 grid grid-cols-3 gap-2">
        {[['Записей', bookings.length, 'Calendar'], ['Ждут', pending.length, 'Clock'], ['Готово', done.length, 'BadgeCheck']].map(([l, v, ic], i) => (
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
              {/* Фото профиля */}
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
          {loading ? <Skeleton className="h-32 rounded-2xl" /> : bookings.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Записей пока нет</p>
          ) : bookings.map(b => {
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
                  <Button size="sm" className="mt-2 h-9 w-full rounded-xl" onClick={() => updateStatus(b.id, 'done')}>
                    <Icon name="BadgeCheck" size={15} className="mr-1" /> Услуга оказана
                  </Button>
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
function MyBookings({ session }: { session: UserSession }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingMap, setRatingMap] = useState<Record<number, number>>({});

  useEffect(() => {
    bookingsApi.list(session.session_token, 'client').then(data => {
      if (Array.isArray(data)) setBookings(data);
      setLoading(false);
    });
  }, [session]);

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
            <p className="text-xs text-muted-foreground">
              {fmtDate(b.slot_start)} · <span className="font-mono-tnum">{fmtTime(b.slot_start)}</span>
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

// ─── BottomNav ────────────────────────────────────────────────────────────────
function BottomNav({ active, onChange, isAdmin }: {
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

// ─── Root ─────────────────────────────────────────────────────────────────────
const Index = () => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [scheduleMaster, setScheduleMaster] = useState<Master | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const stored = loadSession();
    if (stored) {
      setSession(stored);
      // Обновляем сессию с сервера чтобы подтянуть актуальный master_id
      authApi.me(stored.session_token).then(fresh => {
        if (fresh?.id) {
          const updated = { ...stored, ...fresh, session_token: stored.session_token };
          setSession(updated);
          saveSession(updated);
        }
      });
    }
    setBooting(false);
  }, []);

  const handleLogin = (s: UserSession) => {
    setSession(s);
    setTab(s.is_master ? 'master' : 'home');
  };

  const handleLogout = () => { clearSession(); setSession(null); setTab('home'); };

  const goSchedule = (m: Master) => { setScheduleMaster(m); setTab('schedule'); };

  if (booting) return <div className="min-h-screen bg-background" />;
  if (!session) return <AuthScreen onLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-background font-sans">
      <TopBar session={session} onLogout={handleLogout} />
      <main className="mx-auto max-w-2xl pb-16">
        {tab === 'home'     && <Home onSchedule={goSchedule} />}
        {tab === 'schedule' && <Schedule session={session} focusMaster={scheduleMaster} />}
        {tab === 'master' && (
          <MasterCabinet session={session} setSession={s => { setSession(s); saveSession(s); }} />
        )}
        {tab === 'bookings' && <MyBookings session={session} />}
        {tab === 'admin' && session.is_admin && <AdminPanel session={session} />}
      </main>
      <BottomNav
        active={tab}
        isAdmin={!!session.is_admin}
        onChange={t => { if (t !== 'schedule') setScheduleMaster(null); setTab(t); }}
      />
    </div>
  );
};

export default Index;