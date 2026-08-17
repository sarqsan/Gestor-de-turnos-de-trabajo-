import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../firebase/context';
import {
  Persona,
  CuadranteMaestro,
  ServicioDia,
  SlotServicioTipo,
  SolicitudCambio,
  IncidenciaAusencia,
  Notificacion,
  ParteMedico,
  TipoUnidad,
} from '../types';
import { Badge } from '../components/common/Badge';
import { getCuadrantes, getServiciosByCuadranteId } from '../services/cuadranteService';
import {
  getSolicitudesCambio,
  responderSolicitudCompanero,
  aceptarContraofertaSolicitante,
} from '../services/cambiosService';
import {
  getIncidenciasAusencia,
  aceptarCoberturaImaginaria,
  confirmarRecepcionAvisoImaginaria,
  getPartesMedicos,
} from '../services/ausenciasService';
import { getNotificaciones } from '../services/notificacionesService';
import { registrarAccionAudit } from '../services/auditService';
import { SolicitarCambioModal } from '../components/cambios/SolicitarCambioModal';
import { ResponderContraofertaModal } from '../components/cambios/ResponderContraofertaModal';
import { VerDocumentoCambioModal } from '../components/cambios/VerDocumentoCambioModal';
import { ComunicarAusenciaModal } from '../components/ausencias/ComunicarAusenciaModal';
import { NotificacionesModal } from '../components/notificaciones/NotificacionesModal';
import { ChatModal } from '../components/chat/ChatModal';
import { CuadranteMensualView } from '../components/cuadrante/CuadranteMensualView';
import { ChatPage } from './ChatPage';
import {
  User,
  Shield,
  Calendar,
  Layers,
  Repeat,
  AlertTriangle,
  Bell,
  LogOut,
  Clock,
  ArrowRightLeft,
  ShieldAlert,
  CheckCircle,
  XCircle,
  MessageSquare,
  ChevronRight,
  UserCheck,
  Award,
  Sparkles,
  CalendarDays,
  Activity,
  FileText,
  ExternalLink,
  ArrowLeft,
  RotateCcw,
  FileCheck,
} from 'lucide-react';

