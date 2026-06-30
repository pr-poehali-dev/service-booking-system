const URLS = {
  auth:     'https://functions.poehali.dev/a1386d54-64d7-48dd-8267-fb096fd7e8aa',
  masters:  'https://functions.poehali.dev/d35c66b8-5b08-4553-9a30-083fd82469c6',
  bookings: 'https://functions.poehali.dev/b421637b-0ba0-45a4-a659-c178ad450edb',
  ratings:  'https://functions.poehali.dev/5ec6be20-e414-43ba-8bed-413ecff8aeaf',
  services: 'https://functions.poehali.dev/e82f29da-cb72-405a-bb0e-49d14495fe2a',
};

async function req(url: string, opts: RequestInit = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  me: (token: string) =>
    req(URLS.auth, { headers: { 'X-Session-Token': token } }),

  sendOtp: (email: string, name?: string) =>
    req(`${URLS.auth}?action=send`, {
      method: 'POST',
      body: JSON.stringify({ email, name }),
    }),

  verifyOtp: (email: string, code: string) =>
    req(`${URLS.auth}?action=verify`, {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),

  becomeMaster: (token: string) =>
    req(`${URLS.auth}?action=become_master`, {
      method: 'POST',
      headers: { 'X-Session-Token': token },
      body: JSON.stringify({}),
    }),
};

// ── Masters ───────────────────────────────────────────────────────────────────
export const mastersApi = {
  list: () => req(URLS.masters),

  get: (id: number) => req(`${URLS.masters}?master_id=${id}`),

  update: (token: string, data: Record<string, string>) =>
    req(URLS.masters, { method: 'PUT', headers: { 'X-Session-Token': token }, body: JSON.stringify(data) }),

  getSlots: (masterId: number, date?: string) =>
    req(`${URLS.masters}?action=slots&master_id=${masterId}${date ? `&date=${date}` : ''}`),

  createSlots: (token: string, slots: { slot_start: string; slot_end: string }[]) =>
    req(`${URLS.masters}?action=slots`, {
      method: 'POST',
      headers: { 'X-Session-Token': token },
      body: JSON.stringify({ slots }),
    }),

  deleteSlot: (token: string, slotId: number) =>
    req(`${URLS.masters}?action=slots&slot_id=${slotId}`, {
      method: 'DELETE',
      headers: { 'X-Session-Token': token },
    }),
};

// ── Services ──────────────────────────────────────────────────────────────────
export const servicesApi = {
  list: (masterId: number) => req(`${URLS.services}?master_id=${masterId}`),

  create: (token: string, data: { title: string; description?: string; price_type: string; price: number }) =>
    req(URLS.services, { method: 'POST', headers: { 'X-Session-Token': token }, body: JSON.stringify(data) }),

  update: (token: string, id: number, data: Record<string, unknown>) =>
    req(`${URLS.services}?service_id=${id}`, { method: 'PUT', headers: { 'X-Session-Token': token }, body: JSON.stringify(data) }),

  remove: (token: string, id: number) =>
    req(`${URLS.services}?service_id=${id}`, { method: 'DELETE', headers: { 'X-Session-Token': token } }),
};

// ── Bookings ──────────────────────────────────────────────────────────────────
export const bookingsApi = {
  // view: 'client' (мои записи) | 'master' (входящие к мастеру)
  list: (token: string, view: 'client' | 'master' = 'client') =>
    req(`${URLS.bookings}?view=${view}`, { headers: { 'X-Session-Token': token } }),

  create: (token: string, data: { master_id: number; service_id: number; slot_id: number }) =>
    req(URLS.bookings, { method: 'POST', headers: { 'X-Session-Token': token }, body: JSON.stringify(data) }),

  updateStatus: (token: string, bookingId: number, status: string) =>
    req(`${URLS.bookings}?booking_id=${bookingId}`, {
      method: 'PUT',
      headers: { 'X-Session-Token': token },
      body: JSON.stringify({ status }),
    }),

  expire: (token: string) =>
    req(`${URLS.bookings}?action=expire`, { headers: { 'X-Session-Token': token } }),
};

// ── Ratings ───────────────────────────────────────────────────────────────────
export const ratingsApi = {
  forClient: (userId: number) =>
    req(`${URLS.ratings}?target_user_id=${userId}&from_role=master`),

  add: (token: string, data: { booking_id: number; score: number; comment?: string }) =>
    req(URLS.ratings, { method: 'POST', headers: { 'X-Session-Token': token }, body: JSON.stringify(data) }),
};

// ── Session helpers ────────────────────────────────────────────────────────────
export const SESSION_KEY = 'lepestok_session';

export function saveSession(data: UserSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(data));
}
export function loadSession(): UserSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export interface UserSession {
  id: number;
  name: string;
  email: string;
  is_master: boolean;
  master_id: number | null;
  address: string | null;
  session_token: string;
}
