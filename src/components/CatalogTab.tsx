import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { mastersApi } from '@/lib/api';
import { type Master, type Service, fmtPrice, svcPhotos } from '@/types/app';

const ADDR_FILTER_KEY = 'lepestok_addr_filter';

// ─── Профиль мастера (шторка) ─────────────────────────────────────────────────
export function MasterSheet({ master, onBook, children }: {
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

// ─── Карточка услуги на вкладке «Запись» ─────────────────────────────────────
export function ServiceCard({ master, service, onBook }: {
  master: Master; service: Service; onBook: (m: Master, s: Service) => void;
}) {
  const [sheetPhoto, setSheetPhoto] = useState(0);
  const svcImgs = svcPhotos(service);
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
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-sm">{master.name}</p>
                {master.rating > 0 && (
                  <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
                    <Icon name="Star" size={11} className="fill-primary text-primary" />
                    {master.rating}
                  </span>
                )}
              </div>
              {master.address && (
                <p className="flex items-center gap-0.5 text-xs text-muted-foreground truncate">
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

// ─── Каталог ─────────────────────────────────────────────────────────────────
export default function Home({ onSchedule }: { onSchedule: (m: Master) => void }) {
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