import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

const MASTERS = [
  {
    id: 1,
    name: 'Анна Соколова',
    role: 'Бизнес-консультант',
    rating: 4.9,
    reviews: 184,
    distance: '1.2 км',
    photo: 'https://cdn.poehali.dev/projects/28cea778-46e1-49c3-86e8-ae6d3fa9407f/files/a910b70d-901a-410f-ac33-8e81a6ca89f6.jpg',
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
    photo: 'https://cdn.poehali.dev/projects/28cea778-46e1-49c3-86e8-ae6d3fa9407f/files/ccdac817-54fc-49a5-b475-b6c6c7e1e899.jpg',
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
    photo: 'https://cdn.poehali.dev/projects/28cea778-46e1-49c3-86e8-ae6d3fa9407f/files/e58ab882-16ce-4cee-9ebc-d850d0faf123.jpg',
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

const NAV = ['Каталог', 'Расписание', 'Кабинет мастера', 'Мои записи'];

function Header({ active, onNav }: { active: string; onNav: (s: string) => void }) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Icon name="CalendarClock" size={20} />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">РАСПИСАНИЕ</span>
        </div>
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <button
              key={item}
              onClick={() => onNav(item)}
              className={`rounded-md px-3.5 py-2 text-sm font-medium transition-colors ${
                active === item ? 'bg-secondary text-primary' : 'text-muted-foreground hover:text-primary'
              }`}
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="relative">
            <Icon name="Bell" size={18} />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent" />
          </Button>
          <Button className="hidden sm:flex">Войти</Button>
        </div>
      </div>
    </header>
  );
}

