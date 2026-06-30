import { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { mastersApi, servicesApi, bookingsApi, ratingsApi, type UserSession } from '@/lib/api';
import SlotCalendar from '@/components/SlotCalendar';
import { ServiceCard } from '@/components/CatalogTab';
import { type Master, type Service, type SlotT, MAX_SLOTS_PER_MASTER, fmtPrice } from '@/types/app';

export default function Schedule({ session, focusMaster }: {
  session: UserSession; focusMaster: Master | null;
}) {
  const [services, setServices] = useState<{ master: Master; service: Service }[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingMaster, setBookingMaster] = useState<Master | null>(null);
  const [bookingService, setBookingService] = useState<Service | null>(null);
  const [pickedSlots, setPickedSlots] = useState<Record<number, number[]>>({});
  const [sending, setSending] = useState(false);
  const [svcFilter, setSvcFilter] = useState('');
  // Оценки клиента мастерам: { master_id -> avg_score }
  const [clientRatings, setClientRatings] = useState<Record<string, number>>({});

  const loadServices = useCallback(async () => {
    const [data, ratings] = await Promise.all([
      mastersApi.list(),
      ratingsApi.byClient(session.session_token),
    ]);
    if (typeof ratings === 'object' && ratings !== null && !Array.isArray(ratings)) {
      setClientRatings(ratings as Record<string, number>);
    }
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
  }, [focusMaster, session.id, session.session_token]);

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

  const sortedServices = [...services].sort((a, b) => {
    const rA = clientRatings[String(a.master.id)] ?? 0;
    const rB = clientRatings[String(b.master.id)] ?? 0;
    const preferred = (r: number) => r > 3 ? 1 : 0;
    return preferred(rB) - preferred(rA);
  });

  const filteredSvcs = svcFilter.trim()
    ? sortedServices.filter(({ service }) => service.title.toLowerCase().includes(svcFilter.toLowerCase()))
    : sortedServices;

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