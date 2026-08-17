import React, { useState, useMemo } from 'react';
import { Persona, ServicioDia, TipoAusencia } from '../../types';
import {
  comunicarAusencia,
  subirDocumentoStorage,
  analizarDocumentoParteMedicoIA,
  ResultadoAnalisisIA,
} from '../../services/ausenciasService';
import {
  ShieldAlert,
  Calendar,
  AlertTriangle,
  Clock,
  X,
  Send,
  UserCheck,
  FileText,
  Sparkles,
  UploadCloud,
  CheckCircle2,
  Info,
} from 'lucide-react';

interface ComunicarAusenciaModalProps {
  isOpen: boolean;
  onClose: () => void;
  cuadranteId: string;
  currentPersona: Persona;
  personas: Persona[];
  servicios: ServicioDia[];
  onSuccess: () => void;
}

export const ComunicarAusenciaModal: React.FC<ComunicarAusenciaModalProps> = ({
  isOpen,
  onClose,
  cuadranteId,
  currentPersona,
  personas,
  servicios,
  onSuccess,
}) => {
  // Buscar servicios donde currentPersona es titular (incluyendo hoy, próximos días y ayer)
  const misServiciosTitular = useMemo(() => {
    const lista: {
      servicio: ServicioDia;
      slotTipo: 'cabo_1' | 'cabo_2' | 'soldado_1' | 'soldado_2';
    }[] = [];

    (servicios || []).forEach((s) => {
      if (s.titulares.cabos[0]?.personaIdReal === currentPersona.id) {
        lista.push({ servicio: s, slotTipo: 'cabo_1' });
      } else if (s.titulares.cabos[1]?.personaIdReal === currentPersona.id) {
        lista.push({ servicio: s, slotTipo: 'cabo_2' });
      } else if (s.titulares.soldados[0]?.personaIdReal === currentPersona.id) {
        lista.push({ servicio: s, slotTipo: 'soldado_1' });
      } else if (s.titulares.soldados[1]?.personaIdReal === currentPersona.id) {
        lista.push({ servicio: s, slotTipo: 'soldado_2' });
      }
    });

    return lista.sort((a, b) => b.servicio.fecha.localeCompare(a.servicio.fecha));
  }, [servicios, currentPersona.id]);

  const [selectedServicioKey, setSelectedServicioKey] = useState<string>('');
  const [tipoAusencia, setTipoAusencia] = useState<TipoAusencia>('INDISPOSICION');
  const [observaciones, setObservaciones] = useState<string>('');
  const [enviando, setEnviando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados de archivo médico y análisis IA
  const [archivo, setArchivo] = useState<File | null>(null);
  const [archivoBase64, setArchivoBase64] = useState<string | null>(null);
  const [analizandoIA, setAnalizandoIA] = useState(false);
  const [analisisIA, setAnalisisIA] = useState<ResultadoAnalisisIA | null>(null);

  const itemSeleccionado = misServiciosTitular.find(
    (item) => `${item.servicio.id}_${item.slotTipo}` === selectedServicioKey
  );

  const imagCabo = itemSeleccionado
    ? (personas || []).find((p) => p.id === itemSeleccionado.servicio.imaginarias.cabo.personaIdReal)
    : null;
  const imagSoldado = itemSeleccionado
    ? (personas || []).find((p) => p.id === itemSeleccionado.servicio.imaginarias.soldado.personaIdReal)
    : null;

  // Calcular servicios afectados por la baja
  const serviciosAfectados = useMemo(() => {
    if (!itemSeleccionado) return [];
    const fechaInicio = itemSeleccionado.servicio.fecha;
    const duracion = analisisIA?.diasDuracion || 1;
    const dFin = new Date(fechaInicio);
    dFin.setDate(dFin.getDate() + duracion - 1);
    const fechaFinStr = analisisIA?.fechaFin || dFin.toISOString().split('T')[0];

    return (servicios || []).filter((s) => {
      if (s.fecha < fechaInicio || s.fecha > fechaFinStr) return false;
      return (
        s.titulares.cabos.some((c) => c.personaIdReal === currentPersona.id) ||
        s.titulares.soldados.some((so) => so.personaIdReal === currentPersona.id)
      );
    });
  }, [servicios, itemSeleccionado, currentPersona.id, analisisIA]);

  const alertaMasDeDosServicios = serviciosAfectados.length > 2;

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('El documento no puede superar los 10 MB.');
      return;
    }

    setArchivo(file);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = () => {
      setArchivoBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalizarIA = async () => {
    if (!archivo && !observaciones) {
      setErrorMsg('Por favor adjunta el parte médico o escribe observaciones para analizar.');
      return;
    }

    setAnalizandoIA(true);
    setErrorMsg(null);

    try {
      const res = await analizarDocumentoParteMedicoIA({
        fileBase64: archivoBase64 || undefined,
        mimeType: archivo?.type || undefined,
        textoObservaciones: observaciones,
      });

      setAnalisisIA(res);
      if (res.resumenDiagnostico && !observaciones) {
        setObservaciones(res.resumenDiagnostico);
      }
    } catch (err: any) {
      setErrorMsg(`Error al analizar parte médico: ${err.message || err}`);
    } finally {
      setAnalizandoIA(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemSeleccionado) {
      setErrorMsg('Por favor selecciona el servicio afectado por la ausencia.');
      return;
    }

    setEnviando(true);
    setErrorMsg(null);

    try {
      let docUrl: string | undefined;
      let docPath: string | undefined;

      // Subir archivo a Storage si se adjuntó
      if (archivo) {
        const uploadRes = await subirDocumentoStorage(archivo, currentPersona.id);
        docUrl = uploadRes.url;
        docPath = uploadRes.path;
      }

      const res = await comunicarAusencia({
        cuadranteId,
        servicioId: itemSeleccionado.servicio.id,
        fechaServicio: itemSeleccionado.servicio.fecha,
        titular: currentPersona,
        slotTipo: itemSeleccionado.slotTipo,
        tipoAusencia,
        observaciones,
        servicioDia: itemSeleccionado.servicio,
        personas,
        documentoUrl: docUrl,
        documentoNombre: archivo?.name,
        documentoPath: docPath,
        analisisIA: analisisIA || undefined,
        todosLosServicios: servicios,
      });

      if (res.success) {
        alert(res.message);
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(`Error al comunicar ausencia: ${err.message || err}`);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden flex flex-col my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 text-red-400 rounded-lg">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Comunicar Ausencia / Baja Médica</h3>
              <p className="text-xs text-slate-300">
                Alerta de cobertura a imaginarias asignados y administradores
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>{errorMsg}</div>
            </div>
          )}

          {/* Selección de Guardia */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-500" />
              1. Guardia Titular Afectada (24 Horas: 08:00 a 08:00)
            </label>
            {misServiciosTitular.length === 0 ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 text-center">
                No tienes servicios titulares registrados en este cuadrante.
              </div>
            ) : (
              <select
                value={selectedServicioKey}
                onChange={(e) => setSelectedServicioKey(e.target.value)}
                className="w-full text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-red-900 focus:outline-hidden"
              >
                <option value="">-- Seleccionar guardia afectada --</option>
                {misServiciosTitular.map((item) => (
                  <option
                    key={`${item.servicio.id}_${item.slotTipo}`}
                    value={`${item.servicio.id}_${item.slotTipo}`}
                  >
                    {item.servicio.fecha} ({item.servicio.esFinDeSemana ? 'FIN DE SEMANA' : 'Laborable'}) - Titular ({currentPersona.empleo})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Información de Imaginarias que serán alertados */}
          {/* Alerta Directa al Imaginaria por Empleo */}
          {itemSeleccionado && (
            <div className="p-4 bg-amber-50 border-2 border-amber-400 rounded-xl text-xs space-y-3 shadow-sm">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-black text-amber-950 text-xs sm:text-sm uppercase tracking-wide">
                    Aviso Obligatorio de Cobertura de Servicio
                  </h4>
                  <p className="text-xs font-semibold text-amber-900 mt-0.5 leading-snug">
                    IMPORTANTE: Además de comunicar la baja mediante la aplicación, <span className="underline font-black">debes avisar personalmente</span> al imaginaria de tu mismo empleo que debe cubrir tu servicio.
                  </p>
                </div>
              </div>

              {/* Ficha de la imaginaria de su puesto */}
              {(() => {
                const imagTarget = currentPersona.empleo === 'CABO' ? imagCabo : imagSoldado;
                const imagTargetNombre = imagTarget?.nombre || (currentPersona.empleo === 'CABO' ? 'Cabo de Imaginaria Asignado' : 'Soldado de Imaginaria Asignado');
                const telefono = imagTarget?.telefono || (imagTarget ? '600 000 000' : 'Consultar en Unidad');

                return (
                  <div className="bg-white p-3.5 rounded-xl border border-amber-300 space-y-2 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Efectivo de Imaginaria Responsable:
                        </span>
                        <span className="font-black text-sm text-slate-900">{imagTargetNombre}</span>
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 bg-amber-100 text-amber-900 rounded-lg border border-amber-300">
                        {currentPersona.empleo} DE IMAGINARIA
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <span className="text-xs font-bold">Teléfono de contacto urgente:</span>
                        <span className="font-mono font-black text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                          {telefono}
                        </span>
                      </div>
                      {imagTarget?.telefono && (
                        <a
                          href={`tel:${imagTarget.telefono.replace(/\s+/g, '')}`}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition inline-flex items-center gap-1 shadow-xs"
                        >
                          Llamar Ahora ({imagTarget.telefono})
                        </a>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Tipo de Ausencia */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              2. Motivo / Tipo de Ausencia
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTipoAusencia('INDISPOSICION')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition ${
                  tipoAusencia === 'INDISPOSICION'
                    ? 'bg-slate-900 text-white border-slate-950'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Indisposición
              </button>
              <button
                type="button"
                onClick={() => setTipoAusencia('ENFERMEDAD')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition ${
                  tipoAusencia === 'ENFERMEDAD'
                    ? 'bg-slate-900 text-white border-slate-950'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Baja Médica
              </button>
              <button
                type="button"
                onClick={() => setTipoAusencia('OTRA_AUSENCIA')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition ${
                  tipoAusencia === 'OTRA_AUSENCIA'
                    ? 'bg-slate-900 text-white border-slate-950'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Fuerza Mayor
              </button>
            </div>
          </div>

          {/* Adjuntar Parte Médico y Análisis IA */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-600" />
                3. Adjuntar Documento / Parte Médico
              </label>
              <span className="text-[10px] text-slate-500 font-medium">Almacenado seguro en Storage</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="file"
                id="docParteMedicoInput"
                accept="application/pdf,image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="docParteMedicoInput"
                className="cursor-pointer px-3 py-2 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition"
              >
                <UploadCloud className="w-4 h-4 text-slate-500" />
                {archivo ? archivo.name : 'Seleccionar PDF o Imagen'}
              </label>

              {(archivo || observaciones) && (
                <button
                  type="button"
                  onClick={handleAnalizarIA}
                  disabled={analizandoIA}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {analizandoIA ? 'Analizando con IA...' : 'Analizar con IA (Gemini)'}
                </button>
              )}
            </div>

            {/* Resultado del Análisis IA */}
            {analisisIA && (
              <div
                className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                  analisisIA.estado === 'CONFIRMADO'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1">
                    {analisisIA.estado === 'CONFIRMADO' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    )}
                    Estado del Análisis: {analisisIA.estado === 'CONFIRMADO' ? 'CONFIRMADO (Duración Explícita)' : 'REVISIÓN MANUAL POR EL MANDO'}
                  </span>
                  <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-white font-mono">
                    Confianza: {analisisIA.confianza || 'MEDIA'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <div className="bg-white/80 p-2 rounded">
                    <span className="text-[10px] text-slate-500 block">Inicio Baja:</span>
                    <span className="font-bold">{analisisIA.fechaInicio || 'No detectado'}</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded">
                    <span className="text-[10px] text-slate-500 block">Fin Previsto:</span>
                    <span className="font-bold">{analisisIA.fechaFin || 'Pendiente alta'}</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded">
                    <span className="text-[10px] text-slate-500 block">Días Estimados:</span>
                    <span className="font-bold">{analisisIA.diasDuracion ? `${analisisIA.diasDuracion} días` : 'No explícito'}</span>
                  </div>
                </div>

                {analisisIA.estado === 'REVISION_MANUAL' && (
                  <p className="text-[11px] text-amber-800 italic pt-1">
                    * {analisisIA.motivoRevision || 'La duración no consta de forma explícita en el parte. La IA no inventa duraciones y requerirá validación manual por el mando.'}
                  </p>
                )}

                {analisisIA.resumenDiagnostico && (
                  <div className="pt-1 text-[11px]">
                    <span className="font-semibold">Resumen no confidencial:</span> {analisisIA.resumenDiagnostico}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* BANNER REGLAMENTARIO DE > 2 SERVICIOS AFECTADOS */}
          {alertaMasDeDosServicios && (
            <div className="p-3.5 bg-amber-500/10 border-2 border-amber-500 rounded-xl text-xs space-y-1.5 text-amber-950">
              <div className="font-bold flex items-center gap-1.5 text-amber-900 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                ALERTA OFICIAL: Baja Continuada (&gt; 2 Servicios Afectados)
              </div>
              <p className="text-xs font-semibold leading-relaxed">
                «La baja continuada afecta a más de 2 servicios ({serviciosAfectados.length} guardias asignadas en el periodo). Los servicios continuarán siendo cubiertos inicialmente por los imaginarias de cada día. Se está trabajando con la unidad para valorar la sustitución oficial por otro compañero.»
              </p>
              <div className="text-[11px] text-amber-800 bg-white/70 p-2 rounded-lg border border-amber-200">
                <span className="font-bold">Aclaración de Mando:</span> La superación de 2 servicios NO provoca automáticamente que otro miembro sustituya al titular. La guardia de cada día la asume el imaginaria correspondiente mientras la unidad no formalice un reemplazo oficial.
              </div>
            </div>
          )}

          {/* Observaciones */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              4. Observaciones Adicionales
            </label>
            <textarea
              rows={2}
              placeholder="Detalles sobre la situación o indicaciones para el relevo..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full text-xs text-slate-900 bg-white border border-slate-300 rounded-xl px-3.5 py-2 focus:ring-2 focus:ring-red-900 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Se registrará la hora exacta de la comunicación para la auditoría oficial del sistema.</span>
          </div>

          {/* Acciones */}
          <div className="pt-3 flex items-center justify-between border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 font-bold transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!itemSeleccionado || enviando}
              className="px-5 py-2.5 text-xs text-white bg-red-700 hover:bg-red-800 rounded-xl font-bold flex items-center gap-1.5 transition disabled:opacity-40 shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              {enviando ? 'Comunicando Ausencia...' : 'Comunicar y Alertar Imaginarias'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
