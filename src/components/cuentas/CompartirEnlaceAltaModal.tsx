import React, { useState } from 'react';
import { Unidad } from '../../types';
import { Link2, Copy, Check, QrCode, X, ShieldCheck, Users } from 'lucide-react';

interface CompartirEnlaceAltaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CompartirEnlaceAltaModal: React.FC<CompartirEnlaceAltaModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [unidad, setUnidad] = useState<Unidad>('GUARDIA');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const baseUrl = window.location.origin + window.location.pathname;
  const registrationLink = `${baseUrl}#alta?unidad=${encodeURIComponent(unidad)}&ts=${Date.now()}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(registrationLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.warn('Error al copiar enlace:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden flex flex-col my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Enlace de Alta de Efectivos</h3>
              <p className="text-xs text-slate-300">
                Invitación directa para el autoregistro y completado de ficha
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

        <div className="p-6 space-y-4">
          <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 leading-relaxed">
            <div className="font-bold flex items-center gap-1.5 mb-1 text-blue-950">
              <ShieldCheck className="w-4 h-4 text-blue-700" />
              <span>Proceso de Alta y Primer Acceso</span>
            </div>
            Los efectivos que accedan a través de este enlace completarán obligatoriamente su ficha
            militar (DNI/TIM, Teléfono, Empleo y Unidad) al registrarse por primera vez.
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Unidad Destino para el Alta:
            </label>
            <select
              value={unidad}
              onChange={(e) => setUnidad(e.target.value as Unidad)}
              className="w-full text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-xl p-2.5"
            >
              <option value="GUARDIA">Unidad de Guardia (24h)</option>
              <option value="SEGURIDAD">Unidad de Seguridad</option>
              <option value="GOE III">GOE III</option>
              <option value="OTRA">Otra Unidad Militar</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Enlace de Registro Seguro:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={registrationLink}
                className="w-full text-[11px] font-mono text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-2.5 select-all"
              />
              <button
                type="button"
                onClick={handleCopy}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shrink-0 shadow-xs ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copiar
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
