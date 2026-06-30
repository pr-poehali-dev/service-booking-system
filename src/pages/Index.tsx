import { useState, useEffect } from 'react';
import { authApi, loadSession, saveSession, clearSession, type UserSession } from '@/lib/api';
import AuthScreen from '@/components/AuthScreen';
import AdminPanel from '@/components/AdminPanel';
import Home from '@/components/CatalogTab';
import Schedule from '@/components/ScheduleTab';
import { MasterCabinet, MyBookings, TopBar, BottomNav } from '@/components/CabinetTab';
import { type Tab, type Master } from '@/types/app';

const Index = () => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [scheduleMaster, setScheduleMaster] = useState<Master | null>(null);
  const [focusBookingId, setFocusBookingId] = useState<number | null>(null);
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
      <TopBar session={session} onLogout={handleLogout} onGoBooking={id => { setFocusBookingId(id); setTab('bookings'); }} />
      <main className="mx-auto max-w-2xl pb-16">
        {tab === 'home'     && <Home onSchedule={goSchedule} session={session} />}
        {tab === 'schedule' && <Schedule session={session} focusMaster={scheduleMaster} />}
        {tab === 'master'   && (
          <MasterCabinet session={session} setSession={s => { setSession(s); saveSession(s); }} />
        )}
        {tab === 'bookings' && <MyBookings session={session} focusBookingId={focusBookingId} />}
        {tab === 'admin'    && session.is_admin && <AdminPanel session={session} />}
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