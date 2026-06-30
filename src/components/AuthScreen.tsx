import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { authApi, saveSession, type UserSession } from '@/lib/api';
import { toast } from 'sonner';

interface Props {
  onLogin: (session: UserSession) => void;
}

export default function AuthScreen({ onLogin }: Props) {
  const [step, setStep] = useState<'email' | 'name' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);

  const refCode = new URLSearchParams(window.location.search).get('ref') || undefined;

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const sendCode = async (withName?: string) => {
    setLoading(true);
    const res = await authApi.sendOtp(email.trim().toLowerCase(), withName || name || undefined, refCode);
    setLoading(false);

    if (res?.error === 'new_user') {
      setStep('name');
      return;
    }
    if (res?.ok) {
      if (res.dev_code) setDevCode(res.dev_code);
      setStep('otp');
      toast.success('Код отправлен на вашу почту');
    } else {
      toast.error(res?.error || 'Ошибка отправки');
    }
  };

  const verify = async () => {
    setLoading(true);
    const res = await authApi.verifyOtp(email.trim().toLowerCase(), code.trim());
    setLoading(false);
    if (res?.session_token) {
      const session: UserSession = {
        id: res.id,
        name: res.name,
        email: res.email,
        is_master: res.is_master ?? false,
        master_id: res.master_id ?? null,
        address: res.address ?? null,
        session_token: res.session_token,
      };
      saveSession(session);
      onLogin(session);
    } else {
      toast.error(res?.error || 'Неверный код');
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Логотип */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-lg">
            <Icon name="Sparkles" size={32} />
          </div>
          <h1 className="font-display text-2xl font-bold">БьютиБук</h1>
          <p className="text-center text-sm text-muted-foreground">Бронирование услуг красоты</p>
        </div>

        <Card className="border-border p-6 shadow-sm">

          {/* ШАГ 1 — Email */}
          {step === 'email' && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-lg font-semibold">Войти или зарегистрироваться</h2>
                <p className="mt-1 text-sm text-muted-foreground">Введите email — отправим код подтверждения</p>
              </div>
              <input
                type="email"
                autoFocus
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && isValidEmail(email) && sendCode()}
                placeholder="your@email.com"
                className="w-full rounded-xl border border-border bg-secondary/40 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary"
              />
              <Button
                className="h-12 w-full rounded-xl text-base"
                disabled={loading || !isValidEmail(email)}
                onClick={() => sendCode()}
              >
                {loading ? 'Отправляем...' : 'Получить код'}
                <Icon name="Mail" size={17} className="ml-2" />
              </Button>
            </div>
          )}

          {/* ШАГ 2 — Имя (только для новых пользователей) */}
          {step === 'name' && (
            <div className="space-y-4">
              <button
                onClick={() => setStep('email')}
                className="flex items-center gap-1 text-sm text-muted-foreground"
              >
                <Icon name="ChevronLeft" size={16} /> Назад
              </button>
              <div>
                <h2 className="font-display text-lg font-semibold">Добро пожаловать!</h2>
                <p className="mt-1 text-sm text-muted-foreground">Вы регистрируетесь впервые — введите ваше имя</p>
              </div>
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && name.trim() && sendCode(name)}
                placeholder="Имя и фамилия"
                className="w-full rounded-xl border border-border bg-secondary/40 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary"
              />
              <Button
                className="h-12 w-full rounded-xl text-base"
                disabled={loading || !name.trim()}
                onClick={() => sendCode(name)}
              >
                {loading ? 'Отправляем...' : 'Продолжить'}
              </Button>
            </div>
          )}

          {/* ШАГ 3 — OTP-код */}
          {step === 'otp' && (
            <div className="space-y-4">
              <button
                onClick={() => { setStep('email'); setCode(''); setDevCode(null); }}
                className="flex items-center gap-1 text-sm text-muted-foreground"
              >
                <Icon name="ChevronLeft" size={16} /> Назад
              </button>
              <div>
                <h2 className="font-display text-lg font-semibold">Введите код</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Отправили 4-значный код на <span className="font-medium text-foreground">{email}</span>
                </p>
              </div>

              {devCode && (
                <div className="rounded-xl bg-accent/20 px-4 py-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Тестовый режим — код:</p>
                  <p className="font-mono-tnum text-2xl font-bold tracking-widest text-primary">{devCode}</p>
                </div>
              )}

              <input
                autoFocus
                type="number"
                value={code}
                onChange={e => setCode(e.target.value.slice(0, 4))}
                onKeyDown={e => e.key === 'Enter' && code.length === 4 && verify()}
                placeholder="• • • •"
                className="w-full rounded-xl border border-border bg-secondary/40 px-4 py-4 text-center text-3xl font-mono-tnum tracking-[0.5em] outline-none focus:ring-2 focus:ring-primary"
              />

              <Button
                className="h-12 w-full rounded-xl text-base"
                disabled={loading || code.length < 4}
                onClick={verify}
              >
                {loading ? 'Проверяем...' : 'Войти'}
              </Button>

              <button
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
                onClick={() => sendCode()}
              >
                Отправить код ещё раз
              </button>
            </div>
          )}
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Входя, вы принимаете условия использования сервиса
        </p>
      </div>
    </div>
  );
}