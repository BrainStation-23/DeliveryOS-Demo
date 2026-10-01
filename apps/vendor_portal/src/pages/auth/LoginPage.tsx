import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogIn, Lock, Phone, KeyRound } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types/auth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Alert } from '../../components/ui/Alert';

export const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password) return;

    setErrorMsg(null);
    setIsLoading(true);

    try {
      const result = await login(phone, password);

      // Determine redirect path
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname;

      if (result.role === UserRole.VENDOR_ADMIN) {
        if (from && from !== '/login') {
          navigate(from, { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } else {
        logout();
        setErrorMsg(t('auth.unauthorizedSubtitle'));
      }
    } catch (err: unknown) {
      console.error('Login error:', err);
      const responseError = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErrorMsg(responseError || t('auth.loginFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
      <div className="mb-6 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 mb-3 border border-amber-500/30">
          <KeyRound className="h-6 w-6" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">{t('auth.title')}</h2>
        <p className="mt-1 text-xs text-slate-400">{t('auth.subtitle')}</p>
      </div>

      {errorMsg && (
        <Alert
          type="error"
          message={errorMsg}
          className="mb-5 bg-rose-950/50 border-rose-800 text-rose-200"
          onDismiss={() => setErrorMsg(null)}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Input
            label={t('auth.phoneLabel')}
            type="tel"
            placeholder={t('auth.phonePlaceholder')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            leftIcon={<Phone className="h-4 w-4" />}
            required
            className="bg-slate-800/80 border-slate-700 text-white placeholder-slate-500"
          />
        </div>

        <div>
          <Input
            label={t('auth.passwordLabel')}
            type="password"
            placeholder={t('auth.passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock className="h-4 w-4" />}
            required
            className="bg-slate-800/80 border-slate-700 text-white placeholder-slate-500"
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full mt-2 shadow-xs"
          isLoading={isLoading}
          rightIcon={<LogIn className="h-4 w-4" />}
        >
          {isLoading ? t('auth.signingIn') : t('auth.loginButton')}
        </Button>
      </form>
    </div>
  );
};
