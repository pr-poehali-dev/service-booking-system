import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { authApi, saveSession, UserSession } from '@/lib/api';
import { toast } from 'sonner';

interface Props {
  onLogin: (session: UserSession) => void;
}

export default function AuthScreen({ onLogin }: Props) {
  const [step, setStep] = useState<'phone' | 'name' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'client' | 'master'>('client');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);

  const formatPhone = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 11);
    if (!digits) return '';
    let r = '+7';
    if (digits.length > 1) r += ' (' + digits.slice(1, 4);
    if (digits.length >= 4) r += ') ' + digits.slice(4, 7);
    if (digits.length >= 7) r += '-' + digits.slice(7, 9);
    if (digits.length >= 9) r += '-' + digits.slice(9, 11);
    return r;
  };

  const rawPhone = () => '+7' + phone.replace(/\D/g, '').slice(1);

  const sendCode = async (withName?: string) => {
    setLoading(true);
    const res = await authApi.sendOtp(rawPhone(), withName || name || undefined, role);
    setLoading(false);

    if (res?.error === 'new_user') {
      setStep('name');
      return;
    }
    if (res?.ok) {
      if (res.dev_code) setDevCode(res.dev_code);
      setStep('otp');
      toast.success('Код отправлен на ваш номер');
    } else {
      toast.error(res?.error || 'Ошибка отправки');
    }
  };

  const verify = async () => {
    setLoading(true);
    const res = await authApi.verifyOtp(rawPhone(), code.trim());
    setLoading(false);
    if (res?.session_token) {
      const session: UserSession = {
        id: res.id, name: res.name, phone: res.phone,
        role: res.role, master_id: res.master_id,
        address: res.address, session_token: res.session_token,
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
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Icon name="Sparkles" size={28} />
          </div>
          <h1 className="font-display text-2xl font-bold">Лепесток</h1>
          <p className="text-center text-sm text-muted-foreground">Бронирование услуг красоты</p>
        </div>

        <Card className="border-border p-6 shadow-sm">
          {step === 'phone' && (
            <>
              <h2 className="mb-1 font-display text-lg font-semibold">Войти или зарегистрироваться</h2>
              <p className="mb-5 text-sm text-muted-foreground">Введите номер телефона — отправим код</p>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(formatPhone(e.target.value))}
                placeholder="+7 (___) ___-__-__"
                className="mb-4 w-full rounded-xl border border-border bg-secondary/40 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="mb-5 flex gap-2">
                {(['client', 'master'] as const).map(r => (
                  <button key={r} onClick={() => setRole(r)}
                    className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors ${
                      role === r ? 'bg-primary text-primary-foreground' : 'bg-secondary/60 text-secondary-foreground'
                    }`}>
                    {r === 'client' ? '👤 Я клиент' : '💅 Я мастер'}
                  </button>
                ))}
              </div>
              <Button className="h-12 w-full rounded-xl text-base" disabled={loading || phone.replace(/\D/g,'').length < 11} onClick={() => sendCode()}>
                {loading ? 'Отправляем...' : 'Получить код'}
              </Button>
            </>
          )}

          {step === 'name' && (
            <>
              <button onClick={() => setStep('phone')} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground">
                <Icon name="ChevronLeft" size={16} /> Назад
              </button>
              <h2 className="mb-1 font-display text-lg font-semibold">Как вас зовут?</h2>
              <p className="mb-5 text-sm text-muted-foreground">Вы новый пользователь — введите ваше имя</p>
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Имя и фамилия"
                className="mb-4 w-full rounded-xl border border-border bg-secondary/40 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary"
              />
              <Button className="h-12 w-full rounded-xl text-base" disabled={loading || !name.trim()} onClick={() => sendCode(name)}>
                {loading ? 'Отправляем...' : 'Продолжить'}
              </Button>
            </>
          )}

          {step === 'otp' && (
            <>
              <button onClick={() => setStep('phone')} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground">
                <Icon name="ChevronLeft" size={16} /> Назад
              </button>
              <h2 className="mb-1 font-display text-lg font-semibold">Введите код</h2>
              <p className="mb-5 text-sm text-muted-foreground">Отправили 4-значный код на {phone}</p>
              {devCode && (
                <div className="mb-4 rounded-xl bg-accent/20 px-4 py-2 text-center text-sm text-accent-foreground">
                  Тестовый код: <strong className="font-mono-tnum">{devCode}</strong>
                </div>
              )}
              <input
                autoFocus
                type="number"
                value={code}
                onChange={e => setCode(e.target.value.slice(0, 4))}
                placeholder="• • • •"
                className="mb-4 w-full rounded-xl border border-border bg-secondary/40 px-4 py-4 text-center text-2xl font-mono-tnum tracking-[0.5em] outline-none focus:ring-2 focus:ring-primary"
              />
              <Button className="h-12 w-full rounded-xl text-base" disabled={loading || code.length < 4} onClick={verify}>
                {loading ? 'Проверяем...' : 'Войти'}
              </Button>
              <button className="mt-3 w-full text-center text-sm text-muted-foreground" onClick={() => sendCode()}>
                Отправить код ещё раз
              </button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
