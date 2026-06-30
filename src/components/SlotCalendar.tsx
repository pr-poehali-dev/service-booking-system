import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { mastersApi } from '@/lib/api';
import { toast } from 'sonner';

interface Slot {
  id: number;
  slot_start: string;
  slot_end: string;
  is_blocked: boolean;
  has_booking: boolean;
  has_confirmed: boolean;
}

interface Props {
  masterId: number;
  token: string;
  readOnly?: boolean;
  onSlotPick?: (slot: Slot) => void;
  pickedSlotIds?: number[];
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getWeekDays(base: Date): Date[] {
  const monday = new Date(base);
  const day = monday.getDay() || 7;
  monday.setDate(monday.getDate() - day + 1);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toISO(date: Date, hour: number) {
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export default function SlotCalendar({
  masterId, token, readOnly = false, onSlotPick, pickedSlotIds = [],
}: Props) {
  const [weekBase, setWeekBase] = useState(new Date());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const days = getWeekDays(weekBase);

  const loadSlots = useCallback(async () => {
    const res = await mastersApi.getSlots(masterId);
    if (Array.isArray(res)) setSlots(res);
  }, [masterId]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  // Индекс "YYYY-MM-DD:H" → Slot
  const slotIndex: Record<string, Slot> = {};
  slots.forEach(s => {
    const slotDate = new Date(s.slot_start);
    const k = `${slotDate.toISOString().slice(0, 10)}:${slotDate.getHours()}`;
    slotIndex[k] = s;
  });

  const toggleMasterSlot = (day: Date, hour: number) => {
    const key = `${dateKey(day)}:${hour}`;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  };

  const saveSlots = async () => {
    if (selected.size === 0) return;
    setLoading(true);
    const toCreate: { slot_start: string; slot_end: string }[] = [];
    const toDelete: number[] = [];

    selected.forEach(key => {
      const parts = key.split(':');
      const dateStr = parts[0];
      const hour = parseInt(parts[1]);
      const day = days.find(d => dateKey(d) === dateStr);
      if (!day) return;
      const existing = slotIndex[key];
      if (existing) {
        if (!existing.has_booking) toDelete.push(existing.id);
      } else {
        toCreate.push({ slot_start: toISO(day, hour), slot_end: toISO(day, hour + 1) });
      }
    });

    if (toCreate.length > 0) {
      const res = await mastersApi.createSlots(token, toCreate);
      if (!res?.created) toast.error('Ошибка создания слотов');
    }
    for (const id of toDelete) {
      await mastersApi.deleteSlot(token, id);
    }
    await loadSlots();
    setSelected(new Set());
    setLoading(false);
    toast.success('Расписание обновлено');
  };

  const visibleHours = HOURS.filter(h => h >= 7 && h <= 22);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => { const d = new Date(weekBase); d.setDate(d.getDate() - 7); setWeekBase(d); }}
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-secondary"
        >
          <Icon name="ChevronLeft" size={18} />
        </button>
        <span className="text-sm font-medium">
          {days[0].toLocaleDateString('ru', { day: 'numeric', month: 'short' })} –{' '}
          {days[6].toLocaleDateString('ru', { day: 'numeric', month: 'short' })}
        </span>
        <button
          onClick={() => { const d = new Date(weekBase); d.setDate(d.getDate() + 7); setWeekBase(d); }}
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-secondary"
        >
          <Icon name="ChevronRight" size={18} />
        </button>
      </div>

      <Card className="overflow-x-auto border-border p-3">
        {/* Заголовок */}
        <div className="mb-2 grid gap-0.5" style={{ gridTemplateColumns: '36px repeat(7, 1fr)' }}>
          <div />
          {days.map((d, i) => {
            const isToday = d.toDateString() === new Date().toDateString();
            return (
              <div key={i} className="flex flex-col items-center">
                <span className="text-[10px] text-muted-foreground">{DAY_NAMES[i]}</span>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                  isToday ? 'bg-primary text-primary-foreground' : ''
                }`}>
                  {d.getDate()}
                </span>
              </div>
            );
          })}
        </div>

        {/* Сетка */}
        <div className="space-y-0.5">
          {visibleHours.map(hour => (
            <div key={hour} className="grid gap-0.5 items-center" style={{ gridTemplateColumns: '36px repeat(7, 1fr)' }}>
              <span className="pr-1 text-right text-[10px] text-muted-foreground leading-none">{hour}:00</span>
              {days.map((d, di) => {
                const now = new Date();
                const isPast = d < todayStart || (d.toDateString() === now.toDateString() && hour <= now.getHours());
                const key = `${dateKey(d)}:${hour}`;
                const slot = slotIndex[key];

                if (readOnly) {
                  if (!slot || slot.is_blocked) return <div key={di} className="h-6 rounded bg-muted/30" />;
                  const confirmed = slot.has_confirmed;
                  const contested = slot.has_booking && !slot.has_confirmed; // pending, но не confirmed
                  const picked = pickedSlotIds.includes(slot.id);
                  return (
                    <button
                      key={di}
                      disabled={confirmed || isPast}
                      onClick={() => onSlotPick?.(slot)}
                      className={`h-6 rounded text-[10px] font-medium transition-all active:scale-95 ${
                        picked
                          ? 'bg-primary text-primary-foreground'
                          : confirmed
                          ? 'cursor-not-allowed bg-muted opacity-40'
                          : contested
                          ? 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                          : 'bg-success/25 text-success hover:bg-success/40'
                      }`}
                      title={contested ? 'Есть заявки — слот ещё свободен' : undefined}
                    >
                      {hour}
                    </button>
                  );
                }

                // Мастер
                const isSel = selected.has(key);
                const isActive = !!slot && !slot.is_blocked;
                return (
                  <button
                    key={di}
                    disabled={isPast}
                    onClick={() => { if (!isPast) toggleMasterSlot(d, hour); }}
                    className={`h-6 rounded text-[10px] transition-all ${
                      isPast
                        ? 'cursor-not-allowed bg-muted/20 opacity-30'
                        : isSel
                        ? 'bg-accent/70 text-accent-foreground ring-1 ring-accent'
                        : isActive
                        ? slot.has_booking
                          ? 'bg-primary/50 text-primary'
                          : 'bg-primary/25 text-primary'
                        : 'bg-muted/30 hover:bg-secondary'
                    }`}
                  >
                    {isActive && !isSel ? (slot.has_booking ? '●' : '✓') : isSel ? '~' : ''}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {!readOnly && (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-primary/25" /> свободен</span>
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-primary/50" /> занят</span>
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-accent/70" /> выбран</span>
            </div>
            {selected.size > 0 && (
              <Button className="w-full rounded-xl" disabled={loading} onClick={saveSlots}>
                {loading ? 'Сохраняем...' : `Сохранить (${selected.size} слотов)`}
              </Button>
            )}
          </div>
        )}
      </Card>

      {!readOnly && (
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Нажмите на ячейку — добавить/убрать слот. Ячейки с бронями нельзя удалить.
        </p>
      )}
    </div>
  );
}