import React, { useState, useEffect } from 'react';
import {
  Persona,
  Cuenta,
  StatsPersonal,
  AuditLog,
  CuadranteMaestro,
  ServicioDia,
  SolicitudCambio,
  IncidenciaAusencia,
} from '../types';
import { StatCard } from '../components/common/StatCard';
import { Badge } from '../components/common/Badge';
import { formatFecha, formatAccionAudit } from '../utils/formatters';
import { getCuadrantes, getServiciosByCuadranteId } from '../services/cuadranteService';
import {
  getSolicitudesCambio,
  getSolicitudCambioById,
  aprobarSolicitudAdmin,
  rechazarSolicitudAdmin,
} from '../services/cambiosService';
import {
  getIncidenciasAusencia,
  ratificarCoberturaAdmin,
} from '../services/ausenciasService';
import { DetalleAprobacionCambioModal } from '../components/cambios/DetalleAprobacionCambioModal';
import { OrdenRotacionModal } from '../components/rotacion/OrdenRotacionModal';
import { NuevoCicloModal } from '../components/ciclos/NuevoCicloModal';
import {
  Users,
  Shield,
  KeyRound,
  UserCheck,
  Clock,
  ArrowRight,
  FileSpreadsheet,
  PlusCircle,
  Activity,
  ListOrdered,
  CalendarPlus,
  Repeat,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Layers,
  ArrowRightLeft,
  ShieldAlert,
  Calendar,
  FileText,
} from 'lucide-react';
import { AdminTab } from '../components/common/Sidebar';

