import React, { useState, useMemo, useEffect } from 'react';
import { Persona, ServicioDia, SlotServicioTipo } from '../../types';
import {
  crearSolicitudCambio,
  validarViabilidadCambio,
} from '../../services/cambiosService';
import {
  ArrowRightLeft,
  Calendar,
  User,
  AlertTriangle,
  CheckCircle,
  X,
  Send,
  ShieldAlert,
  ShieldCheck,
  Info,
} from 'lucide-react';

interface SolicitarCambioModalProps {
  isOpen: boolean;
  onClose: () => void;
  cuadranteId: string;
  currentPersona: Persona;
  currentUid?: string;
  personas: Persona[];
  servicios: ServicioDia[];
  preselectedServicioId?: string;
  preselectedSlotTipo?: SlotServicioTipo;
  onSuccess: () => void;
}

export const SolicitarCambioModal: React.FC<SolicitarCambioModalProps> = ({
  isOpen,
  onClose,
  cuadranteId,
  currentPersona,
  currentUid,
  personas,
  servicios,
  preselectedServicioId,
  preselectedSlotTipo,
  onSuccess,
}) => {
  const hoyStr = new Date().toISOString().split('T')[0];

  // 1. Filtrar servicios futuros asignados a currentPersona (tanto titulares como imaginarias)
  const misServiciosFuturos = useMemo(() => {
    const lista: {
      servicio: ServicioDia;
      slotTipo: SlotServicioTipo;
      tipoCambio: 'SERVICIO' | 'IMAGINARIA';
      esTitularOriginal: boolean;
      label: string;
      key: string;
    }[] = [];

    servicios.forEach((s) => {
      if (s.fecha >= hoyStr) {
        // Titulares
        if (s.titulares.cabos[0]?.personaIdReal === currentPersona.id) {
          lista.push({
            servicio: s,
            slotTipo: 'cabo_1',
            tipoCambio: 'SERVICIO',
            esTitularOriginal: s.titulares.cabos[0].personaIdOriginal === currentPersona.id,
            label: `${s.fecha} (${s.esFinDeSemana ? 'FIN DE SEMANA' : 'Laborable'}) — Cabo Titular 1`,
            key: `${s.id}_cabo_1`,
          });
        } else if (s.titulares.cabos[1]?.personaIdReal === currentPersona.id) {
          lista.push({
            servicio: s,
            slotTipo: 'cabo_2',
            tipoCambio: 'SERVICIO',
            esTitularOriginal: s.titulares.cabos[1].personaIdOriginal === currentPersona.id,
            label: `${s.fecha} (${s.esFinDeSemana ? 'FIN DE SEMANA' : 'Laborable'}) — Cabo Titular 2`,
            key: `${s.id}_cabo_2`,
          });
        } else if (s.titulares.soldados[0]?.personaIdReal === currentPersona.id) {
          lista.push({
            servicio: s,
            slotTipo: 'soldado_1',
            tipoCambio: 'SERVICIO',
            esTitularOriginal: s.titulares.soldados[0].personaIdOriginal === currentPersona.id,
            label: `${s.fecha} (${s.esFinDeSemana ? 'FIN DE SEMANA' : 'Laborable'}) — Soldado Titular 1`,
            key: `${s.id}_soldado_1`,
          });
        } else if (s.titulares.soldados[1]?.personaIdReal === currentPersona.id) {
          lista.push({
            servicio: s,
            slotTipo: 'soldado_2',
            tipoCambio: 'SERVICIO',
            esTitularOriginal: s.titulares.soldados[1].personaIdOriginal === currentPersona.id,
            label: `${s.fecha} (${s.esFinDeSemana ? 'FIN DE SEMANA' : 'Laborable'}) — Soldado Titular 2`,
            key: `${s.id}_soldado_2`,
          });
        }

        // Imaginarias
        if (s.imaginarias.cabo?.personaIdReal === currentPersona.id) {
          lista.push({
            servicio: s,
            slotTipo: 'imaginaria_cabo',
            tipoCambio: 'IMAGINARIA',
            esTitularOriginal: s.imaginarias.cabo.personaIdOriginal === currentPersona.id,
            label: `${s.fecha} (${s.esFinDeSemana ? 'FIN DE SEMANA' : 'Laborable'}) — Cabo de IMAGINARIA`,
            key: `${s.id}_imaginaria_cabo`,
          });
        } else if (s.imaginarias.soldado?.personaIdReal === currentPersona.id) {
          lista.push({
            servicio: s,
            slotTipo: 'imaginaria_soldado',
            tipoCambio: 'IMAGINARIA',
            esTitularOriginal: s.imaginarias.soldado.personaIdOriginal === currentPersona.id,
            label: `${s.fecha} (${s.esFinDeSemana ? 'FIN DE SEMANA' : 'Laborable'}) — Soldado de IMAGINARIA`,
            key: `${s.id}_imaginaria_soldado`,
          });
        }
      }
    });

    return lista.sort((a, b) => a.servicio.fecha.localeCompare(b.servicio.fecha));
  }, [servicios, currentPersona.id, hoyStr]);

  const [selectedServicioKey, setSelectedServicioKey] = useState<string>('');
  const [destinatarioId, setDestinatarioId] = useState<string>('');
  const [proponeDevolucion, setProponeDevolucion] = useState<boolean>(false);
  const [fechaDevolucionPropuesta, setFechaDevolucionPropuesta] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('');
  const [firmaDigitalPin, setFirmaDigitalPin] = useState<string>('');
  const [firmaAceptada, setFirmaAceptada] = useState<boolean>(true);
  const [enviando, setEnviando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inicializar o auto-seleccionar servicio si viene preseleccionado
  useEffect(() => {
    if (!isOpen) return;

    if (preselectedServicioId) {
      const match = misServiciosFuturos.find(
        (item) =>
          item.servicio.id === preselectedServicioId &&
          (!preselectedSlotTipo || item.slotTipo === preselectedSlotTipo)
      );
      if (match) {
        setSelectedServicioKey(match.key);
        return;
      }
    }

    if (misServiciosFuturos.length === 1) {
      setSelectedServicioKey(misServiciosFuturos[0].key);
    } else if (misServiciosFuturos.length > 0 && !selectedServicioKey) {
      setSelectedServicioKey(misServiciosFuturos[0].key);
    }
  }, [isOpen, preselectedServicioId, preselectedSlotTipo, misServiciosFuturos]);

  // Selección activa del servicio a cambiar
  const itemSeleccionado = misServiciosFuturos.find(
    (item) => item.key === selectedServicioKey
  );

  // Calcular compañeros COMPATIBLES en tiempo real para el servicio seleccionado
  const candidatosCompatibles = useMemo(() => {
    if (!itemSeleccionado) return [];

    const fechaServicio = itemSeleccionado.servicio.fecha;
    const esImaginaria = itemSeleccionado.tipoCambio === 'IMAGINARIA';

    // Filtrar personas: mismo empleo, activas, no yo mismo
    const companerosMismoEmpleo = personas.filter(
      (p) => p.activo && p.empleo === currentPersona.empleo && p.id !== currentPersona.id
    );

    // Evaluar compatibilidad dura con el motor de reglas
    const compatibles = companerosMismoEmpleo.filter((dest) => {
      const check = validarViabilidadCambio(
        currentPersona,
        dest,
        fechaServicio,
        servicios,
        esImaginaria ? 'IMAGINARIA' : 'SERVICIO'
      );
      return check.valido;
    });

    return compatibles.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [itemSeleccionado, personas, currentPersona, servicios]);

  // Auto-seleccionar primer candidato compatible si el seleccionado ya no es compatible
  useEffect(() => {
    if (candidatosCompatibles.length > 0) {
      if (!destinatarioId || !candidatosCompatibles.some((c) => c.id === destinatarioId)) {
        setDestinatarioId(candidatosCompatibles[0].id);
      }
    } else {
      setDestinatarioId('');
    }
  }, [candidatosCompatibles]);

  const destinatarioSeleccionado = personas.find((p) => p.id === destinatarioId);

  // Pre-validación
  const validacionEnVivo = useMemo(() => {
    if (!itemSeleccionado || !destinatarioSeleccionado) return null;
    return validarViabilidadCambio(
      currentPersona,
      destinatarioSeleccionado,
      itemSeleccionado.servicio.fecha,
      servicios,
      itemSeleccionado.tipoCambio === 'IMAGINARIA' ? 'IMAGINARIA' : 'SERVICIO'
    );
  }, [itemSeleccionado, destinatarioSeleccionado, currentPersona, servicios]);

  // Posibles guardias del destinatario para proponer devolución
  const serviciosDestinatarioFuturos = useMemo(() => {
    if (!destinatarioSeleccionado) return [];
    return servicios.filter((s) => {
      if (s.fecha <= (itemSeleccionado?.servicio.fecha || hoyStr)) return false;
      return (
        s.titulares.cabos.some((c) => c.personaIdReal === destinatarioSeleccionado.id) ||
        s.titulares.soldados.some((so) => so.personaIdReal === destinatarioSeleccionado.id)
      );
    });
  }, [destinatarioSeleccionado, itemSeleccionado, servicios, hoyStr]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemSeleccionado || !destinatarioSeleccionado) {
      setErrorMsg('Por favor selecciona un servicio/imaginaria y un compañero compatible.');
      return;
    }

    if (validacionEnVivo && !validacionEnVivo.valido) {
      setErrorMsg(validacionEnVivo.motivo || 'El cambio genera incompatibilidades en el cuadrante.');
      return;
    }

    if (!firmaAceptada) {
      setErrorMsg('Debes aceptar la declaración de firma electrónica oficial.');
      return;
    }

    setEnviando(true);
    setErrorMsg(null);

    const nowIso = new Date().toISOString();
    const firmaDigital = {
      firmado: true,
      fechaHora: nowIso,
      ip: '127.0.0.1 (Autenticado)',
      identificadorFirmante: currentPersona.dni || currentPersona.id,
      nombreCompleto: currentPersona.nombre,
      empleo: currentPersona.empleo,
    };

    const srvDevolucion = serviciosDestinatarioFuturos.find((s) => s.fecha === fechaDevolucionPropuesta);

    try {
      const res = await crearSolicitudCambio({
        cuadranteId,
        tipoCambio: itemSeleccionado.tipoCambio,
        servicioId: itemSeleccionado.servicio.id,
        fechaServicio: itemSeleccionado.servicio.fecha,
        puesto: currentPersona.empleo,
        slotTipo: itemSeleccionado.slotTipo,
        solicitante: currentPersona,
        solicitanteUid: currentUid,
        destinatario: destinatarioSeleccionado,
        motivo,
        servicioDevolucionId: srvDevolucion?.id,
        servicioDevolucionFecha: proponeDevolucion ? fechaDevolucionPropuesta : undefined,
        firmaSolicitante: JSON.stringify(firmaDigital),
        servicios,
      });

      if (res.success) {
        alert(`Solicitud de cambio enviada correctamente a ${destinatarioSeleccionado.nombre} con firma digital registrada. Queda pendiente de su conformidad y de la ratificación del mando.`);
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(`Error al procesar la solicitud: ${err.message || err}`);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Solicitar Cambio Oficial</h3>
              <p className="text-xs text-slate-300">
                Petición de cambio de Servicio o Imaginaria con firma electrónica y ratificación
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
              <div>
                <strong>Incompatibilidad:</strong> {errorMsg}
              </div>
            </div>
          )}

          {/* 1. Guardia o Imaginaria a cambiar */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-500" />
              1. Servicio o Imaginaria a Cambiar
            </label>
            {misServiciosFuturos.length === 0 ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 text-center">
                No tienes servicios ni imaginarias futuras programadas en este ciclo.
              </div>
            ) : (
              <select
                value={selectedServicioKey}
                onChange={(e) => setSelectedServicioKey(e.target.value)}
                className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
              >
                {misServiciosFuturos.map((item) => (
                  <option key={item.key} value={item.key}>
                    [{item.tipoCambio}] {item.label} (08:00 a 08:00)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 2. Selección de Compañero Filtrado por Compatibilidad Estricta */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-500" />
                2. Compañero Destinatario ({currentPersona.empleo})
              </label>
              <span className="text-[11px] font-semibold text-slate-500">
                {candidatosCompatibles.length} compatible(s)
              </span>
            </div>

            {candidatosCompatibles.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Sin candidatos compatibles disponibles:</strong> Todos los compañeros de tu empleo tienen servicio asignado en esa fecha o en días adyacentes (descanso obligatorio RD-05).
                </div>
              </div>
            ) : (
              <select
                value={destinatarioId}
                onChange={(e) => setDestinatarioId(e.target.value)}
                className="w-full text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
              >
                {candidatosCompatibles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} ({p.unidad || 'GOE III'}) — Compatible
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Indicador de Viabilidad */}
          {validacionEnVivo && validacionEnVivo.valido && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>CAMBIO COMPATIBLE:</strong> El compañero no tiene servicios en fechas adyacentes. Descanso reglamentario de 24h respetado.
              </span>
            </div>
          )}

          {/* 3. Propuesta de Devolución Recíproca (Opcional) */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={proponeDevolucion}
                onChange={(e) => setProponeDevolucion(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <span className="text-xs font-bold text-slate-800">
                Proponer devolver el servicio en una fecha concreta
              </span>
            </label>

            {proponeDevolucion && (
              <div className="pt-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Fecha propuesta para cubrir al compañero:
                </label>
                {serviciosDestinatarioFuturos.length > 0 ? (
                  <select
                    value={fechaDevolucionPropuesta}
                    onChange={(e) => setFechaDevolucionPropuesta(e.target.value)}
                    className="w-full text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg p-2"
                  >
                    <option value="">-- Seleccionar fecha de su cuadrante --</option>
                    {serviciosDestinatarioFuturos.map((s) => (
                      <option key={s.id} value={s.fecha}>
                        {s.fecha} ({s.esFinDeSemana ? 'Fin de Semana' : 'Laborable'})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="date"
                    min={itemSeleccionado?.servicio.fecha || hoyStr}
                    value={fechaDevolucionPropuesta}
                    onChange={(e) => setFechaDevolucionPropuesta(e.target.value)}
                    className="w-full text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg p-2"
                  />
                )}
              </div>
            )}
          </div>

          {/* 4. Motivo Opcional */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              4. Motivo del Cambio
            </label>
            <textarea
              rows={2}
              placeholder="Asuntos propios, cambio acordado, conciliación personal/familiar, etc."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full text-xs text-slate-900 bg-white border border-slate-300 rounded-xl px-3.5 py-2 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
            />
          </div>

          {/* 5. Firma Electrónica Reglamentaria */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
            <div className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-700" />
              <span>Firma Electrónica del Solicitante:</span>
            </div>
            <div className="text-[11px] text-blue-900/90 leading-tight">
              Certifico la veracidad de la presente solicitud y el compromiso de cumplimiento del servicio acordado una vez ratificado.
            </div>
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={firmaAceptada}
                onChange={(e) => setFirmaAceptada(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <span className="text-xs font-bold text-slate-900">
                Firmar electrónicamente como {currentPersona.nombre} ({currentPersona.empleo})
              </span>
            </label>
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
              disabled={
                !itemSeleccionado ||
                !destinatarioSeleccionado ||
                candidatosCompatibles.length === 0 ||
                (validacionEnVivo !== null && !validacionEnVivo.valido) ||
                !firmaAceptada ||
                enviando
              }
              className="px-5 py-2.5 text-xs text-white bg-slate-900 hover:bg-slate-800 rounded-xl font-bold flex items-center gap-1.5 transition disabled:opacity-40 shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              {enviando ? 'Firmando y Enviando...' : 'Firmar y Enviar Solicitud'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