export const UserPortalPage: React.FC = () => {
  const { currentCuenta, currentPersona, logout, loginAsSimulatedUser, personas } = useAuth();

  // Detección de Modo Simulación (Administrador viendo como usuario)
  const impersonatorUid = localStorage.getItem('admin_impersonator_uid');
  const impersonatorNombre = localStorage.getItem('admin_impersonator_nombre') || 'Administrador';

  // Estados de datos
  const [cuadranteActivo, setCuadranteActivo] = useState<CuadranteMaestro | null>(null);
  const [servicios, setServicios] = useState<ServicioDia[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudCambio[]>([]);
  const [incidencias, setIncidencias] = useState<IncidenciaAusencia[]>([]);
  const [partesMedicos, setPartesMedicos] = useState<ParteMedico[]>([]);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(true);

  // Pestañas activas en el portal del usuario
  const [activeTab, setActiveTab] = useState<'proximos' | 'imaginarias' | 'solicitudes' | 'bajas' | 'calendario' | 'chat'>('proximos');

  // Modales
  const [isCambioModalOpen, setIsCambioModalOpen] = useState(false);
  const [preselectedServicioId, setPreselectedServicioId] = useState<string | undefined>(undefined);
  const [preselectedSlotTipo, setPreselectedSlotTipo] = useState<SlotServicioTipo | undefined>(undefined);
  const [selectedSolContraoferta, setSelectedSolContraoferta] = useState<SolicitudCambio | null>(null);
  const [selectedDocFirmadoId, setSelectedDocFirmadoId] = useState<string | null>(null);
  const [isAusenciaModalOpen, setIsAusenciaModalOpen] = useState(false);
  const [isNotificacionesOpen, setIsNotificacionesOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInitialTab, setChatInitialTab] = useState<'GRUPO' | 'PRIVADO' | 'ADMINISTRATIVO'>('GRUPO');
  const [chatInitialDestinatarioId, setChatInitialDestinatarioId] = useState<string | undefined>(undefined);

  const userTipoUnidad: TipoUnidad = currentPersona?.tipoUnidad || (currentPersona?.unidad === 'US_SEGURIDAD' ? 'US' : 'GUARDIA');

  // Cargar datos
  const cargarDatos = async () => {
    setLoading(true);
    try {
      const cuadrantes = await getCuadrantes({ tipoUnidad: userTipoUnidad });
      const activo = cuadrantes.find((c) => c.estado === 'CONFIRMADO' || c.estado === 'SIMULACION') || cuadrantes[0];
      setCuadranteActivo(activo || null);

      if (activo) {
        const srvs = await getServiciosByCuadranteId(activo.id);
        setServicios(srvs);

        const incs = await getIncidenciasAusencia(activo.id);
        setIncidencias(incs);
      }

      // Solicitudes de cambio de la unidad activa del usuario
      const sols = await getSolicitudesCambio(undefined, userTipoUnidad);
      setSolicitudes(sols);

      if (currentPersona?.id) {
        const partes = await getPartesMedicos(currentPersona.id, false);
        setPartesMedicos(partes);
      }

      const notifs = await getNotificaciones(currentPersona?.id, currentCuenta?.uid, false);
      setNotificaciones(notifs);
    } catch (err) {
      console.error('Error cargando datos de usuario:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [currentPersona?.id, currentCuenta?.uid]);

  const hoyStr = new Date().toISOString().split('T')[0];

  // 1. Identificar si hay alerta urgente de cobertura para el usuario (es imaginaria y hay baja comunicada)
  const alertasCoberturaPendientes = useMemo(() => {
    if (!currentPersona) return [];
    return (incidencias || []).filter(
      (inc) =>
        (inc.estado === 'COMUNICADA_PENDIENTE_COBERTURA' || inc.estado === 'IMAGINARIA_ACTIVADA_COBERTURA' || inc.estado === 'COBERTURA_ACEPTADA_PENDIENTE_ADMIN') &&
        inc.puesto === currentPersona.empleo &&
        (inc.imaginariaCaboPersonaId === currentPersona.id ||
          inc.imaginariaSoldadoPersonaId === currentPersona.id ||
          inc.imaginariaNotificadaPersonaId === currentPersona.id ||
          inc.imaginariaAceptantePersonaId === currentPersona.id)
    );
  }, [incidencias, currentPersona]);

  // 2. Mis servicios titulares
  const misServiciosTitulares = useMemo(() => {
    if (!currentPersona) return [];
    const lista: {
      servicio: ServicioDia;
      slotTipo: SlotServicioTipo;
      puestoNombre: string;
      esTitularOriginal: boolean;
      titularOriginalNombre?: string;
      estaCambiado: boolean;
      sustitutoNombre?: string;
    }[] = [];

    (servicios || []).forEach((s) => {
      // Cabo 1
      if (s.titulares?.cabos?.[0]?.personaIdReal === currentPersona.id) {
        const orig = (personas || []).find((p) => p.id === s.titulares.cabos[0].personaIdOriginal);
        lista.push({
          servicio: s,
          slotTipo: 'cabo_1',
          puestoNombre: 'Cabo Titular 1',
          esTitularOriginal: s.titulares.cabos[0].personaIdOriginal === currentPersona.id,
          titularOriginalNombre: orig?.nombre,
          estaCambiado: s.titulares.cabos[0].personaIdOriginal !== currentPersona.id,
        });
      }
      // Cabo 2
      if (s.titulares?.cabos?.[1]?.personaIdReal === currentPersona.id) {
        const orig = (personas || []).find((p) => p.id === s.titulares.cabos[1].personaIdOriginal);
        lista.push({
          servicio: s,
          slotTipo: 'cabo_2',
          puestoNombre: 'Cabo Titular 2',
          esTitularOriginal: s.titulares.cabos[1].personaIdOriginal === currentPersona.id,
          titularOriginalNombre: orig?.nombre,
          estaCambiado: s.titulares.cabos[1].personaIdOriginal !== currentPersona.id,
        });
      }
      // Soldado 1
      if (s.titulares?.soldados?.[0]?.personaIdReal === currentPersona.id) {
        const orig = (personas || []).find((p) => p.id === s.titulares.soldados[0].personaIdOriginal);
        lista.push({
          servicio: s,
          slotTipo: 'soldado_1',
          puestoNombre: 'Soldado Titular 1',
          esTitularOriginal: s.titulares.soldados[0].personaIdOriginal === currentPersona.id,
          titularOriginalNombre: orig?.nombre,
          estaCambiado: s.titulares.soldados[0].personaIdOriginal !== currentPersona.id,
        });
      }
      // Soldado 2
      if (s.titulares?.soldados?.[1]?.personaIdReal === currentPersona.id) {
        const orig = (personas || []).find((p) => p.id === s.titulares.soldados[1].personaIdOriginal);
        lista.push({
          servicio: s,
          slotTipo: 'soldado_2',
          puestoNombre: 'Soldado Titular 2',
          esTitularOriginal: s.titulares.soldados[1].personaIdOriginal === currentPersona.id,
          titularOriginalNombre: orig?.nombre,
          estaCambiado: s.titulares.soldados[1].personaIdOriginal !== currentPersona.id,
        });
      }

      // Si el usuario era titular original pero fue sustituido por otro
      const fueSustituido = [
        ...(s.titulares?.cabos || []),
        ...(s.titulares?.soldados || []),
      ].find((t) => t?.personaIdOriginal === currentPersona.id && t?.personaIdReal !== currentPersona.id);

      if (fueSustituido) {
        const sustituto = (personas || []).find((p) => p.id === fueSustituido.personaIdReal);
        lista.push({
          servicio: s,
          slotTipo: currentPersona.empleo === 'CABO' ? 'cabo_1' : 'soldado_1',
          puestoNombre: `Guardia Cedida (${currentPersona.empleo})`,
          esTitularOriginal: true,
          estaCambiado: true,
          sustitutoNombre: sustituto?.nombre,
        });
      }
    });

    return lista.sort((a, b) => a.servicio.fecha.localeCompare(b.servicio.fecha));
  }, [servicios, currentPersona, personas]);

  // 3. Mis servicios como imaginaria
  const misImaginarias = useMemo(() => {
    if (!currentPersona) return [];
    return (servicios || [])
      .filter(
        (s) =>
          s.imaginarias?.cabo?.personaIdReal === currentPersona.id ||
          s.imaginarias?.soldado?.personaIdReal === currentPersona.id
      )
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [servicios, currentPersona]);

  // 4. Próximo servicio destacado (el más cercano >= hoy)
  const proximoServicio = useMemo(() => {
    return misServiciosTitulares.find((item) => item.servicio.fecha >= hoyStr);
  }, [misServiciosTitulares, hoyStr]);

  // 5. Mis solicitudes
  const misSolicitudesRecibidas = useMemo(() => {
    if (!currentPersona) return [];
    return (solicitudes || []).filter((s) => s.destinatarioPersonaId === currentPersona.id);
  }, [solicitudes, currentPersona]);

  const misSolicitudesEnviadas = useMemo(() => {
    if (!currentPersona) return [];
    return (solicitudes || []).filter((s) => s.solicitantePersonaId === currentPersona.id);
  }, [solicitudes, currentPersona]);

  // Responder solicitud
  const handleAceptarCompanero = async (solId: string, aceptar: boolean) => {
    if (!currentPersona) return;
    const res = await responderSolicitudCompanero({
      solicitudId: solId,
      aceptada: aceptar,
      firmaDestinatario: `FIRMA_DIGITAL_${currentPersona.dni || currentPersona.id}_${Date.now()}`,
      personaInfo: { id: currentPersona.id, nombre: currentPersona.nombre, empleo: currentPersona.empleo },
    });
    alert(res.message);
    cargarDatos();
  };

  // Confirmar recepción del aviso de imaginaria (cambio a verde)
  const handleConfirmarRecepcionAviso = async (incId: string) => {
    if (!currentPersona) return;
    const res = await confirmarRecepcionAvisoImaginaria({
      incidenciaId: incId,
      imaginariaPersona: currentPersona,
    });
    alert(res.message);
    cargarDatos();
  };

  // Aceptar contraoferta propuesta por el compañero
  const handleAceptarContraoferta = async (solId: string) => {
    if (!currentPersona) return;
    const res = await aceptarContraofertaSolicitante({
      solicitudId: solId,
      firmaSolicitante: `FIRMA_DIGITAL_${currentPersona.dni || currentPersona.id}_${Date.now()}`,
      personaInfo: { id: currentPersona.id, nombre: currentPersona.nombre },
    });
    alert(res.message);
    cargarDatos();
  };

  // Aceptar cobertura
  const handleAceptarCobertura = async (incId: string) => {
    if (!currentPersona) return;
    const res = await aceptarCoberturaImaginaria({
      incidenciaId: incId,
      imaginariaPersona: currentPersona,
    });
    alert(res.message);
    cargarDatos();
  };

  // Salir de la vista simulada y volver a la sesión de administrador
  const handleVolverModoAdmin = async () => {
    if (!impersonatorUid) return;

    try {
      // Registrar log de finalización en auditoría
      await registrarAccionAudit(
        'MODO_ADMIN_VER_COMO_USUARIO_FIN',
        {
          uid: impersonatorUid,
          nombre: impersonatorNombre,
        },
        {
          tipo: 'ADMINISTRACION',
          id: currentPersona?.id || 'unknown',
          nombre: currentPersona?.nombre || 'Usuario',
        },
        `Admin ${impersonatorNombre} finalizó la visualización simulada del usuario ${currentPersona?.nombre}`
      );
    } catch (e) {
      console.warn('Error registrando fin de auditoria:', e);
    } finally {
      localStorage.removeItem('admin_impersonator_uid');
      localStorage.removeItem('admin_impersonator_nombre');
      await loginAsSimulatedUser(impersonatorUid);
    }
  };

  const noLeidasNotifsCount = (notificaciones || []).filter((n) => !n.leida).length;

  return (
    <div id="user-portal-page" className="min-h-screen bg-slate-100 dark:bg-slate-950 p-3 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-5">
        {/* BANNER MODO SIMULACIÓN ADMINISTRADOR */}
        {impersonatorUid && (
          <div
            id="banner-admin-simulacion"
            className="sticky top-2 z-40 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 p-4 text-white shadow-lg border-2 border-amber-400 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-900/60 font-black text-amber-200 shadow-inner shrink-0">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-amber-100 flex items-center gap-2">
                  <span>Modo Administrador: Visualización Simulada Activa</span>
                  <span className="px-2 py-0.2 rounded-md bg-amber-950/80 text-[10px] text-amber-300 font-bold border border-amber-500/40">
                    Solo Lectura Real
                  </span>
                </div>
                <p className="text-[11px] text-amber-100/90 mt-0.5">
                  Estás viendo el portal desde la perspectiva de <strong>{currentPersona?.nombre || 'este efectivo'}</strong> ({currentPersona?.empleo} - {currentPersona?.unidad}). Sesión Mando: {impersonatorNombre}.
                </p>
              </div>
            </div>

            <button
              id="btn-volver-modo-admin"
              onClick={handleVolverModoAdmin}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-black text-amber-950 shadow hover:bg-amber-50 transition-all shrink-0 self-end sm:self-auto cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Volver a Administrador</span>
            </button>
          </div>
        )}

        {/* Cabecera Principal */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3.5">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-black shadow-inner ${
                currentPersona?.empleo === 'CABO'
                  ? 'bg-blue-600 text-white'
                  : 'bg-emerald-600 text-white'
              }`}
            >
              {(currentPersona?.nombre || currentCuenta?.nombre || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black text-slate-900 dark:text-white sm:text-lg">
                  {currentPersona?.nombre || currentCuenta?.nombre || 'Usuario'}
                </h1>
                {currentPersona && (
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                      currentPersona.empleo === 'CABO'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    }`}
                  >
                    {currentPersona.empleo}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {currentPersona?.unidad || 'Unidad Militar'} • DNI: {currentPersona?.dni || 'Sin DNI'} • {currentCuenta?.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Botón de Notificaciones */}
            <button
              onClick={() => setIsNotificacionesOpen(true)}
              className="p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200 relative transition"
              title="Notificaciones"
            >
              <Bell className="h-4 w-4" />
              {noLeidasNotifsCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white rounded-full text-[10px] font-black flex items-center justify-center animate-pulse">
                  {noLeidasNotifsCount}
                </span>
              )}
            </button>

            {/* Botón de Chat con Oficina de Mando */}
            <button
              onClick={() => {
                setChatInitialTab('PRIVADO');
                setChatInitialDestinatarioId('ADMIN_OFICIAL');
                setIsChatOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/80 px-3 py-2 text-xs font-bold text-indigo-900 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300 transition"
              title="Chat Privado con Administración / Mando"
            >
              <MessageSquare className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="hidden md:inline">Contactar Mando</span>
            </button>

            {/* Botón de Chat General */}
            <button
              onClick={() => {
                setChatInitialTab('GRUPO');
                setIsChatOpen(true);
              }}
              className="p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200 transition"
              title="Canal de Chat General"
            >
              <MessageSquare className="h-4 w-4" />
            </button>

            {/* Logout */}
            <button
              onClick={() => logout()}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200 transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>

        {/* ALERTA URGENTE DE COBERTURA: Si el usuario es imaginaria de una incidencia */}
        {alertasCoberturaPendientes.length > 0 && (
          <div className="rounded-2xl border-2 border-red-500 bg-red-50 p-4 shadow-md space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-600 text-white rounded-xl shrink-0 mt-0.5">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-xs font-black text-red-950 uppercase tracking-wide">
                  ⚠️ ALERTA DE COBERTURA DE SERVICIO ({alertasCoberturaPendientes.length})
                </h3>
                <p className="text-xs text-red-900 mt-0.5 leading-relaxed font-semibold">
                  Estás designado como Imaginaria y se ha comunicado una baja médica/indisposición para la guardia de 24h.
                </p>
                <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded-lg text-[11px] font-bold text-red-900 flex items-center gap-1.5">
                  <span>ℹ️</span>
                  <span>La notificación de la aplicación no sustituye la comunicación directa con el personal de guardia si procede.</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-1 border-t border-red-200">
              {alertasCoberturaPendientes.map((inc) => {
                const confirmada = inc.confirmacionImaginaria?.confirmada || inc.estado === 'IMAGINARIA_ACTIVADA_COBERTURA';
                return (
                  <div
                    key={inc.id}
                    className="p-3 bg-white border border-red-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          Guardia del {inc.fechaServicio} (08:00 a 08:00)
                        </span>
                        {confirmada ? (
                          <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-md flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            IMAGINARIA ACTIVADA / COBERTURA
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Pendiente Confirmación
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Titular indispuesto: <strong>{inc.titularNombre}</strong> ({inc.puesto}) • Motivo: {inc.tipoAusencia || 'Indisposición'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {!confirmada ? (
                        <button
                          onClick={() => handleConfirmarRecepcionAviso(inc.id)}
                          className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-xs font-black rounded-xl shadow-md transition whitespace-nowrap cursor-pointer flex items-center gap-1.5"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>HE SIDO INFORMADO / ACEPTO LA COBERTURA</span>
                        </button>
                      ) : (
                        <span className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl">
                          ✓ Cobertura Confirmada
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PRÓXIMO SERVICIO DESTACADO (24h: 08:00 a 08:00) */}
        {proximoServicio ? (
          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                    Tu Próxima Guardia de 24 Horas
                  </span>
                  <h2 className="text-lg font-black text-white">
                    {proximoServicio.servicio.fecha} ({proximoServicio.servicio.esFinDeSemana ? 'FIN DE SEMANA' : 'Laborable'})
                  </h2>
                </div>
              </div>
              <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-bold text-slate-200 border border-white/10">
                08:00 h → 08:00 h (24 Horas)
              </span>
            </div>

            {/* Sustitución / Titularidad badges */}
            {proximoServicio.estaCambiado && (
              <div className="p-3 bg-amber-500/20 border border-amber-500/30 rounded-xl text-xs text-amber-200 font-semibold flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-amber-400 shrink-0" />
                {proximoServicio.sustitutoNombre ? (
                  <span>
                    SERVICIO CUBIERTO POR: <strong>{proximoServicio.sustitutoNombre}</strong> (Permuta aprobada)
                  </span>
                ) : (
                  <span>
                    TÚ REALIZAS EL SERVICIO (Titular original: <strong>{proximoServicio.titularOriginalNombre}</strong>)
                  </span>
                )}
              </div>
            )}

            {/* Compañeros de Turno en ese día */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Compañeros de Servicio ese día:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl">
                  <span className="text-[10px] font-bold text-blue-400 block">CABO 1:</span>
                  <span className="font-semibold text-slate-200 truncate block">
                    {(personas || []).find((p) => p.id === proximoServicio.servicio.titulares?.cabos?.[0]?.personaIdReal)?.nombre || 'Cabo 1'}
                  </span>
                </div>
                <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl">
                  <span className="text-[10px] font-bold text-blue-400 block">CABO 2:</span>
                  <span className="font-semibold text-slate-200 truncate block">
                    {(personas || []).find((p) => p.id === proximoServicio.servicio.titulares?.cabos?.[1]?.personaIdReal)?.nombre || 'Cabo 2'}
                  </span>
                </div>
                <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl">
                  <span className="text-[10px] font-bold text-emerald-400 block">SOLDADO 1:</span>
                  <span className="font-semibold text-slate-200 truncate block">
                    {(personas || []).find((p) => p.id === proximoServicio.servicio.titulares?.soldados?.[0]?.personaIdReal)?.nombre || 'Soldado 1'}
                  </span>
                </div>
                <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl">
                  <span className="text-[10px] font-bold text-emerald-400 block">SOLDADO 2:</span>
                  <span className="font-semibold text-slate-200 truncate block">
                    {(personas || []).find((p) => p.id === proximoServicio.servicio.titulares?.soldados?.[1]?.personaIdReal)?.nombre || 'Soldado 2'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 text-center text-xs text-slate-500">
            No tienes servicios titulares próximos programados en el cuadrante activo.
          </div>
        )}

        {/* ACCIONES RÁPIDAS (Botones Grandes pensados para móvil) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => setIsCambioModalOpen(true)}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 transition text-center gap-1.5"
          >
            <div className="p-2.5 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded-xl">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 dark:text-white">Solicitar Cambio</span>
            <span className="text-[10px] text-slate-400">Permuta entre compañeros</span>
          </button>

          <button
            onClick={() => setIsAusenciaModalOpen(true)}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 transition text-center gap-1.5"
          >
            <div className="p-2.5 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 rounded-xl">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 dark:text-white">Comunicar Ausencia</span>
            <span className="text-[10px] text-slate-400">Alerta a imaginarias</span>
          </button>

          <button
            onClick={() => setIsChatOpen(true)}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 transition text-center gap-1.5"
          >
            <div className="p-2.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 rounded-xl">
              <MessageSquare className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 dark:text-white">Chat del Grupo</span>
            <span className="text-[10px] text-slate-400">Canal y directivas</span>
          </button>

          <button
            onClick={() => setActiveTab('calendario')}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 transition text-center gap-1.5"
          >
            <div className="p-2.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 rounded-xl">
              <CalendarDays className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 dark:text-white">Mi Calendario</span>
            <span className="text-[10px] text-slate-400">Vista mensual</span>
          </button>
        </div>

        {/* PESTAÑAS OPERATIVAS */}
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          {/* Barra de Tabs */}
          <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-2 gap-1 overflow-x-auto text-xs font-bold">
            <button
              onClick={() => setActiveTab('proximos')}
              className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'proximos'
                  ? 'bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <Clock className="w-4 h-4" />
              Mis Guardias ({misServiciosTitulares.length})
            </button>
            <button
              onClick={() => setActiveTab('imaginarias')}
              className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'imaginarias'
                  ? 'bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <Layers className="w-4 h-4" />
              Mis Imaginarias ({misImaginarias.length})
            </button>
            <button
              onClick={() => setActiveTab('solicitudes')}
              className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'solicitudes'
                  ? 'bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <Repeat className="w-4 h-4" />
              Solicitudes ({misSolicitudesRecibidas.length + misSolicitudesEnviadas.length})
            </button>
            <button
              onClick={() => setActiveTab('bajas')}
              className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'bajas'
                  ? 'bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              Mis Bajas ({partesMedicos.length})
            </button>
            <button
              onClick={() => setActiveTab('calendario')}
              className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'calendario'
                  ? 'bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Calendario Mensual
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'chat'
                  ? 'bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Canal de Chat
            </button>
          </div>

          {/* Contenido de Tabs */}
          <div className="p-5">
            {/* TAB 1: MIS GUARDIAS */}
            {activeTab === 'proximos' && (
              <div className="space-y-2.5">
                {misServiciosTitulares.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs">
                    No tienes servicios titulares asignados en este ciclo.
                  </div>
                ) : (
                  misServiciosTitulares.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                        item.servicio.fecha === hoyStr
                          ? 'bg-emerald-50/70 border-emerald-300 dark:bg-emerald-950/30'
                          : item.servicio.fecha < hoyStr
                          ? 'bg-slate-50 border-slate-200 opacity-60 dark:bg-slate-800/40 dark:border-slate-800'
                          : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 text-center shrink-0">
                          <span className="text-xs font-black text-slate-900 dark:text-white block">
                            {new Date(item.servicio.fecha).toLocaleDateString('es-ES', { day: '2-digit' })}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">
                            {new Date(item.servicio.fecha).toLocaleDateString('es-ES', { month: 'short' })}
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                              {item.servicio.fecha} ({new Date(item.servicio.fecha).toLocaleDateString('es-ES', { weekday: 'long' })})
                            </h4>
                            {item.servicio.esFinDeSemana && (
                              <span className="px-2 py-0.2 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-bold rounded-md">
                                FIN DE SEMANA
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Puesto: <strong>{item.puestoNombre}</strong> • 08:00 a 08:00 (24h)
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {item.estaCambiado && (
                          <span className="px-2.5 py-1 bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 text-[10px] font-bold rounded-lg flex items-center gap-1">
                            <ArrowRightLeft className="w-3 h-3" />
                            {item.sustitutoNombre ? `Cedida a ${item.sustitutoNombre}` : `Sustituyendo a ${item.titularOriginalNombre}`}
                          </span>
                        )}

                        {item.servicio.fecha >= hoyStr && (
                          <button
                            onClick={() => {
                              setPreselectedServicioId(item.servicio.id);
                              setPreselectedSlotTipo(item.slotTipo);
                              setIsCambioModalOpen(true);
                            }}
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1 cursor-pointer"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            <span>Permutar / Cambiar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 2: MIS IMAGINARIAS */}
            {activeTab === 'imaginarias' && (
              <div className="space-y-2.5">
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                  <strong>Servicio de Imaginaria:</strong> Debes permanecer disponible y localizable durante las 24 horas del turno (08:00 a 08:00) para cubrir cualquier indisposición o contingencia.
                </div>

                {misImaginarias.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs">
                    No tienes turnos de imaginaria asignados en este ciclo.
                  </div>
                ) : (
                  misImaginarias.map((srv) => (
                    <div
                      key={srv.id}
                      className="p-3.5 rounded-2xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded-xl">
                          <Layers className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                            {srv.fecha} ({new Date(srv.fecha).toLocaleDateString('es-ES', { weekday: 'long' })})
                          </h4>
                          <span className="text-[11px] text-slate-500">
                            Imaginaria de {currentPersona?.empleo} • 08:00 a 08:00
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {srv.esFinDeSemana && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-bold rounded-md">
                            FIN DE SEMANA
                          </span>
                        )}

                        {srv.fecha >= hoyStr && (
                          <button
                            onClick={() => {
                              setPreselectedServicioId(srv.id);
                              setPreselectedSlotTipo(
                                currentPersona?.empleo === 'CABO' ? 'imaginaria_cabo' : 'imaginaria_soldado'
                              );
                              setIsCambioModalOpen(true);
                            }}
                            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1 cursor-pointer"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            <span>Permutar Imaginaria</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 3: SOLICITUDES DE CAMBIO */}
            {activeTab === 'solicitudes' && (
              <div className="space-y-6">
                {/* Solicitudes Recibidas */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Solicitudes Recibidas de Compañeros
                  </h4>
                  {misSolicitudesRecibidas.length === 0 ? (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs text-slate-400 text-center">
                      No tienes solicitudes de cambio pendientes de respuesta.
                    </div>
                  ) : (
                    misSolicitudesRecibidas.map((sol) => (
                      <div
                        key={sol.id}
                        className="p-4 rounded-2xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                              {sol.solicitanteNombre} solicita que cubras su guardia del {sol.fechaServicio}
                            </h5>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Tipo: <strong>{sol.tipoCambio === 'IMAGINARIA' ? 'Imaginaria' : 'Guardia 24h'}</strong> • Motivo: {sol.motivo || 'Sin motivo especificado'}
                            </p>
                            {sol.servicioDevolucionFecha && (
                              <p className="text-[11px] text-blue-600 font-semibold mt-0.5">
                                Propone devolverte la guardia el: {sol.servicioDevolucionFecha}
                              </p>
                            )}
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold self-start sm:self-auto ${
                              sol.estado === 'PENDIENTE_COMPAÑERO'
                                ? 'bg-amber-100 text-amber-800'
                                : sol.estado === 'PENDIENTE_ADMIN'
                                ? 'bg-blue-100 text-blue-800'
                                : sol.estado === 'APROBADA_ADMIN'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {sol.estado}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex-wrap">
                          {sol.estado === 'PENDIENTE_COMPAÑERO' && (
                            <button
                              onClick={() => setSelectedSolContraoferta(sol)}
                              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Responder / Contraofertar
                            </button>
                          )}

                          {sol.estado === 'APROBADA_ADMIN' && (
                            <button
                              onClick={() => setSelectedDocFirmadoId(sol.documentoFirmadoId || sol.id)}
                              className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                            >
                              <FileCheck className="w-3.5 h-3.5" />
                              Ver Documento Oficial Firmado
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Solicitudes Enviadas */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Solicitudes que Has Enviado
                  </h4>
                  {misSolicitudesEnviadas.length === 0 ? (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs text-slate-400 text-center">
                      No has enviado ninguna solicitud de cambio en este ciclo.
                    </div>
                  ) : (
                    misSolicitudesEnviadas.map((sol) => (
                      <div
                        key={sol.id}
                        className="p-4 rounded-2xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                              Cambio para el {sol.fechaServicio} a {sol.destinatarioNombre}
                            </h5>
                            <span className="text-[11px] text-slate-500">
                              Enviada el {new Date(sol.fechaSolicitud).toLocaleDateString('es-ES')}
                            </span>
                          </div>

                          <span
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                              sol.estado === 'PENDIENTE_COMPAÑERO'
                                ? 'bg-amber-100 text-amber-800'
                                : sol.estado === 'CONTRAOFERTA_COMPAÑERO'
                                ? 'bg-purple-100 text-purple-800'
                                : sol.estado === 'PENDIENTE_ADMIN'
                                ? 'bg-blue-100 text-blue-800'
                                : sol.estado === 'APROBADA_ADMIN'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {sol.estado}
                          </span>
                        </div>

                        {/* Si el compañero envió una contraoferta */}
                        {sol.estado === 'CONTRAOFERTA_COMPAÑERO' && (
                          <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-2 text-xs">
                            <div className="font-bold text-purple-950 flex items-center gap-1.5">
                              <RotateCcw className="w-4 h-4 text-purple-700" />
                              <span>{sol.destinatarioNombre} ha propuesto una contraoferta:</span>
                            </div>
                            <p className="text-[11px] text-purple-900">
                              {sol.historialContraofertas?.[sol.historialContraofertas.length - 1]?.propuesta || 'Propuesta de fecha alternativa recibida.'}
                            </p>
                            {sol.servicioDevolucionFecha && (
                              <p className="text-[11px] font-bold text-purple-900">
                                Devolución solicitada: {sol.servicioDevolucionFecha}
                              </p>
                            )}
                            <div className="pt-1 flex items-center gap-2">
                              <button
                                onClick={() => handleAceptarContraoferta(sol.id)}
                                className="px-3.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-lg transition"
                              >
                                Aceptar Contraoferta y Firmar
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Documento firmado si está aprobada */}
                        {sol.estado === 'APROBADA_ADMIN' && (
                          <div className="pt-1">
                            <button
                              onClick={() => setSelectedDocFirmadoId(sol.documentoFirmadoId || sol.id)}
                              className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                            >
                              <FileCheck className="w-3.5 h-3.5" />
                              Ver Documento Oficial Firmado
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: MIS BAJAS Y PARTES MÉDICOS */}
            {activeTab === 'bajas' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      Mis Bajas y Partes Médicos
                    </h3>
                    <p className="text-xs text-slate-500">
                      Historial confidencial de indisposiciones y bajas con análisis de IA.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsAusenciaModalOpen(true)}
                    className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Nueva Baja / Indisposición
                  </button>
                </div>

                {partesMedicos.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-xs text-slate-400">
                    No tienes partes médicos ni bajas registradas.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {partesMedicos.map((parte) => (
                      <div
                        key={parte.id}
                        className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 shadow-2xs space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-2.5">
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 rounded-xl">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                                {parte.documentoNombre || 'Documento de Baja'}
                              </h4>
                              <span className="text-[10px] text-slate-400">
                                Subido el {new Date(parte.fechaSubida).toLocaleDateString('es-ES')}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
                                parte.estadoAnalisisIA === 'CONFIRMADO'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              IA: {parte.estadoAnalisisIA === 'CONFIRMADO' ? 'CONFIRMADO' : 'REVISIÓN MANUAL'}
                            </span>
                            {parte.documentoUrl && (
                              <a
                                href={parte.documentoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Ver Documento
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                          <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Fecha Inicio:</span>
                            <span className="font-bold text-slate-900 dark:text-white">{parte.fechaInicio}</span>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Fecha Fin Prevista:</span>
                            <span className="font-bold text-slate-900 dark:text-white">{parte.fechaFin || 'Pendiente de alta'}</span>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Días Registrados:</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {parte.diasDuracion ? `${parte.diasDuracion} días` : 'No explícito'}
                            </span>
                          </div>
                        </div>

                        {parte.diagnosticoResumen && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 italic">
                            «{parte.diagnosticoResumen}»
                          </p>
                        )}

                        {parte.alertaMasDeDosServicios && (
                          <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-900 dark:text-amber-200">
                            <strong>Aviso de Cuadrante:</strong> Esta baja afecta a más de 2 servicios asignados.
                            Los servicios continúan cubiertos diariamente por los imaginarias.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: CALENDARIO / VER CUADRANTE MENSUAL COMPLETO */}
            {activeTab === 'calendario' && cuadranteActivo && (
              <div className="space-y-4">
                <CuadranteMensualView
                  cuadrante={cuadranteActivo}
                  servicios={servicios}
                  personas={personas}
                  currentPersonaId={currentPersona?.id}
                  isAdmin={false}
                />
              </div>
            )}

            {/* TAB 6: CHAT DEL GRUPO */}
            {activeTab === 'chat' && (
              <ChatPage
                personas={personas}
                currentPersona={currentPersona}
                currentCuentaInfo={{
                  uid: currentCuenta?.uid || 'user',
                  nombre: currentPersona?.nombre || currentCuenta?.nombre || 'Usuario',
                  rol: 'USUARIO',
                  personaId: currentPersona?.id,
                }}
              />
            )}
          </div>
        </div>

        {/* Modales */}
        {currentPersona && cuadranteActivo && (
          <SolicitarCambioModal
            isOpen={isCambioModalOpen}
            onClose={() => {
              setIsCambioModalOpen(false);
              setPreselectedServicioId(undefined);
              setPreselectedSlotTipo(undefined);
            }}
            cuadranteId={cuadranteActivo.id}
            currentPersona={currentPersona}
            currentUid={currentCuenta?.uid}
            personas={personas}
            servicios={servicios}
            preselectedServicioId={preselectedServicioId}
            preselectedSlotTipo={preselectedSlotTipo}
            onSuccess={cargarDatos}
          />
        )}

        {currentPersona && cuadranteActivo && (
          <ComunicarAusenciaModal
            isOpen={isAusenciaModalOpen}
            onClose={() => setIsAusenciaModalOpen(false)}
            cuadranteId={cuadranteActivo.id}
            currentPersona={currentPersona}
            personas={personas}
            servicios={servicios}
            onSuccess={cargarDatos}
          />
        )}

        <NotificacionesModal
          isOpen={isNotificacionesOpen}
          onClose={() => setIsNotificacionesOpen(false)}
          personaId={currentPersona?.id}
          uid={currentCuenta?.uid}
          isAdmin={false}
          onNavigateTab={(tab, refId) => {
            if (tab === 'cambios' || tab === 'solicitudes') setActiveTab('solicitudes');
            else if (tab === 'imaginarias') setActiveTab('imaginarias');
            else if (tab === 'mis-servicios' || tab === 'servicios') setActiveTab('servicios');
            else if (tab === 'bajas') setActiveTab('bajas');
            else if (tab === 'calendario') setActiveTab('calendario');
            else if (tab === 'chat') {
              setChatInitialTab('PRIVADO');
              setChatInitialDestinatarioId(refId || 'ADMIN_OFICIAL');
              setIsChatOpen(true);
            }
          }}
        />

        <ChatModal
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          personas={personas}
          currentPersona={currentPersona}
          initialTab={chatInitialTab}
          initialDestinatarioId={chatInitialDestinatarioId}
          currentCuentaInfo={{
            uid: currentCuenta?.uid || 'user',
            nombre: currentPersona?.nombre || currentCuenta?.nombre || 'Usuario',
            rol: 'USUARIO',
            personaId: currentPersona?.id,
          }}
        />

        {selectedSolContraoferta && currentPersona && (
          <ResponderContraofertaModal
            isOpen={!!selectedSolContraoferta}
            onClose={() => setSelectedSolContraoferta(null)}
            solicitud={selectedSolContraoferta}
            currentPersona={currentPersona}
            servicios={servicios}
            onSuccess={cargarDatos}
          />
        )}

        <VerDocumentoCambioModal
          isOpen={!!selectedDocFirmadoId}
          onClose={() => setSelectedDocFirmadoId(null)}
          documentoId={selectedDocFirmadoId || undefined}
        />
      </div>
    </div>
  );
};
