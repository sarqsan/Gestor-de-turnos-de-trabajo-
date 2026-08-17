import React, { useState, useEffect } from 'react';
import { DocumentoCambioFirmado } from '../../types';
import { getDocumentoFirmado } from '../../services/cambiosService';
import {
  FileCheck,
  Printer,
  X,
  ShieldCheck,
  Building,
  Calendar,
  User,
  CheckCircle2,
  Lock,
} from 'lucide-react';

interface VerDocumentoCambioModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentoId?: string;
  documentoDirecto?: DocumentoCambioFirmado | null;
}

export const VerDocumentoCambioModal: React.FC<VerDocumentoCambioModalProps> = ({
  isOpen,
  onClose,
  documentoId,
  documentoDirecto,
}) => {
  const [doc, setDoc] = useState<DocumentoCambioFirmado | null>(documentoDirecto || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (documentoDirecto) {
      setDoc(documentoDirecto);
      return;
    }
    if (documentoId) {
      setLoading(true);
      getDocumentoFirmado(documentoId).then((res) => {
        setDoc(res);
        setLoading(false);
      });
    }
  }, [isOpen, documentoId, documentoDirecto]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col my-6 print:border-none print:shadow-none print:max-w-full">
        {/* Header no imprimible */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Documento Oficial de Autorización</h3>
              <p className="text-xs text-slate-300">
                Certificación oficial de cambio con firmas electrónicas inmutables
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Printer className="w-4 h-4" />
              Imprimir / PDF
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cuerpo del Documento Oficial */}
        <div className="p-8 space-y-6 text-slate-900 bg-white min-h-[500px]">
          {loading ? (
            <div className="py-20 text-center text-xs text-slate-500">
              Cargando documento oficial de verificación...
            </div>
          ) : !doc ? (
            <div className="py-20 text-center text-xs text-slate-500">
              No se pudo recuperar el documento de autorización digital.
            </div>
          ) : (
            <>
              {/* Encabezado Institucional */}
              <div className="border-b-2 border-slate-900 pb-4 text-center space-y-1">
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-600">
                  EJÉRCITO DE TIERRA • UNIDAD DE GUARDIA Y SEGURIDAD
                </div>
                <h1 className="text-lg font-black uppercase tracking-tight text-slate-900">
                  DILIGENCIA DE AUTORIZACIÓN DE CAMBIO DE SERVICIO / IMAGINARIA
                </h1>
                <div className="flex items-center justify-center gap-4 text-xs font-mono text-slate-700 pt-1">
                  <span>
                    <strong>CÓDIGO CSV:</strong> {doc.codigoVerificacion}
                  </span>
                  <span>•</span>
                  <span>
                    <strong>FECHA EMISIÓN:</strong>{' '}
                    {new Date(doc.fechaEmision).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>

              {/* Contenido / Declaración */}
              <div className="text-xs leading-relaxed space-y-4 text-slate-800">
                <p>
                  Por medio del presente documento, queda debidamente registrada y autorizada en el
                  sistema de gestión de cuadrantes la permuta/cambio voluntario de servicio entre los
                  efectivos que se detallan a continuación, habiéndose verificado el cumplimiento de
                  las directivas de descanso obligatorio y operatividad de la Unidad.
                </p>

                {/* Tabla de efectivos */}
                <div className="border border-slate-300 rounded-xl overflow-hidden text-xs">
                  <div className="bg-slate-100 p-2.5 font-black text-slate-800 border-b border-slate-300 uppercase tracking-wider text-[11px]">
                    1. DATOS DEL SERVICIO Y EFECTIVOS INTERVINIENTES
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-slate-300">
                    <div className="p-3.5 space-y-1.5 bg-slate-50/50">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        SOLICITANTE (Cede el servicio):
                      </span>
                      <div className="font-black text-slate-900 text-sm">{doc.personaA.nombre}</div>
                      <div className="text-[11px] text-slate-700">
                        Empleo: <strong>{doc.personaA.empleo}</strong> | Unidad:{' '}
                        <strong>{doc.personaA.unidad}</strong>
                      </div>
                      <div className="text-[11px] text-slate-700">
                        Fecha cedida: <strong>{doc.fechaServicioA}</strong> (08:00 a 08:00)
                      </div>
                    </div>

                    <div className="p-3.5 space-y-1.5 bg-slate-50/50">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        DESTINATARIO (Realiza el servicio):
                      </span>
                      <div className="font-black text-slate-900 text-sm">{doc.personaB.nombre}</div>
                      <div className="text-[11px] text-slate-700">
                        Empleo: <strong>{doc.personaB.empleo}</strong> | Unidad:{' '}
                        <strong>{doc.personaB.unidad}</strong>
                      </div>
                      <div className="text-[11px] text-slate-700">
                        {doc.fechaServicioB ? (
                          <>
                            Devolución acordada: <strong>{doc.fechaServicioB}</strong>
                          </>
                        ) : (
                          <span className="text-slate-500 italic">Sin devolución fijada</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Motivo registrado */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                    Motivo declarado:
                  </span>
                  <span className="font-medium text-slate-800">{doc.motivo}</span>
                </div>

                {/* Cuadro de Firmas Digitales */}
                <div className="pt-2">
                  <div className="text-[11px] font-black uppercase tracking-wider text-slate-700 mb-2">
                    2. REGISTRO DE FIRMAS ELECTRÓNICAS Y RESOLUCIÓN DEL MANDO
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                    {/* Firma Solicitante */}
                    <div className="p-3 border border-slate-300 rounded-xl bg-slate-50/50 space-y-1">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 mx-auto" />
                      <span className="font-black text-slate-800 block">Firma Solicitante</span>
                      <span className="text-slate-600 font-medium block truncate">
                        {doc.personaA.nombre}
                      </span>
                      <span className="text-[9px] font-mono text-emerald-700 block font-bold">
                        REGISTRADA
                      </span>
                      <span className="text-[9px] text-slate-500 block">
                        {new Date(doc.personaA.fechaFirma).toLocaleDateString('es-ES')}
                      </span>
                    </div>

                    {/* Firma Destinatario */}
                    <div className="p-3 border border-slate-300 rounded-xl bg-slate-50/50 space-y-1">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 mx-auto" />
                      <span className="font-black text-slate-800 block">Conformidad Compañero</span>
                      <span className="text-slate-600 font-medium block truncate">
                        {doc.personaB.nombre}
                      </span>
                      <span className="text-[9px] font-mono text-emerald-700 block font-bold">
                        ACEPTADA
                      </span>
                      <span className="text-[9px] text-slate-500 block">
                        {new Date(doc.personaB.fechaFirma).toLocaleDateString('es-ES')}
                      </span>
                    </div>

                    {/* Firma Administrador */}
                    <div className="p-3 border border-slate-300 rounded-xl bg-emerald-50/60 border-emerald-300 space-y-1">
                      <Lock className="w-4 h-4 text-emerald-700 mx-auto" />
                      <span className="font-black text-emerald-950 block">Mando / Administración</span>
                      <span className="text-emerald-900 font-medium block truncate">
                        {doc.autorizacionAdmin.adminNombre}
                      </span>
                      <span className="text-[9px] font-mono text-emerald-800 block font-black">
                        AUTORIZADO Y RATIFICADO
                      </span>
                      <span className="text-[9px] text-emerald-700 block">
                        {new Date(doc.autorizacionAdmin.fechaAutorizacion).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pie de página con validez */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-500 font-mono">
                  <span>Documento firmado electrónicamente según el protocolo de la Unidad.</span>
                  <span>Ref: {doc.id}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
