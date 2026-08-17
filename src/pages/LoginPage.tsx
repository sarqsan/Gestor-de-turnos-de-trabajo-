import React, { useState } from 'react';
import { useAuth } from '../firebase/context';
import { ADMIN_1_DATA, ADMIN_2_DATA, seedDatabaseInitial } from '../services/seedService';
import { ShieldCheck, User, AlertCircle, Database } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { loginWithGoogle, loginWithEmail, loginAsSimulatedUser, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setError(null);
    setIsGoogleLoading(true);
    const res = await loginWithGoogle();
    if (!res.success) {
      setError(res.message || 'Error al iniciar sesión con Google.');
    }
    setIsGoogleLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Introduce tu correo y contraseña');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    const res = await loginWithEmail(email, password);
    if (!res.success) {
      setError(res.message || 'Error de autenticación. Verifica tus credenciales.');
    }
    setIsSubmitting(false);
  };

  const handleQuickLogin = async (uid: string) => {
    setError(null);
    await loginAsSimulatedUser(uid);
  };

  const handleSeedMockData = async () => {
    setSeeding(true);
    setSeedMessage(null);
    try {
      const res = await seedDatabaseInitial();
      setSeedMessage(
        `✓ Base de datos lista: ${res.personasCount} personas (11 Cabos + 11 Soldados) y cuentas iniciales.`
      );
    } catch (err: any) {
      setSeedMessage(`Error al inicializar: ${err.message || 'Error desconocido'}`);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 dark:bg-slate-950">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white font-black text-xl shadow-lg shadow-blue-500/20">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            Gestión de Personal
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Fase 1: Personal, Cuentas, Permisos & Auditoría
          </p>
        </div>

        {/* Login Form Card */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Primary Form: Email & Password */}
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-800 dark:text-white">Acceso Principal</h2>
            <p className="text-[11px] text-slate-500">Introduce tus credenciales autorizadas del sistema</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Correo Electrónico
              </label>
              <input
                id="input-login-email"
                type="email"
                required
                placeholder="usuario@unidad.es"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Contraseña
              </label>
              <input
                id="input-login-password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <button
              id="btn-submit-login"
              type="submit"
              disabled={isSubmitting || loading}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isSubmitting ? 'Iniciando sesión...' : 'Iniciar Sesión con Email'}
            </button>
          </form>

          {/* Secondary Auth: Google Sign-in */}
          <div className="relative my-5 flex items-center justify-center">
            <div className="w-full border-t border-slate-200 dark:border-slate-800" />
            <span className="absolute bg-white px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:bg-slate-900">
              o acceso alternativo
            </span>
          </div>

          <button
            id="btn-login-google"
            type="button"
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading || loading}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white py-2 px-4 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 hover:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 transition-all cursor-pointer"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>{isGoogleLoading ? 'Conectando con Google...' : 'Acceder con Google Auth'}</span>
          </button>
        </div>

        {/* Development / Demo Sandbox Section (Clearly Isolated) */}
        <div className="overflow-hidden rounded-3xl border border-dashed border-amber-300 bg-amber-50/50 p-5 dark:border-amber-900/60 dark:bg-amber-950/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex rounded-full bg-amber-200 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                Sandbox / Demo Local
              </span>
            </div>
            <span className="text-[10px] font-medium text-amber-800 dark:text-amber-300">Solo para pruebas</span>
          </div>

          <p className="text-[11px] text-amber-900/80 dark:text-amber-200/80 mb-3">
            Herramientas aisladas de desarrollo para pruebas rápidas de interfaz con perfiles simulados:
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              id="btn-quick-admin1"
              type="button"
              onClick={() => handleQuickLogin(ADMIN_1_DATA.uid)}
              className="flex items-center gap-2 rounded-xl border border-purple-200 bg-white p-2.5 text-left text-xs font-semibold text-purple-950 hover:bg-purple-50 dark:border-purple-900 dark:bg-slate-900 dark:text-purple-200 transition-colors cursor-pointer"
            >
              <ShieldCheck className="h-4 w-4 text-purple-600 shrink-0" />
              <div>
                <p className="leading-tight text-[11px]">Admin 1</p>
                <p className="text-[9px] font-normal text-purple-700 dark:text-purple-300">
                  Simulación Admin
                </p>
              </div>
            </button>

            <button
              id="btn-quick-admin2"
              type="button"
              onClick={() => handleQuickLogin(ADMIN_2_DATA.uid)}
              className="flex items-center gap-2 rounded-xl border border-purple-200 bg-white p-2.5 text-left text-xs font-semibold text-purple-950 hover:bg-purple-50 dark:border-purple-900 dark:bg-slate-900 dark:text-purple-200 transition-colors cursor-pointer"
            >
              <ShieldCheck className="h-4 w-4 text-purple-600 shrink-0" />
              <div>
                <p className="leading-tight text-[11px]">Admin 2</p>
                <p className="text-[9px] font-normal text-purple-700 dark:text-purple-300">
                  Simulación Admin
                </p>
              </div>
            </button>

            <button
              id="btn-quick-cabo1"
              type="button"
              onClick={() => handleQuickLogin('user-cabo-1')}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 text-left text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 transition-colors cursor-pointer"
            >
              <User className="h-4 w-4 text-amber-600 shrink-0" />
              <div>
                <p className="leading-tight text-[11px]">Cabo 1</p>
                <p className="text-[9px] font-normal text-slate-500">Simulación Usuario</p>
              </div>
            </button>

            <button
              id="btn-quick-soldado1"
              type="button"
              onClick={() => handleQuickLogin('user-soldado-1')}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 text-left text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 transition-colors cursor-pointer"
            >
              <User className="h-4 w-4 text-emerald-600 shrink-0" />
              <div>
                <p className="leading-tight text-[11px]">Soldado 1</p>
                <p className="text-[9px] font-normal text-slate-500">Simulación Usuario</p>
              </div>
            </button>
          </div>

          {/* Reset Sandbox Data */}
          <div className="mt-3 pt-3 border-t border-amber-200/60 dark:border-amber-900/40">
            <button
              id="btn-seed-database-login"
              type="button"
              onClick={handleSeedMockData}
              disabled={seeding}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-amber-300 py-1.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-100/50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/30 transition-colors cursor-pointer"
            >
              <Database className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" />
              <span>{seeding ? 'Inicializando...' : 'Restablecer Datos de Demostración (22 Personas)'}</span>
            </button>

            {seedMessage && (
              <p className="mt-2 text-center text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                {seedMessage}
              </p>
            )}
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-slate-400">
          Arquitectura desacoplada: Ficha de Personal ≠ Cuenta de Acceso.
        </p>
      </div>
    </div>
  );
};
