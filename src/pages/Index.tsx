import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { toast } from 'sonner';

const P1 = 'https://cdn.poehali.dev/projects/28cea778-46e1-49c3-86e8-ae6d3fa9407f/files/a910b70d-901a-410f-ac33-8e81a6ca89f6.jpg';
const P2 = 'https://cdn.poehali.dev/projects/28cea778-46e1-49c3-86e8-ae6d3fa9407f/files/ccdac817-54fc-49a5-b475-b6c6c7e1e899.jpg';
const P3 = 'https://cdn.poehali.dev/projects/28cea778-46e1-49c3-86e8-ae6d3fa9407f/files/e58ab882-16ce-4cee-9ebc-d850d0faf123.jpg';

const MASTERS = [
  {
    id: 1,
    name: 'Анна Соколова',
    role: 'Бизнес-консультант',
    rating: 4.9,
    reviews: 184,
    distance: '1.2 км',
    photos: [P1, P3, P2],
    about: 'Помогаю предпринимателям выстроить стратегию роста. 12 лет в консалтинге, более 300 проектов.',
    services: ['Консультация', 'Стратегия', 'Аудит'],
    price: 'от 3 500 ₽',
  },
  {
    id: 2,
    name: 'Дмитрий Орлов',
    role: 'Финансовый аналитик',
    rating: 4.8,
    reviews: 92,
    distance: '2.8 км',
    photos: [P2, P1, P3],
    about: 'Финансовое планирование и налоговая оптимизация для малого бизнеса. Сертифицированный аналитик.',
    services: ['Финансы', 'Налоги', 'Отчётность'],
    price: '2 000 ₽ / час',
  },
  {
    id: 3,
    name: 'Елена Морозова',
    role: 'HR-эксперт',
    rating: 5.0,
    reviews: 67,
    distance: '3.5 км',
    photos: [P3, P2, P1],
    about: 'Подбор и адаптация персонала. Выстраиваю HR-процессы с нуля. Работаю мягко и по делу.',
    services: ['Подбор', 'Адаптация', 'Оценка'],
    price: 'от 2 800 ₽',
  },
];

const SLOTS = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
const BUSY: Record<number, string[]> = { 1: ['12:00', '13:00'], 2: ['10:00', '16:00'], 3: ['14:00', '15:00'] };
const DAYS = [
  { d: 'ПН', n: '30' }, { d: 'ВТ', n: '01' }, { d: 'СР', n: '02' },
  { d: 'ЧТ', n: '03' }, { d: 'ПТ', n: '04' }, { d: 'СБ', n: '05' }, { d: 'ВС', n: '06' },
];

const MAX_SLOTS_PER_MASTER = 2;

type Master = typeof MASTERS[number];
type Tab = 'home' | 'schedule' | 'master' | 'bookings';

const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Каталог', icon: 'LayoutGrid' },
  { id: 'schedule', label: 'Запись', icon: 'CalendarDays' },
  { id: 'master', label: 'Кабинет', icon: 'Briefcase' },
  { id: 'bookings', label: 'Мои', icon: 'Heart' },
];

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