function Hero({ onNav }: { onNav: (s: string) => void }) {
  return (
    <section className="relative overflow-hidden border-b border-border bg-primary text-primary-foreground">
      <div className="absolute inset-0 grid-texture opacity-[0.07]" />
      <div className="container relative grid gap-10 py-20 md:grid-cols-2 md:py-28">
        <div className="animate-fade-up">
          <Badge className="mb-6 bg-accent/15 text-accent hover:bg-accent/15">
            <Icon name="ShieldCheck" size={14} className="mr-1.5" /> Проверенные специалисты
          </Badge>
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Запись к экспертам<br />за одно касание
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-primary-foreground/70">
            Выберите несколько мастеров, забронируйте удобное время — подтвердит тот, кто свободен. Остальные брони снимутся автоматически.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => onNav('Каталог')}>
              Найти мастера <Icon name="ArrowRight" size={18} className="ml-1.5" />
            </Button>
            <Button size="lg" variant="outline" className="border-primary-foreground/20 bg-transparent text-primary-foreground hover:bg-primary-foreground/10" onClick={() => onNav('Кабинет мастера')}>
              Я мастер
            </Button>
          </div>
          <div className="mt-12 flex gap-8">
            {[['1 200+', 'мастеров'], ['98%', 'подтверждений'], ['24/7', 'поддержка']].map(([n, l]) => (
              <div key={l}>
                <div className="font-mono-tnum text-2xl font-semibold">{n}</div>
                <div className="text-sm text-primary-foreground/60">{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative hidden md:block">
          <div className="absolute right-0 top-1/2 w-full max-w-sm -translate-y-1/2 animate-fade-up rounded-xl border border-primary-foreground/10 bg-card p-5 text-card-foreground shadow-2xl" style={{ animationDelay: '0.15s' }}>
            <div className="mb-4 flex items-center justify-between">
              <span className="font-display font-semibold">Свободные окошки</span>
              <Badge variant="secondary">Сегодня</Badge>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {SLOTS.map((s, i) => (
                <div key={s} className={`rounded-md py-2 text-center text-sm font-mono-tnum ${i % 3 === 0 ? 'bg-muted text-muted-foreground line-through' : 'bg-success/12 text-success'}`}>
                  {s}
                </div>
              ))}
            </div>
            <Button className="mt-4 w-full" size="sm">Записаться</Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Catalog() {
  return (
    <section className="container py-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight">Каталог мастеров</h2>
          <p className="mt-1.5 text-muted-foreground">Выберите специалиста рядом с вами</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Icon name="SlidersHorizontal" size={16} className="mr-1.5" /> Фильтры</Button>
          <Button variant="outline" size="sm"><Icon name="Map" size={16} className="mr-1.5" /> На карте</Button>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {MASTERS.map((m, i) => (
          <Card key={m.id} className="group overflow-hidden border-border transition-all hover:-translate-y-1 hover:shadow-xl animate-fade-up" style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="relative aspect-[4/3] overflow-hidden bg-muted">
              <img src={m.photo} alt={m.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <Badge className="absolute left-3 top-3 bg-background/90 text-foreground hover:bg-background/90">
                <Icon name="MapPin" size={12} className="mr-1" /> {m.distance}
              </Badge>
              <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-primary/90 px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                <Icon name="Star" size={12} className="fill-current text-accent" /> {m.rating}
              </div>
            </div>
            <div className="p-5">
              <h3 className="font-display text-lg font-semibold">{m.name}</h3>
              <p className="text-sm text-muted-foreground">{m.role} · {m.reviews} отзывов</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {m.services.map((s) => (
                  <span key={s} className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">{s}</span>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <span className="font-mono-tnum text-sm font-semibold text-primary">{m.price}</span>
                <Button size="sm">Свободные окошки</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function Schedule() {
  const [picked, setPicked] = useState<Record<number, string[]>>({});

  const toggle = (mid: number, slot: string) => {
    setPicked((prev) => {
      const cur = prev[mid] || [];
      const next = cur.includes(slot) ? cur.filter((s) => s !== slot) : [...cur, slot];
      return { ...prev, [mid]: next };
    });
  };

  const cart = Object.entries(picked).flatMap(([mid, slots]) =>
    slots.map((s) => ({ master: MASTERS.find((m) => m.id === Number(mid))!, slot: s }))
  );

  return (
    <section className="border-t border-border bg-secondary/40 py-16">
      <div className="container">
        <div className="mb-8">
          <h2 className="font-display text-3xl font-bold tracking-tight">Расписание и слоты</h2>
          <p className="mt-1.5 text-muted-foreground">Выбирайте время у нескольких мастеров — подтвердит первый свободный</p>
        </div>

        <Card className="mb-6 overflow-x-auto border-border p-4">
          <div className="flex gap-2">
            {DAYS.map((d, i) => (
              <button key={d.n} className={`flex min-w-[64px] flex-col items-center rounded-lg border px-3 py-2.5 transition-colors ${i === 5 ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/40'}`}>
                <span className="text-xs font-medium opacity-70">{d.d}</span>
                <span className="font-mono-tnum text-lg font-semibold">{d.n}</span>
              </button>
            ))}
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {MASTERS.map((m) => (
            <Card key={m.id} className="border-border p-5">
              <div className="mb-4 flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={m.photo} />
                  <AvatarFallback>{m.name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-display font-semibold leading-tight">{m.name}</div>
                  <div className="text-xs text-muted-foreground">{m.role}</div>
                </div>
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
                      className={`rounded-md py-2 text-center text-sm font-mono-tnum transition-all ${
                        busy
                          ? 'cursor-not-allowed bg-muted text-muted-foreground line-through'
                          : sel
                          ? 'bg-primary text-primary-foreground ring-2 ring-accent ring-offset-1'
                          : 'bg-success/12 text-success hover:bg-success/20'
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-success/40" /> свободно</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-muted" /> занято</span>
              </div>
            </Card>
          ))}
        </div>

        {cart.length > 0 && (
          <Card className="mt-6 animate-fade-up border-primary/30 bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2 font-display font-semibold">
                  <Icon name="ShoppingBag" size={18} /> Корзина записей
                </div>
                <div className="flex flex-wrap gap-2">
                  {cart.map((c, i) => (
                    <Badge key={i} variant="secondary" className="font-mono-tnum">
                      {c.slot} · {c.master.name.split(' ')[0]}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
                Отправить запросы ({cart.length}) <Icon name="Send" size={16} className="ml-1.5" />
              </Button>
            </div>
          </Card>
        )}
      </div>
    </section>
  );
}

function MasterDashboard() {
  const bookings = [
    { time: '11:00', client: 'Иван П.', service: 'Консультация', status: 'pending' },
    { time: '14:00', client: 'Мария К.', service: 'Аудит', status: 'confirmed' },
    { time: '16:00', client: 'Сергей Л.', service: 'Стратегия', status: 'pending' },
  ];
  return (
    <section className="container py-16">
      <h2 className="mb-2 font-display text-3xl font-bold tracking-tight">Кабинет мастера</h2>
      <p className="mb-8 text-muted-foreground">Подтверждайте записи и управляйте услугами</p>
      <div className="grid gap-6 lg:grid-cols-3">
        {[['Записей сегодня', '6', 'Calendar'], ['Ожидают ответа', '2', 'Clock'], ['Доход за неделю', '48 600 ₽', 'TrendingUp']].map(([l, v, ic], i) => (
          <Card key={i} className="flex items-center gap-4 border-border p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary text-primary">
              <Icon name={ic} size={22} />
            </div>
            <div>
              <div className="font-mono-tnum text-2xl font-bold">{v}</div>
              <div className="text-sm text-muted-foreground">{l}</div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="border-border p-5 lg:col-span-3">
          <h3 className="mb-4 font-display text-lg font-semibold">Предстоящие записи</h3>
          <div className="space-y-3">
            {bookings.map((b, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-4">
                  <span className="font-mono-tnum text-lg font-semibold text-primary">{b.time}</span>
                  <div>
                    <div className="font-medium">{b.client}</div>
                    <div className="text-sm text-muted-foreground">{b.service}</div>
                  </div>
                </div>
                {b.status === 'pending' ? (
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90"><Icon name="Check" size={16} /></Button>
                    <Button size="sm" variant="outline"><Icon name="X" size={16} /></Button>
                  </div>
                ) : (
                  <Badge className="bg-success/15 text-success hover:bg-success/15">Подтверждено</Badge>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card className="border-border p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">Мои услуги</h3>
            <Button size="sm" variant="outline"><Icon name="Plus" size={16} className="mr-1" /> Добавить</Button>
          </div>
          <div className="space-y-3">
            {[['Консультация', '3 500 ₽', 'фикс.'], ['Аудит проекта', '2 000 ₽', 'за час'], ['Стратегия', '5 000 ₽', 'фикс.']].map(([n, p, t], i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-secondary/60 p-3">
                <div>
                  <div className="font-medium">{n}</div>
                  <div className="font-mono-tnum text-sm text-muted-foreground">{p} · {t}</div>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8"><Icon name="Pencil" size={15} /></Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}

function MyBookings() {
  return (
    <section className="container py-16">
      <h2 className="mb-2 font-display text-3xl font-bold tracking-tight">Мои записи</h2>
      <p className="mb-8 text-muted-foreground">Отслеживайте статусы в реальном времени</p>
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="pending">Ожидают ответа</TabsTrigger>
          <TabsTrigger value="confirmed">Подтверждённые</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="space-y-3">
          {MASTERS.slice(0, 2).map((m) => (
            <Card key={m.id} className="flex items-center justify-between border-border p-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-11 w-11"><AvatarImage src={m.photo} /><AvatarFallback>{m.name[0]}</AvatarFallback></Avatar>
                <div>
                  <div className="font-display font-semibold">{m.name}</div>
                  <div className="text-sm text-muted-foreground">Суббота, 05 июля · <span className="font-mono-tnum">12:00</span></div>
                </div>
              </div>
              <Badge className="animate-pulse bg-accent/15 text-accent hover:bg-accent/15"><Icon name="Clock" size={13} className="mr-1" /> Ожидание</Badge>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="confirmed" className="space-y-3">
          <Card className="flex items-center justify-between border-success/30 bg-success/5 p-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-11 w-11"><AvatarImage src={MASTERS[2].photo} /><AvatarFallback>Е</AvatarFallback></Avatar>
              <div>
                <div className="font-display font-semibold">{MASTERS[2].name}</div>
                <div className="text-sm text-muted-foreground">Суббота, 05 июля · <span className="font-mono-tnum">13:00</span></div>
              </div>
            </div>
            <Badge className="bg-success/15 text-success hover:bg-success/15"><Icon name="CircleCheck" size={13} className="mr-1" /> Подтверждено</Badge>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-primary py-12 text-primary-foreground">
      <div className="container flex flex-col items-center justify-between gap-6 md:flex-row">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-foreground/10">
            <Icon name="CalendarClock" size={18} />
          </div>
          <span className="font-display font-bold">РАСПИСАНИЕ</span>
        </div>
        <p className="text-sm text-primary-foreground/50">© 2026 Платформа онлайн-бронирования. Все права защищены.</p>
        <div className="flex gap-4">
          {['Send', 'Mail', 'Phone'].map((ic) => (
            <button key={ic} className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-foreground/10 transition-colors hover:bg-primary-foreground/20">
              <Icon name={ic} size={16} />
            </button>
          ))}
        </div>
      </div>
    </footer>
  );
}

const Index = () => {
  const [active, setActive] = useState('Каталог');
  return (
    <div className="min-h-screen bg-background font-sans">
      <Header active={active} onNav={setActive} />
      <Hero onNav={setActive} />
      <Catalog />
      <Schedule />
      <MasterDashboard />
      <MyBookings />
      <Footer />
    </div>
  );
};

export default Index;
