import React, { useState, useEffect } from 'react';
import { Notificacion, TipoNotificacion } from '../../types';
import {
  getNotificaciones,
  marcarNotificacionLeida,
  marcarTodasNotificacionesLeidas,
} from '../../services/notificacionesService';
import {
  Bell,
  CheckCheck,
  Clock,
  AlertTriangle,
  RefreshCw,
  X,
  MessageSquare,
  ShieldAlert,
  ArrowRightLeft,
  Calendar,
} from 'lucide-react';

interface NotificacionesModalProps {
  isOpen: boolean;
  onClose: () => void;
  personaId?: string | null;
  uid?: string | null;
  isAdmin?: boolean;
  onNavigateTab?: (tab: string, referenciaId?: string) => void;
}

export const NotificacionesModal: React.FC<NotificacionesModalProps> = ({
  isOpen,
  onClose,
  personaId,
  uid,
  isAdmin = false,
  onNavigateTab,
}) => {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [filtro, setFiltro] = useState<'todas' | 'no_leidas'>('todas');
  const [cargando, setCargando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    try {
      const data = await getNotificaciones(personaId, uid, isAdmin);
      setNotificaciones(data);
    } catch (err) {
      console.error('Error cargando notificaciones:', err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      cargar();
    }
  }, [isOpen, personaId, uid, isAdmin]);

  if (!isOpen) return null;

  const handleMarcarLeida = async (id: string) => {
    await marcarNotificacionLeida(id);
    setNotificaciones((prev) =>
      prev.map((n) => (n.id === id ? { ...n, leida: true, fechaLeida: new Date().toISOString() } : n))
    );
  };

  const handleMarcarTodas = async () => {
    await marcarTodasNotificacionesLeidas(personaId, uid, isAdmin);
    setNotificaciones((prev) =>
      prev.map((n) => ({ ...n, leida: true, fechaLeida: new Date().toISOString() }))
    );
  };

  const filtradas = notificaciones.filter((n) => (filtro === 'no_leidas' ? !n.leida : true));
  const noLeidasCount = notificaciones.filter((n) => !n.leida).length;

  const getIconForType = (tipo: TipoNotificacion) => {
    switch (tipo) {
      case 'SOLICITUD_COBERTURA':
      case 'NUEVA_INCIDENCIA_AUSENCIA':
        return <ShieldAlert className="w-5 h-5 text-red-500" />;
      case 'NUEVA_SOLICITUD_CAMBIO':
      case 'SOLICITUD_ACEPTADA_COMPANERO':
      case 'SOLICITUD_APROBADA_ADMIN':
        return <ArrowRightLeft className="w-5 h-5 text-emerald-500" />;
      case 'MENSAJE_ADMINISTRATIVO':
        return <MessageSquare className="w-5 h-5 text-blue-500" />;
      default:
        return <Bell className="w-5 h-5 text-indigo-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg relative">
              <Bell className="w-5 h-5" />
              {noLeidasCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] font-black flex items-center justify-center animate-pulse">
                  {noLeidasCount}
                </span>
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold">Centro de Notificaciones</h3>
              <p className="text-xs text-slate-300">
                {noLeidasCount > 0 ? `${noLeidasCount} avisos pendientes de lectura` : 'Al día, sin avisos pendientes'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filtros y acciones */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFiltro('todas')}
              className={`px-3 py-1 rounded-lg font-bold transition ${
                filtro === 'todas'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Todas ({notificaciones.length})
            </button>
            <button
              onClick={() => setFiltro('no_leidas')}
              className={`px-3 py-1 rounded-lg font-bold transition ${
                filtro === 'no_leidas'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              No Leídas ({noLeidasCount})
            </button>
          </div>

          {noLeidasCount > 0 && (
            <button
              onClick={handleMarcarTodas}
              className="text-xs text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1 hover:underline"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Marcar todas leídas
            </button>
          )}
        </div>

        {/* Lista */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2">
          {cargando ? (
            <div className="text-center py-10 text-slate-400 text-sm flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Cargando notificaciones...
            </div>
          ) : filtradas.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No tienes notificaciones en este filtro.
            </div>
          ) : (
            filtradas.map((notif) => (
              <div
                key={notif.id}
                onClick={() => {
                  if (!notif.leida) handleMarcarLeida(notif.id);
                  if (onNavigateTab) {
                    const targetTab = notif.linkTab || (notif.esParaAdmin ? 'inicio' : 'solicitudes');
                    onNavigateTab(targetTab, notif.referenciaId);
                    onClose();
                  }
                }}
                className={`p-3.5 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                  !notif.leida
                    ? 'bg-indigo-50/40 border-indigo-200 hover:bg-indigo-50/70'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="mt-0.5 shrink-0">{getIconForType(notif.tipo)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4
                      className={`text-xs font-bold truncate ${
                        !notif.leida ? 'text-indigo-950' : 'text-slate-900'
                      }`}
                    >
                      {notif.titulo}
                    </h4>
                    <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                      {new Date(notif.fechaCreacion).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{notif.mensaje}</p>
                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100/80 text-[10px] text-slate-400">
                    <span>
                      {new Date(notif.fechaCreacion).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    {!notif.leida && (
                      <span className="px-1.5 py-0.2 bg-indigo-600 text-white font-bold rounded-md">
                        NUEVA
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 font-bold transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