function MasterProfileSheet({ master, children }: { master: Master; children: React.ReactNode }) {
  const [photo, setPhoto] = useState(0);
  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-3xl px-4 pb-8">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" />
        <div className="mt-4 overflow-hidden rounded-2xl bg-muted">
          <img src={master.photos[photo]} alt={master.name} className="aspect-[4/3] w-full object-cover" />
        </div>
        <div className="mt-2 flex gap-2">
          {master.photos.map((p, i) => (
            <button
              key={i}
              onClick={() => setPhoto(i)}
              className={`overflow-hidden rounded-xl border-2 transition-all ${photo === i ? 'border-primary' : 'border-transparent opacity-70'}`}
            >
              <img src={p} alt="" className="h-14 w-14 object-cover" />
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">{master.name}</h2>
            <p className="text-sm text-muted-foreground">{master.role}</p>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5">
            <Icon name="Star" size={14} className="fill-primary text-primary" />
            <span className="font-mono-tnum text-sm font-semibold">{master.rating}</span>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{master.about}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {master.services.map((s) => (
            <span key={s} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">{s}</span>
          ))}
        </div>
        <Button className="mt-5 h-12 w-full rounded-2xl text-base">
          <Icon name="CalendarPlus" size={18} className="mr-2" /> Свободные окошки
        </Button>
      </SheetContent>
    </Sheet>
  );
}

function Home() {
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

      <div className="space-y-4">
        {MASTERS.map((m, i) => (
          <MasterProfileSheet key={m.id} master={m}>
            <Card className="flex animate-fade-up cursor-pointer items-center gap-3 overflow-hidden border-border p-3 transition-transform active:scale-[0.98]" style={{ animationDelay: `${i * 0.06}s` }}>
              <img src={m.photos[0]} alt={m.name} className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate font-display font-semibold">{m.name}</h3>
                  <span className="flex shrink-0 items-center gap-0.5 text-sm font-semibold">
                    <Icon name="Star" size={13} className="fill-primary text-primary" /> {m.rating}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{m.role}</p>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="font-mono-tnum text-sm font-semibold text-primary">{m.price}</span>
                  <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                    <Icon name="MapPin" size={12} /> {m.distance}
                  </span>
                </div>
              </div>
            </Card>
          </MasterProfileSheet>
        ))}
      </div>
    </div>
  );
}

function Schedule() {
  const [picked, setPicked] = useState<Record<number, string[]>>({});

  const toggle = (mid: number, slot: string) => {
    setPicked((prev) => {
      const cur = prev[mid] || [];
      if (cur.includes(slot)) return { ...prev, [mid]: cur.filter((s) => s !== slot) };
      if (cur.length >= MAX_SLOTS_PER_MASTER) {
        toast.error(`Не более ${MAX_SLOTS_PER_MASTER} интервалов у одного мастера`);
        return prev;
      }
      return { ...prev, [mid]: [...cur, slot] };
    });
  };

  const cart = Object.entries(picked).flatMap(([mid, slots]) =>
    slots.map((s) => ({ master: MASTERS.find((m) => m.id === Number(mid))!, slot: s }))
  );

  return (
    <div className="px-4 pb-28 pt-5">
      <h2 className="font-display text-lg font-bold">Выбор времени</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">До {MAX_SLOTS_PER_MASTER} интервалов у каждого мастера</p>

      <div className="-mx-4 mt-4 overflow-x-auto px-4">
        <div className="flex gap-2">
          {DAYS.map((d, i) => (
            <button key={d.n} className={`flex min-w-[56px] flex-col items-center rounded-2xl border px-3 py-2.5 transition-colors ${i === 5 ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'}`}>
              <span className="text-[11px] font-medium opacity-70">{d.d}</span>
              <span className="font-mono-tnum text-base font-semibold">{d.n}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {MASTERS.map((m) => {
          const count = (picked[m.id] || []).length;
          return (
            <Card key={m.id} className="border-border p-4">
              <div className="mb-3 flex items-center gap-3">
                <Avatar className="h-9 w-9"><AvatarImage src={m.photos[0]} /><AvatarFallback>{m.name[0]}</AvatarFallback></Avatar>
                <div className="flex-1">
                  <div className="font-display text-sm font-semibold leading-tight">{m.name}</div>
                  <div className="text-xs text-muted-foreground">{m.role}</div>
                </div>
                <Badge variant="secondary" className="font-mono-tnum">{count}/{MAX_SLOTS_PER_MASTER}</Badge>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {SLOTS.map((s) => {
                  const busy = BUSY[m.id].includes(s);
                  const sel = (picked[m.id] || []).includes(s);
                  return (
                    <button
                      key={s}
                      disabled={busy}
                      onClick={() => toggle(m.id, s)}
                      className={`rounded-xl py-2.5 text-center text-sm font-mono-tnum transition-all active:scale-95 ${
                        busy
                          ? 'cursor-not-allowed bg-muted text-muted-foreground line-through'
                          : sel
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-success/15 text-success'
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-30 mx-auto max-w-2xl px-4">
          <Card className="animate-fade-up border-primary/30 p-3 shadow-xl">
            <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <Icon name="ShoppingBag" size={15} /> Корзина · {cart.length}
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {cart.map((c, i) => (
                <Badge key={i} variant="secondary" className="font-mono-tnum text-[11px]">
                  {c.slot} · {c.master.name.split(' ')[0]}
                </Badge>
              ))}
            </div>
            <Button
              className="h-11 w-full rounded-xl"
              onClick={() => toast.success('Запросы отправлены! У мастеров 2 часа на подтверждение')}
            >
              Отправить запросы <Icon name="Send" size={15} className="ml-1.5" />
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}

function CountdownBadge() {
  return (
    <Badge className="bg-accent/40 text-accent-foreground hover:bg-accent/40">
      <Icon name="Timer" size={12} className="mr-1" /> 1:48 на ответ
    </Badge>
  );
}

function MasterCabinet() {
  const bookings = [
    { time: '11:00', client: 'Иван П.', service: 'Консультация', status: 'pending' },
    { time: '14:00', client: 'Мария К.', service: 'Аудит', status: 'confirmed' },
    { time: '09:00', client: 'Сергей Л.', service: 'Стратегия', status: 'done' },
  ];
  return (
    <div className="space-y-5 px-4 pb-24 pt-5">
      <h2 className="font-display text-lg font-bold">Кабинет мастера</h2>

      <div className="grid grid-cols-3 gap-2">
        {[['Сегодня', '6', 'Calendar'], ['Ждут', '2', 'Clock'], ['Доход', '48.6к', 'TrendingUp']].map(([l, v, ic], i) => (
          <Card key={i} className="border-border p-3 text-center">
            <Icon name={ic} size={18} className="mx-auto mb-1 text-primary" />
            <div className="font-mono-tnum text-lg font-bold leading-none">{v}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{l}</div>
          </Card>
        ))}
      </div>

      <Card className="border-border p-4">
        <h3 className="mb-3 font-display font-semibold">Записи</h3>
        <div className="space-y-2.5">
          {bookings.map((b, i) => (
            <div key={i} className="rounded-2xl border border-border p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono-tnum font-semibold text-primary">{b.time}</span>
                  <div>
                    <div className="text-sm font-medium">{b.client}</div>
                    <div className="text-xs text-muted-foreground">{b.service}</div>
                  </div>
                </div>
                {b.status === 'pending' && <CountdownBadge />}
                {b.status === 'confirmed' && <Badge className="bg-success/15 text-success hover:bg-success/15">Подтверждено</Badge>}
                {b.status === 'done' && <Badge variant="secondary">Оказана</Badge>}
              </div>
              {b.status === 'pending' && (
                <div className="mt-3 flex gap-2">
                  <Button size="sm" className="h-9 flex-1 rounded-xl bg-success text-success-foreground hover:bg-success/90">
                    <Icon name="Check" size={15} className="mr-1" /> Подтвердить
                  </Button>
                  <Button size="sm" variant="outline" className="h-9 flex-1 rounded-xl">
                    <Icon name="X" size={15} className="mr-1" /> Отклонить
                  </Button>
                </div>
              )}
              {b.status === 'confirmed' && (
                <Button size="sm" className="mt-3 h-9 w-full rounded-xl" onClick={() => toast.success('Услуга отмечена как оказанная')}>
                  <Icon name="BadgeCheck" size={15} className="mr-1" /> Подтвердить оказание услуги
                </Button>
              )}
              {b.status === 'done' && (
                <Button size="sm" variant="outline" className="mt-3 h-9 w-full rounded-xl" onClick={() => toast('Оценка клиенту сохранена')}>
                  <Icon name="Star" size={15} className="mr-1" /> Оценить клиента
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display font-semibold">Мои фото (3)</h3>
          <Button size="sm" variant="outline" className="h-8 rounded-xl"><Icon name="Upload" size={14} className="mr-1" /> Заменить</Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[P1, P3, P2].map((p, i) => (
            <div key={i} className="relative overflow-hidden rounded-xl">
              <img src={p} alt="" className="aspect-square w-full object-cover" />
              {i === 0 && <Badge className="absolute left-1.5 top-1.5 bg-primary text-primary-foreground hover:bg-primary">В каталоге</Badge>}
            </div>
          ))}
        </div>
      </Card>

      <Card className="border-border p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-display font-semibold">Услуги</h3>
          <Button size="sm" variant="outline" className="h-8 rounded-xl"><Icon name="Plus" size={14} className="mr-1" /> Добавить</Button>
        </div>
        <div className="space-y-2">
          {[['Консультация', '3 500 ₽', 'фикс.'], ['Аудит проекта', '2 000 ₽', 'за час'], ['Стратегия', '5 000 ₽', 'фикс.']].map(([n, p, t], i) => (
            <div key={i} className="flex items-center justify-between rounded-xl bg-secondary/60 p-3">
              <div>
                <div className="text-sm font-medium">{n}</div>
                <div className="font-mono-tnum text-xs text-muted-foreground">{p} · {t}</div>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8"><Icon name="Pencil" size={14} /></Button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="border-border p-4">
        <h3 className="mb-1 font-display font-semibold">Описание профиля</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Помогаю предпринимателям выстроить стратегию роста. 12 лет в консалтинге, более 300 проектов.
        </p>
        <Button size="sm" variant="outline" className="mt-3 h-9 rounded-xl"><Icon name="Pencil" size={14} className="mr-1" /> Редактировать</Button>
      </Card>

      <Card className="border-border p-4">
        <h3 className="mb-1 font-display font-semibold">Оценки клиента «Иван П.»</h3>
        <p className="mb-3 text-xs text-muted-foreground">От других мастеров</p>
        <div className="mb-3 flex items-center gap-2">
          <span className="font-mono-tnum text-2xl font-bold text-primary">4.7</span>
          <div className="flex">
            {[1, 2, 3, 4, 5].map((s) => (
              <Icon key={s} name="Star" size={15} className="fill-primary text-primary" />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {[['Елена М.', 'Пунктуальный, вежливый клиент'], ['Дмитрий О.', 'Всё чётко, рекомендую']].map(([who, txt], i) => (
            <div key={i} className="rounded-xl bg-secondary/50 p-3 text-sm">
              <span className="font-medium">{who}: </span>
              <span className="text-muted-foreground">{txt}</span>
            </div>
          ))}
        </div>
        <Button variant="outline" className="mt-3 h-10 w-full rounded-xl" onClick={() => toast('Оценка клиенту сохранена')}>
          <Icon name="Star" size={15} className="mr-1.5" /> Оценить клиента
        </Button>
      </Card>
    </div>
  );
}

function MyBookings() {
  return (
    <div className="px-4 pb-24 pt-5">
      <h2 className="mb-4 font-display text-lg font-bold">Мои записи</h2>
      <Tabs defaultValue="pending">
        <TabsList className="grid w-full grid-cols-3 rounded-2xl">
          <TabsTrigger value="pending" className="rounded-xl text-xs">Ожидают</TabsTrigger>
          <TabsTrigger value="confirmed" className="rounded-xl text-xs">Активные</TabsTrigger>
          <TabsTrigger value="done" className="rounded-xl text-xs">Оказаны</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 space-y-3">
          <div className="rounded-2xl bg-accent/20 p-3 text-xs text-accent-foreground">
            <Icon name="Info" size={13} className="mr-1 inline" />
            У мастеров есть 2 часа на подтверждение, иначе бронь снимется автоматически.
          </div>
          {MASTERS.slice(0, 2).map((m) => (
            <Card key={m.id} className="flex items-center justify-between border-border p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10"><AvatarImage src={m.photos[0]} /><AvatarFallback>{m.name[0]}</AvatarFallback></Avatar>
                <div>
                  <div className="font-display text-sm font-semibold">{m.name}</div>
                  <div className="text-xs text-muted-foreground">Сб, 05 июля · <span className="font-mono-tnum">12:00</span></div>
                </div>
              </div>
              <CountdownBadge />
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="confirmed" className="mt-4 space-y-3">
          <Card className="flex items-center justify-between border-success/30 bg-success/5 p-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10"><AvatarImage src={MASTERS[2].photos[0]} /><AvatarFallback>Е</AvatarFallback></Avatar>
              <div>
                <div className="font-display text-sm font-semibold">{MASTERS[2].name}</div>
                <div className="text-xs text-muted-foreground">Сб, 05 июля · <span className="font-mono-tnum">13:00</span></div>
              </div>
            </div>
            <Badge className="bg-success/15 text-success hover:bg-success/15"><Icon name="CircleCheck" size={12} className="mr-1" /> Активна</Badge>
          </Card>
        </TabsContent>

        <TabsContent value="done" className="mt-4 space-y-3">
          <Card className="border-border p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10"><AvatarImage src={MASTERS[0].photos[0]} /><AvatarFallback>А</AvatarFallback></Avatar>
                <div>
                  <div className="font-display text-sm font-semibold">{MASTERS[0].name}</div>
                  <div className="text-xs text-muted-foreground">Услуга оказана</div>
                </div>
              </div>
            </div>
            <div className="mt-3 rounded-xl bg-secondary/50 p-3">
              <p className="mb-2 text-xs text-muted-foreground">Оценка доступна после подтверждения услуги мастером</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} onClick={() => toast.success(`Оценка ${s} сохранена`)}>
                    <Icon name="Star" size={26} className="text-muted transition-colors hover:fill-primary hover:text-primary" />
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BottomNav({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl items-stretch justify-around">
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors ${active === item.id ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <Icon name={item.icon} size={21} />
            <span className="text-[11px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

const Index = () => {
  const [tab, setTab] = useState<Tab>('home');
  return (
    <div className="min-h-screen bg-background font-sans">
      <TopBar />
      <main className="mx-auto max-w-2xl pb-16">
        {tab === 'home' && <Home />}
        {tab === 'schedule' && <Schedule />}
        {tab === 'master' && <MasterCabinet />}
        {tab === 'bookings' && <MyBookings />}
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
};

export default Index;
