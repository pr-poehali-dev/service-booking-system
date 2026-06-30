const URLS = {
  masters:  'https://functions.poehali.dev/d35c66b8-5b08-4553-9a30-083fd82469c6',
  bookings: 'https://functions.poehali.dev/b421637b-0ba0-45a4-a659-c178ad450edb',
  ratings:  'https://functions.poehali.dev/5ec6be20-e414-43ba-8bed-413ecff8aeaf',
  services: 'https://functions.poehali.dev/e82f29da-cb72-405a-bb0e-49d14495fe2a',
};

// Демо-токен (в реальной версии берётся из авторизации)
export const SESSION = {
  clientToken: 'token-client-1',
  masterToken: 'token-master-1',
  masterToken2: 'token-master-2',
};

async function req(url: string, opts: RequestInit = {}) {
  const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

// ── Мастера ──────────────────────────────────────────────
export const api = {
  getMasters: () =>
    req(URLS.masters),

  getMaster: (id: number) =>
    req(`${URLS.masters}?master_id=${id}`),

  updateMaster: (token: string, data: Record<string, string>) =>
    req(URLS.masters, { method: 'PUT', headers: { 'X-Session-Token': token }, body: JSON.stringify(data) }),

  // ── Слоты ───────────────────────────────────────────────
  getSlots: (masterId: number, date?: string) =>
    req(`${URLS.masters}?action=slots&master_id=${masterId}${date ? `&date=${date}` : ''}`),

  addSlot: (token: string, slot_start: string, slot_end: string) =>
    req(`${URLS.masters}?action=slots`, { method: 'POST', headers: { 'X-Session-Token': token }, body: JSON.stringify({ slot_start, slot_end }) }),

  // ── Услуги ──────────────────────────────────────────────
  getServices: (masterId: number) =>
    req(`${URLS.services}?master_id=${masterId}`),

  addService: (token: string, data: { title: string; description?: string; price_type: string; price: number }) =>
    req(URLS.services, { method: 'POST', headers: { 'X-Session-Token': token }, body: JSON.stringify(data) }),

  updateService: (token: string, serviceId: number, data: Record<string, unknown>) =>
    req(`${URLS.services}?service_id=${serviceId}`, { method: 'PUT', headers: { 'X-Session-Token': token }, body: JSON.stringify(data) }),

  // ── Брони ───────────────────────────────────────────────
  getBookings: (token: string) =>
    req(URLS.bookings, { headers: { 'X-Session-Token': token } }),

  createBooking: (token: string, data: { master_id: number; service_id: number; slot_id: number }) =>
    req(URLS.bookings, { method: 'POST', headers: { 'X-Session-Token': token }, body: JSON.stringify(data) }),

  updateBooking: (token: string, bookingId: number, status: string) =>
    req(`${URLS.bookings}?booking_id=${bookingId}`, { method: 'PUT', headers: { 'X-Session-Token': token }, body: JSON.stringify({ status }) }),

  expireBookings: () =>
    req(`${URLS.bookings}?action=expire`),

  // ── Оценки ──────────────────────────────────────────────
  getClientRatings: (targetUserId: number) =>
    req(`${URLS.ratings}?target_user_id=${targetUserId}&from_role=master`),

  getMasterRatings: (targetUserId: number) =>
    req(`${URLS.ratings}?target_user_id=${targetUserId}&from_role=client`),

  addRating: (token: string, data: { booking_id: number; score: number; comment?: string }) =>
    req(URLS.ratings, { method: 'POST', headers: { 'X-Session-Token': token }, body: JSON.stringify(data) }),
};
