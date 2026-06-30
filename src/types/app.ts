export interface Master {
  id: number; user_id: number; name: string; about: string | null; address: string | null;
  photo_url: string | null;
  rating: number; review_count: number; service_titles?: string[];
  services?: Service[];
}

export interface Service {
  id: number; title: string; description: string | null;
  price_type: string; price: number; is_active?: boolean;
  photo1_url: string | null; photo2_url: string | null; photo3_url: string | null;
}

export interface SlotT {
  id: number; slot_start: string; slot_end: string;
  is_blocked: boolean; has_booking: boolean;
}

export interface Booking {
  id: number; status: string; confirm_by: string | null; created_at: string;
  master_id?: number; master_name?: string; photo_url?: string;
  client_id?: number; client_name?: string;
  client_rating?: number; my_rating?: number;
  service_title: string; price: number; price_type: string;
  slot_start: string; slot_end: string;
}

export const MAX_SLOTS_PER_MASTER = 4;

export type Tab = 'home' | 'schedule' | 'master' | 'bookings' | 'admin';

export const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: 'home',     label: 'Каталог', icon: 'LayoutGrid' },
  { id: 'schedule', label: 'Запись',  icon: 'CalendarDays' },
  { id: 'master',   label: 'Кабинет', icon: 'Briefcase' },
  { id: 'bookings', label: 'Мои',     icon: 'Heart' },
];

export const NAV_ADMIN: { id: Tab; label: string; icon: string }[] = [
  ...NAV,
  { id: 'admin', label: 'Админ', icon: 'ShieldCheck' },
];

export function svcPhotos(s: Service) {
  return [s.photo1_url, s.photo2_url, s.photo3_url].filter(Boolean) as string[];
}

export function fmtPrice(s: Service) {
  const p = s.price.toLocaleString('ru');
  if (s.price_type === 'per_hour') return `${p} ₽/ч`;
  if (s.price_type === 'per_minute') return `${p} ₽/мин`;
  return `${p} ₽`;
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru', { day: 'numeric', month: 'long' });
}

export function minutesLeft(iso: string | null) {
  if (!iso) return null;
  return Math.floor((new Date(iso).getTime() - Date.now()) / 60000);
}