interface AdminDashboardPageProps {
  personas: Persona[];
  cuentas: Cuenta[];
  stats: StatsPersonal;
  recentLogs: AuditLog[];
  onSelectTab: (tab: AdminTab) => void;
  onOpenNewPersonaModal: () => void;
  adminInfo: { uid: string; nombre: string };
  onRefreshPersonal?: () => Promise<void>;
  pendingSolicitudId?: string | null;
  onClearPendingSolicitud?: () => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  personas,
  cuentas,
  stats,
  recentLogs,
  onSelectTab,
  onOpenNewPersonaModal,
  adminInfo,
  onRefreshPersonal,
  pendingSolicitudId,
  onClearPendingSolicitud,
}) => {
  const [cuadranteActivo, setCuadranteActivo] = useState<CuadranteMaestro | null>(null);
  const [servicios, setServicios] = useState<ServicioDia[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudCambio[]>([]);
  const [incidencias, setIncidencias] = useState<IncidenciaAusencia[]>([]);
  const [loadingAcciones, setLoadingAcciones] = useState(false);
  const [modalSolicitudAdmin, setModalSolicitudAdmin] = useState<SolicitudCambio | null>(null);

  // Modales
  const [isRotacionModalOpen, setIsRotacionModalOpen] = useState(false);
  const [isNuevoCicloModalOpen, setIsNuevoCicloModalOpen] = useState(false);

  const cargarDatosOperativos = async () => {
    setLoadingAcciones(true);
    try {
      const cuadrantes = await getCuadrantes({ tipoUnidad: 'GUARDIA' });
      const activo = cuadrantes.find((c) => c.estado === 'CONFIRMADO' || c.estado === 'SIMULACION') || cuadrantes[0];
      setCuadranteActivo(activo || null);

      if (activo) {
        const srvs = await getServiciosByCuadranteId(activo.id);
        setServicios(srvs);
      }

      // Solicitudes de Guardia (única fuente de verdad)
      const sols = await getSolicitudesCambio(undefined, 'GUARDIA');
      setSolicitudes(sols);

      const incs = activo ? await getIncidenciasAusencia(activo.id) : await getIncidenciasAusencia();
      setIncidencias(incs);
    } catch (err) {
      console.error('Error cargando acciones pendientes admin:', err);
    } finally {
      setLoadingAcciones(false);
    }
  };

  useEffect(() => {
    cargarDatosOperativos();
  }, []);

  // Si se abre desde una notificación con referencia específica
  useEffect(() => {
    if (pendingSolicitudId) {
      const abrirSolicitud = async () => {
        let sol = solicitudes.find((s) => s.id === pendingSolicitudId);
        if (!sol) {
          sol = (await getSolicitudCambioById(pendingSolicitudId)) || undefined;
        }
        if (sol) {
          setModalSolicitudAdmin(sol);
        }
        if (onClearPendingSolicitud) {
          onClearPendingSolicitud();
        }
      };
      abrirSolicitud();
    }
  }, [pendingSolicitudId, solicitudes]);

  const hoyStr = new Date().toISOString().split('T')[0];
  const mananaStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const servicioHoy = (servicios || []).find((s) => s.fecha === hoyStr);
  const servicioManana = (servicios || []).find((s) => s.fecha === mananaStr);

  // Solicitudes de Guardia en estado PENDIENTE_ADMIN (resolución de Mando)
  const solicitudesPendientesAdmin = (solicitudes || []).filter(
    (s) => (s.tipoUnidad || 'GUARDIA') === 'GUARDIA' && s.estado === 'PENDIENTE_ADMIN'
  );

  // Incidencias activas
  const incidenciasActivas = (incidencias || []).filter(
    (i) => i.estado === 'COMUNICADA_PENDIENTE_COBERTURA' || i.estado === 'COBERTURA_ACEPTADA_PENDIENTE_ADMIN'
  );

  // Acciones sobre Solicitud de Cambio
  const handleAprobarCambio = async (sol: SolicitudCambio) => {
    if (!cuadranteActivo) return;
    const res = await aprobarSolicitudAdmin({
      solicitud: sol,
      adminInfo,
      cuadranteId: cuadranteActivo.id,
      servicios,
    });
    alert(res.message);
    cargarDatosOperativos();
  };

  const handleRechazarCambio = async (sol: SolicitudCambio) => {
    const motivo = prompt('Motivo del rechazo de la solicitud:') || 'Denegado por necesidades del servicio';
    const res = await rechazarSolicitudAdmin({
      solicitud: sol,
      adminInfo,
      motivoRechazo: motivo,
    });
    alert(res.message);
    cargarDatosOperativos();
  };

  // Ratificar cobertura
  const handleRatificarCobertura = async (inc: IncidenciaAusencia) => {
    if (!cuadranteActivo) return;
    const res = await ratificarCoberturaAdmin({
      incidencia: inc,
      adminInfo,
      cuadranteId: cuadranteActivo.id,
      servicios,
    });
    alert(res.message);
    cargarDatosOperativos();
  };

  return (
    <div id="admin-dashboard-page" className="space-y-6">
      {/* Top Banner: Dynamic Group Composition Notice */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-emerald-300 uppercase">
              Ciclo Operativo {cuadranteActivo?.nombre || '2026 - 2027'}
            </span>
            <span className="text-xs text-slate-400">
              Gestión Dinámica de Rotación
            </span>
          </div>
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
            {stats.personalActivo} Efectivos Activos
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 font-bold text-blue-300">
              <span className="h-2 w-2 rounded-full bg-blue-400" />
              {stats.cabosActivos} CABOS
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 font-bold text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {stats.soldadosActivos} SOLDADOS
            </span>
            <span className="text-slate-400">
              • Turnos 24h (2 Cabos + 2 Soldados titulares | 1 Cabo + 1 Soldado imaginaria)
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsRotacionModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition"
          >
            <ListOrdered className="h-4 w-4" />
            <span>Orden Rotación</span>
          </button>

          <button
            onClick={() => setIsNuevoCicloModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition"
          >
            <CalendarPlus className="h-4 w-4" />
            <span>Nuevo Ciclo</span>
          </button>

          <button
            onClick={() => onSelectTab('cuadrantes')}
            className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-bold text-white border border-white/20 hover:bg-white/20 transition"
          >
            <Calendar className="h-4 w-4" />
            <span>Ver Cuadrante</span>
          </button>
        </div>
      </div>

      {/* ACCIONES PENDIENTES DE APROBACIÓN (Fase 3 Core) */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 rounded-xl">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Panel de Acciones Pendientes de Aprobación
              </h3>
              <p className="text-xs text-slate-500">
                Resolución administrativa de solicitudes de cambio e incidencias de guardia
              </p>
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-black ${
              solicitudesPendientesAdmin.length + incidenciasActivas.length > 0
                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
                : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
            }`}
          >
            {solicitudesPendientesAdmin.length + incidenciasActivas.length} Pendientes
          </span>
        </div>

        {solicitudesPendientesAdmin.length === 0 && incidenciasActivas.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            Todo al día. No hay solicitudes ni incidencias que requieran acción del administrador.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Solicitudes de Cambio de Guardia */}
            {solicitudesPendientesAdmin.map((sol) => (
              <div
                key={sol.id}
                className="p-4 rounded-2xl border border-amber-400 bg-amber-50/80 dark:bg-amber-950/40 dark:border-amber-700/80 flex flex-col gap-3 shadow-xs"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-amber-200/60 dark:border-amber-800/60 pb-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 bg-blue-700 text-white rounded text-[10px] font-bold">
                      {sol.tipoCambio === 'IMAGINARIA' ? 'CAMBIO IMAGINARIA' : 'CAMBIO GUARDIA 24H'}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Guardia del {sol.fechaServicio} ({sol.puesto || 'Puesto Oficial'})
                    </h4>
                    <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 dark:bg-amber-900/80 dark:text-amber-200">
                      ★ ACEPTADA POR COMPAÑERO — PENDIENTE AUTORIZACIÓN MANDO
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Solicitud: {new Date(sol.fechaSolicitud).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>

                {/* Resumen detallado del intercambio */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-amber-200/50 dark:border-slate-800 space-y-1">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">1. Solicitante Original</p>
                    <p className="text-slate-900 dark:text-white font-semibold">
                      {sol.solicitanteNombre} <span className="text-slate-500 text-[11px]">({sol.solicitanteEmpleo || 'Titular'})</span>
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      Servicio original a transferir: <strong>{sol.fechaServicio}</strong> ({sol.puesto || 'Guardia 24h'})
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-amber-200/50 dark:border-slate-800 space-y-1">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">2. Compañero Destinatario</p>
                    <p className="text-slate-900 dark:text-white font-semibold">
                      {sol.destinatarioNombre} <span className="text-slate-500 text-[11px]">({sol.destinatarioEmpleo || 'Destinatario'})</span>
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      {sol.servicioDevolucionFecha ? (
                        <>Ofrece a cambio: <strong>{sol.servicioDevolucionFecha}</strong> (Devolución acordada)</>
                      ) : (
                        <>Asume el servicio del <strong>{sol.fechaServicio}</strong> (Sin devolución fijada)</>
                      )}
                    </p>
                  </div>
                </div>

                {sol.motivo && (
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 bg-white/40 dark:bg-slate-900/40 px-3 py-1.5 rounded-lg italic">
                    Motivo alegado: "{sol.motivo}"
                  </p>
                )}

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-amber-200/40 dark:border-amber-800/40">
                  <button
                    onClick={() => setModalSolicitudAdmin(sol)}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Revisar y Resolver
                  </button>
                  <button
                    onClick={() => handleAprobarCambio(sol)}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Autorizar y Aplicar
                  </button>
                  <button
                    onClick={() => handleRechazarCambio(sol)}
                    className="px-3.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Rechazar
                  </button>
                </div>
              </div>
            ))}

            {/* Incidencias de Ausencia */}
            {incidenciasActivas.map((inc) => (
              <div
                key={inc.id}
                className="p-4 rounded-2xl border border-red-200 bg-red-50/40 dark:bg-red-950/20 dark:border-red-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold">
                      BAJA / AUSENCIA
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Guardia del {inc.fechaServicio} ({inc.puesto})
                    </h4>
                    <span className="text-xs text-red-800 dark:text-red-300 font-semibold">
                      [{inc.estado}]
                    </span>
                    {inc.estadoAnalisisIA && (
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          inc.estadoAnalisisIA === 'CONFIRMADO'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        IA: {inc.estadoAnalisisIA}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    Titular con baja: <strong>{inc.titularNombre}</strong> • Cobertura imaginaria: <strong>{inc.imaginariaAceptanteNombre || 'Pendiente'}</strong>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Tipo: {inc.tipoAusencia} • Hora comunicación: {inc.horaExactaComunicacion || (inc.fechaComunicacion ? new Date(inc.fechaComunicacion).toLocaleTimeString('es-ES') : 'N/A')}
                    {inc.diasDuracion ? ` • Duración estimada: ${inc.diasDuracion} días` : ''}
                  </p>
                  {inc.alertaMasDeDosServicios && (
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 font-bold bg-amber-100 dark:bg-amber-950/60 p-1.5 rounded-lg">
                      ⚠️ ALERTA: Afecta a {inc.serviciosAfectadosCount || '> 2'} servicios. Sigue cubierto por imaginarias.
                    </p>
                  )}
                  {inc.documentoUrl && (
                    <a
                      href={inc.documentoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                    >
                      Ver Parte Médico Adjunto
                    </a>
                  )}
                </div>

                {inc.estado === 'COBERTURA_ACEPTADA_PENDIENTE_ADMIN' && (
                  <button
                    onClick={() => handleRatificarCobertura(inc)}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1 self-end sm:self-auto"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Ratificar Cobertura Oficial
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SERVICIO DE HOY Y SERVICIO DE MAÑANA (24 Horas: 08:00 a 08:00) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Servicio de Hoy */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Servicio de Guardia de Hoy ({hoyStr})
              </h3>
            </div>
            <span className="text-[11px] font-bold text-slate-500">08:00 h a 08:00 h</span>
          </div>

          {servicioHoy ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900">
                <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 block">CABO 1:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {personas.find((p) => p.id === servicioHoy.titulares.cabos[0]?.personaIdReal)?.nombre || 'Cabo 1'}
                </span>
              </div>
              <div className="p-2.5 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900">
                <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 block">CABO 2:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {personas.find((p) => p.id === servicioHoy.titulares.cabos[1]?.personaIdReal)?.nombre || 'Cabo 2'}
                </span>
              </div>
              <div className="p-2.5 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900">
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 block">SOLDADO 1:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {personas.find((p) => p.id === servicioHoy.titulares.soldados[0]?.personaIdReal)?.nombre || 'Soldado 1'}
                </span>
              </div>
              <div className="p-2.5 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900">
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 block">SOLDADO 2:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {personas.find((p) => p.id === servicioHoy.titulares.soldados[1]?.personaIdReal)?.nombre || 'Soldado 2'}
                </span>
              </div>
              <div className="col-span-2 p-2 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900 flex justify-between text-[11px]">
                <span>
                  <strong>Imag. Cabo:</strong> {personas.find((p) => p.id === servicioHoy.imaginarias.cabo.personaIdReal)?.nombre || 'Cabo'}
                </span>
                <span>
                  <strong>Imag. Soldado:</strong> {personas.find((p) => p.id === servicioHoy.imaginarias.soldado.personaIdReal)?.nombre || 'Soldado'}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-xs text-slate-400">
              No hay guardia programada hoy en el cuadrante.
            </div>
          )}
        </div>

        {/* Servicio de Mañana */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Servicio de Guardia de Mañana ({mananaStr})
              </h3>
            </div>
            <span className="text-[11px] font-bold text-slate-500">08:00 h a 08:00 h</span>
          </div>

          {servicioManana ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900">
                <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 block">CABO 1:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {personas.find((p) => p.id === servicioManana.titulares.cabos[0]?.personaIdReal)?.nombre || 'Cabo 1'}
                </span>
              </div>
              <div className="p-2.5 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900">
                <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 block">CABO 2:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {personas.find((p) => p.id === servicioManana.titulares.cabos[1]?.personaIdReal)?.nombre || 'Cabo 2'}
                </span>
              </div>
              <div className="p-2.5 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900">
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 block">SOLDADO 1:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {personas.find((p) => p.id === servicioManana.titulares.soldados[0]?.personaIdReal)?.nombre || 'Soldado 1'}
                </span>
              </div>
              <div className="p-2.5 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900">
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 block">SOLDADO 2:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {personas.find((p) => p.id === servicioManana.titulares.soldados[1]?.personaIdReal)?.nombre || 'Soldado 2'}
                </span>
              </div>
              <div className="col-span-2 p-2 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900 flex justify-between text-[11px]">
                <span>
                  <strong>Imag. Cabo:</strong> {personas.find((p) => p.id === servicioManana.imaginarias.cabo.personaIdReal)?.nombre || 'Cabo'}
                </span>
                <span>
                  <strong>Imag. Soldado:</strong> {personas.find((p) => p.id === servicioManana.imaginarias.soldado.personaIdReal)?.nombre || 'Soldado'}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-xs text-slate-400">
              No hay guardia programada mañana en el cuadrante.
            </div>
          )}
        </div>
      </div>

      {/* Grid de Tarjetas de Métricas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          id="stat-personal-activo"
          title="Personal Activo"
          value={stats.personalActivo}
          subtitle="Plantilla operativa actual"
          icon={<Users className="h-5 w-5 text-blue-600" />}
          variant="accent"
        />

        <StatCard
          id="stat-cabos-activos"
          title="Cabos Activos"
          value={stats.cabosActivos}
          subtitle="Titulares e imaginarias"
          icon={<Shield className="h-5 w-5 text-amber-600" />}
          variant="amber"
        />

        <StatCard
          id="stat-soldados-activos"
          title="Soldados Activos"
          value={stats.soldadosActivos}
          subtitle="Titulares e imaginarias"
          icon={<Shield className="h-5 w-5 text-emerald-600" />}
          variant="emerald"
        />

        <StatCard
          id="stat-cuentas-activas"
          title="Cuentas de Acceso"
          value={stats.cuentasActivas}
          subtitle={`${stats.cuentasPendientes} pendientes • ${stats.cuentasDesactivadas} desc.`}
          icon={<KeyRound className="h-5 w-5 text-purple-600" />}
          variant="purple"
        />
      </div>

      {/* Registro de Auditoría Reciente */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Trazabilidad y Registro de Auditoría Reciente
            </h3>
          </div>
          <button
            onClick={() => onSelectTab('historial')}
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            <span>Ver todo el historial</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {recentLogs.length === 0 ? (
          <p className="text-center py-6 text-xs text-slate-400">
            No hay registros de auditoría recientes.
          </p>
        ) : (
          <div className="space-y-2">
            {recentLogs.slice(0, 5).map((log) => {
              const accionInfo = formatAccionAudit(log.accion);
              return (
                <div
                  key={log.id}
                  className="flex items-start justify-between rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/40"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${accionInfo.badgeColor}`}>
                        {accionInfo.label}
                      </span>
                      <span className="text-slate-400">• por {log.adminNombre}</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">{log.detalles}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                    {formatFecha(log.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modales de Orden de Rotación y Nuevo Ciclo */}
      <OrdenRotacionModal
        isOpen={isRotacionModalOpen}
        onClose={() => setIsRotacionModalOpen(false)}
        personas={personas}
        adminInfo={adminInfo}
        cicloNombre={cuadranteActivo?.nombre}
        onSaved={async () => {
          if (onRefreshPersonal) await onRefreshPersonal();
          cargarDatosOperativos();
        }}
      />

      <NuevoCicloModal
        isOpen={isNuevoCicloModalOpen}
        onClose={() => setIsNuevoCicloModalOpen(false)}
        personasActuales={personas}
        adminInfo={adminInfo}
        onCicloCompletado={async () => {
          if (onRefreshPersonal) await onRefreshPersonal();
          cargarDatosOperativos();
        }}
      />

      {/* Modal de Detalle de Aprobación de Cambio de Servicio */}
      <DetalleAprobacionCambioModal
        isOpen={!!modalSolicitudAdmin}
        onClose={() => setModalSolicitudAdmin(null)}
        solicitud={modalSolicitudAdmin}
        adminInfo={adminInfo}
        servicios={servicios}
        personas={personas}
        onResolved={async () => {
          setModalSolicitudAdmin(null);
          await cargarDatosOperativos();
        }}
      />
    </div>
  );
};
