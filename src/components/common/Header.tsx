import React, { useState, useEffect } from 'react';
import { useAuth } from '../../firebase/context';
import { Badge } from './Badge';
import {
  LogOut,
  ShieldCheck,
  User,
  RefreshCw,
  Menu,
  Bell,
  MessageSquare,
} from 'lucide-react';
import { ADMIN_1_DATA, ADMIN_2_DATA } from '../../services/seedService';
import { NotificacionesModal } from '../notificaciones/NotificacionesModal';
import { ChatModal } from '../chat/ChatModal';
import { getNotificaciones } from '../../services/notificacionesService';

interface HeaderProps {
  onToggleMobileMenu?: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu, onNavigateTab }) => {
  const { currentCuenta, currentPersona, rol, logout, loginAsSimulatedUser, personas } = useAuth();

  const [isNotifsOpen, setIsNotifsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifsCount = async () => {
    try {
      const notifs = await getNotificaciones(
        currentPersona?.id,
        currentCuenta?.uid,
        rol === 'ADMIN'
      );
      setUnreadCount((notifs || []).filter((n) => !n.leida).length);
    } catch (err) {
      console.warn('Error notifs count header:', err);
    }
  };

  useEffect(() => {
    fetchNotifsCount();
    const interval = setInterval(fetchNotifsCount, 15000);
    return () => clearInterval(interval);
  }, [currentPersona?.id, currentCuenta?.uid, rol]);

  const handleQuickSwitch = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'logout') {
      await logout();
    } else if (val) {
      await loginAsSimulatedUser(val);
    }
  };

  const activas = (personas || []).filter((p) => p.activo);
  const cabos = activas.filter((p) => p.empleo === 'CABO');
  const soldados = activas.filter((p) => p.empleo === 'SOLDADO');

  return (
    <header
      id="app-main-header"
      className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 sm:px-6"
    >
      {/* Left: Mobile toggle & Brand Title */}
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            id="btn-mobile-menu-toggle"
            type="button"
            onClick={onToggleMobileMenu}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-sm shadow-md shadow-blue-500/20">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white sm:text-base leading-none">
                Gestión de Cuadrantes & Personal
              </h1>
              <span className="hidden sm:inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                FASE 3 OPERATIVA
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Turnos de 24h (08:00 a 08:00) • Rotación, Cambios, Ausencias & Auditoría
            </p>
          </div>
        </div>
      </div>

      {/* Right: Quick Tools, Dev Switcher, Identity */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Notificaciones Bell */}
        <button
          onClick={() => setIsNotifsOpen(true)}
          className="relative rounded-xl p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition"
          title="Centro de Notificaciones"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Chat Button */}
        <button
          onClick={() => setIsChatOpen(true)}
          className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition"
          title="Canal de Chat del Grupo"
        >
          <MessageSquare className="h-4 w-4" />
        </button>

        {/* Quick Dev Switcher for testing all roles */}
        <div className="hidden lg:flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1 dark:border-slate-800 dark:bg-slate-800/60">
          <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Simular:
          </span>
          <select
            id="select-dev-user-switcher"
            value={currentCuenta?.uid || ''}
            onChange={handleQuickSwitch}
            className="bg-transparent text-xs font-semibold text-slate-700 outline-hidden dark:text-slate-200 cursor-pointer max-w-[180px]"
          >
            <optgroup label="Administradores">
              <option value={ADMIN_1_DATA.uid}>Admin 1 (Mando)</option>
              <option value={ADMIN_2_DATA.uid}>Admin 2 (Mando)</option>
            </optgroup>
            {cabos.length > 0 && (
              <optgroup label="Cabos Activos">
                {cabos.map((c) => (
                  <option key={c.id} value={`user-${c.id.substring(0, 8)}`}>
                    {c.nombre} (Cabo)
                  </option>
                ))}
              </optgroup>
            )}
            {soldados.length > 0 && (
              <optgroup label="Soldados Activos">
                {soldados.map((s) => (
                  <option key={s.id} value={`user-${s.id.substring(0, 8)}`}>
                    {s.nombre} (Soldado)
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {/* Current user badge & name */}
        <div className="flex items-center gap-2 border-l border-slate-200 pl-2.5 dark:border-slate-800">
          <div className="flex flex-col items-end">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[110px] sm:max-w-[140px]">
              {currentCuenta?.nombre || 'Usuario'}
            </span>
            <div className="flex items-center gap-1 mt-0.5">
              <Badge tipo="rol" valor={rol || 'USUARIO'} size="sm" />
            </div>
          </div>

          <button
            id="btn-header-logout"
            onClick={() => logout()}
            className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Notificaciones Modal */}
      <NotificacionesModal
        isOpen={isNotifsOpen}
        onClose={() => {
          setIsNotifsOpen(false);
          fetchNotifsCount();
        }}
        personaId={currentPersona?.id}
        uid={currentCuenta?.uid}
        isAdmin={rol === 'ADMIN'}
        onNavigateTab={onNavigateTab}
      />

      {/* Chat Modal */}
      <ChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        personas={personas}
        currentPersona={currentPersona}
        currentCuentaInfo={{
          uid: currentCuenta?.uid || 'admin',
          nombre: currentCuenta?.nombre || 'Administrador',
          rol: rol || 'ADMIN',
          personaId: currentPersona?.id,
        }}
      />
    </header>
  );
};
