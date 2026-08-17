import React, { useState, useEffect } from 'react';
import { SolicitudCambio, Persona, ServicioDia } from '../../types';
import {
  getSolicitudCambioById,
  aprobarSolicitudAdmin,
  rechazarSolicitudAdmin,
  getDocumentoFirmado,
} from '../../services/cambiosService';
import { getCuadrantes, getServiciosByCuadranteId } from '../../services/cuadranteService';
import {
  ArrowRightLeft,
  Calendar,
  User,
  CheckCircle,
  XCircle,
  ShieldCheck,
  X,
  Clock,
  FileCheck,
  AlertTriangle,
  FileText,
  BadgeAlert,
  Send,
  Lock,
} from 'lucide-react';
import { VerDocumentoCambioModal } from './VerDocumentoCambioModal';

interface DetalleAprobacionCambioModalProps {
  isOpen: boolean;
  onClose: () => void;
  solicitudId?: string | null;
  solicitudDirecta?: SolicitudCambio | null;
  adminInfo: { uid: string; nombre: string };
  personas: Persona[];
  onSuccess: () => void;
}

export const DetalleAprobacionCambioModal: React.FC<DetalleAprobacionCambioModalProps> = ({
  isOpen,
  onClose,
  solicitudId,
  solicitudDirecta,
  adminInfo,
  personas,
  onSuccess,
}) => {
  const [solicitud, setSolicitud] = useState<SolicitudCambio | null>(solicitudDirecta || null);
  const [cargando, setCargando] = useState<boolean>(false);
  const [procesando, setProcesando] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState<string>('');
  const [mostrarRechazoForm, setMostrarRechazoForm] = useState<boolean>(false);
  const [verDocModalOpen, setVerDocModalOpen] = useState<boolean>(false);
  const [serviciosCuadrante, setServiciosCuadrante] = useState<ServicioDia[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setSolicitud(null);
      setErrorMsg(null);
      setMostrarRechazoForm(false);
      setMotivoRechazo('');
      return;
    }

    const cargarDetalle = async () => {
      setCargando(true);
      setErrorMsg(null);
      try {
        let solObj: SolicitudCambio | null = solicitudDirecta || null;
        if (solicitudId) {
          solObj = await getSolicitudCambioById(solicitudId);
        }

        setSolicitud(solObj);

        if (solObj?.cuadranteId) {
          const srvs = await getServiciosByCuadranteId(solObj.cuadranteId);
          setServiciosCuadrante(srvs);
        }
      } catch (err: any) {
        console.error('Error cargando solicitud:', err);
        setErrorMsg('No se pudo cargar la información de la solicitud.');
      } finally {
        setCargando(false);
      }
    };

    cargarDetalle();
  }, [isOpen, solicitudId, solicitudDirecta]);

  if (!isOpen) return null;

  const handleAutorizar = async () => {
    if (!solicitud) return;

    if (!window.confirm(`¿Confirmas la AUTORIZACIÓN Y APLICACIÓN OFICIAL del cambio de servicio para el ${solicitud.fechaServicio}? Se registrará en la auditoría inmutable y se actualizará el cuadrante de guardia.`)) {
      return;
    }

    setProcesando(true);
    setErrorMsg(null);

    try {
      const res = await aprobarSolicitudAdmin({
        solicitud,
        adminInfo,
        cuadranteId: solicitud.cuadranteId,
        personas,
        servicios: serviciosCuadrante,
      });

      if (res.success) {
        alert(res.message || 'Cambio de servicio autorizado y aplicado correctamente al cuadrante.');
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(`Error al autorizar la solicitud: ${err.message || err}`);
    } finally {
      setProcesando(false);
    }
  };

  const handleRechazar = async () => {
    if (!solicitud) return;

    if (!motivoRechazo.trim()) {
      setErrorMsg('Debes especificar un motivo reglamentario u operativo para denegar el cambio.');
      return;
    }

    setProcesando(true);
    setErrorMsg(null);

    try {
      const res = await rechazarSolicitudAdmin({
        solicitud,
        adminInfo,
        motivoRechazo: motivoRechazo.trim(),
        personas,
      });

      if (res.success) {
        alert(res.message || 'La solicitud ha sido rechazada. El cuadrante se mantiene sin alteraciones.');
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(`Error al rechazar la solicitud: ${err.message || err}`);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
        <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh] my-auto">
          {/* Header */}
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="p-2 sm:p-2.5 bg-blue-500/20 text-blue-400 rounded-xl">
                <ArrowRightLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-blue-400 block">
                  Gestión y Autorización de Mando
                </span>
                <h3 className="text-sm sm:text-base font-black truncate">
                  Solicitud de Cambio de Servicio
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
            {cargando ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                Cargando expediente de la solicitud...
              </div>
            ) : !solicitud ? (
              <div className="text-center py-12 text-rose-500 text-sm space-y-2">
                <AlertTriangle className="w-8 h-8 mx-auto" />
                <p>No se encontró la solicitud de cambio especificada.</p>
              </div>
            ) : (
              <>
                {/* Status Alert Badge */}
                <div
                  className={`p-3.5 sm:p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 ${
                    solicitud.estado === 'PENDIENTE_ADMIN'
                      ? 'bg-amber-500/10 border-amber-400 dark:border-amber-700 text-amber-900 dark:text-amber-200'
                      : solicitud.estado === 'APROBADA_ADMIN'
                      ? 'bg-emerald-500/10 border-emerald-400 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
                      : solicitud.estado === 'RECHAZADA_ADMIN' || solicitud.estado === 'RECHAZADA_COMPAÑERO'
                      ? 'bg-rose-500/10 border-rose-400 dark:border-rose-700 text-rose-900 dark:text-rose-200'
                      : 'bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-5 h-5 shrink-0" />
                    <div>
                      <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider block opacity-75">
                        Estado Actual del Trámite
                      </span>
                      <span className="text-xs font-black">
                        {solicitud.estado === 'PENDIENTE_ADMIN'
                          ? '★ CONFORMIDAD MUTUA — PENDIENTE DE AUTORIZACIÓN DEL MANDO'
                          : solicitud.estado === 'PENDIENTE_COMPAÑERO'
                          ? 'EN TRÁMITE — ESPERANDO RESPUESTA DEL COMPAÑERO'
                          : solicitud.estado === 'APROBADA_ADMIN'
                          ? 'AUTORIZADA Y APLICADA OFICIALMENTE EN CUADRANTE'
                          : solicitud.estado === 'RECHAZADA_ADMIN'
                          ? 'DENEGADA POR LA ADMINISTRACIÓN'
                          : `ESTADO: ${solicitud.estado}`}
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold opacity-80 self-start sm:self-auto font-mono">
                    ID: {solicitud.id}
                  </span>
                </div>

                {errorMsg && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Grid con Solicitante y Compañero */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {/* Solicitante */}
                  <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                        1. Efectivo Solicitante
                      </span>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 rounded text-[10px] font-bold">
                        {solicitud.solicitanteEmpleo}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      {solicitud.solicitanteNombre}
                    </div>
                    <div className="text-xs text-slate-500">
                      Unidad: <strong>{solicitud.solicitanteUnidad || 'GUARDIA'}</strong>
                    </div>
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-between">
                      <span>Firma Electrónica:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Registrada
                      </span>
                    </div>
                  </div>

                  {/* Destinatario */}
                  <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                        2. Compañero Destinatario
                      </span>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 rounded text-[10px] font-bold">
                        {solicitud.destinatarioEmpleo}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      {solicitud.destinatarioNombre}
                    </div>
                    <div className="text-xs text-slate-500">
                      Unidad: <strong>{solicitud.destinatarioUnidad || 'GUARDIA'}</strong>
                    </div>
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-between">
                      <span>Conformidad Compañero:</span>
                      {solicitud.fechaRespuestaCompanero ? (
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Aceptada
                        </span>
                      ) : (
                        <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Pendiente
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Detalle de Servicios Acordados */}
                <div className="p-3.5 sm:p-4 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/60 rounded-2xl space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-900 dark:text-blue-300 block">
                    Detalle de los Servicios Afectados por la Permuta
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs">
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-blue-100 dark:border-blue-900/40">
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 block mb-1">
                        SERVICIO DEL SOLICITANTE
                      </span>
                      <div className="font-black text-slate-900 dark:text-white text-sm">
                        {solicitud.fechaServicio}
                      </div>
                      <div className="text-slate-600 dark:text-slate-300 mt-0.5">
                        Tipo: <strong>{solicitud.tipoCambio === 'IMAGINARIA' ? 'Imaginaria (24h)' : 'Guardia Titular (24h)'}</strong>
                      </div>
                      <div className="mt-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        ↳ Realizará: {solicitud.destinatarioNombre}
                      </div>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-blue-100 dark:border-blue-900/40">
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block mb-1">
                        COMPENSACIÓN / DEVOLUCIÓN
                      </span>
                      {solicitud.servicioDevolucionFecha ? (
                        <>
                          <div className="font-black text-slate-900 dark:text-white text-sm">
                            {solicitud.servicioDevolucionFecha}
                          </div>
                          <div className="text-slate-600 dark:text-slate-300 mt-0.5">
                            Tipo: <strong>Guardia Titular (24h)</strong>
                          </div>
                          <div className="mt-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                            ↳ Realizará: {solicitud.solicitanteNombre}
                          </div>
                        </>
                      ) : (
                        <div className="py-2 text-slate-500 text-[11px] italic">
                          Sin devolución de fecha fijada en cuadrante.
                        </div>
                      )}
                    </div>
                  </div>

                  {solicitud.motivo && (
                    <div className="p-3 bg-white/80 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                      <span className="text-[10px] font-bold text-slate-500 block uppercase">
                        Motivo Justificativo:
                      </span>
                      <p className="text-slate-700 dark:text-slate-300 italic mt-0.5">
                        "{solicitud.motivo}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Formulario de Rechazo si está expandido */}
                {mostrarRechazoForm && (
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-900 rounded-2xl space-y-3">
                    <h4 className="text-xs font-black text-rose-900 dark:text-rose-200 uppercase">
                      Motivo de Denegación de la Permuta
                    </h4>
                    <textarea
                      value={motivoRechazo}
                      onChange={(e) => setMotivoRechazo(e.target.value)}
                      placeholder="Indica la razón o necesidad del servicio por la que se deniega la solicitud..."
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500 min-h-[70px]"
                    />
                    <div className="flex flex-col sm:flex-row items-center justify-end gap-2">
                      <button
                        onClick={() => setMostrarRechazoForm(false)}
                        className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400 font-bold hover:underline cursor-pointer w-full sm:w-auto text-center"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleRechazar}
                        disabled={procesando}
                        className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 w-full sm:w-auto min-h-[44px]"
                      >
                        <XCircle className="w-4 h-4" />
                        Confirmar Denegación
                      </button>
                    </div>
                  </div>
                )}

                {/* Si ya está aprobada: Botón para ver documento firmado */}
                {solicitud.estado === 'APROBADA_ADMIN' && solicitud.documentoFirmadoId && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block">
                        Documento Oficial Generado
                      </span>
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                        Autorizado por: {solicitud.adminResolucionNombre || 'Mando'} ({solicitud.fechaResolucionAdmin ? new Date(solicitud.fechaResolucionAdmin).toLocaleDateString('es-ES') : ''})
                      </span>
                    </div>
                    <button
                      onClick={() => setVerDocModalOpen(true)}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs w-full sm:w-auto min-h-[44px]"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Ver Documento Firmado
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5 shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer w-full sm:w-auto min-h-[44px]"
            >
              Cerrar
            </button>

            {solicitud && solicitud.estado === 'PENDIENTE_ADMIN' && !mostrarRechazoForm && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => setMostrarRechazoForm(true)}
                  disabled={procesando}
                  className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[44px]"
                >
                  <XCircle className="w-4 h-4" />
                  Rechazar
                </button>

                <button
                  onClick={handleAutorizar}
                  disabled={procesando}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[44px]"
                >
                  <CheckCircle className="w-4 h-4" />
                  {procesando ? 'Aplicando...' : 'AUTORIZAR Y APLICAR'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {verDocModalOpen && solicitud?.documentoFirmadoId && (
        <VerDocumentoCambioModal
          isOpen={verDocModalOpen}
          onClose={() => setVerDocModalOpen(false)}
          documentoId={solicitud.documentoFirmadoId}
        />
      )}
    </>
  );
};
