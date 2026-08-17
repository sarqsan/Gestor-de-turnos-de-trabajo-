import React from 'react';
import { Modal } from '../common/Modal';
import { Persona, Cuenta } from '../../types';
import { generarEnlaceActivacionWhatsApp } from '../../services/whatsappService';
import { MessageSquare, AlertCircle, ExternalLink, Copy, Check } from 'lucide-react';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  persona: Persona | null;
  cuenta?: Cuenta | null;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  isOpen,
  onClose,
  persona,
  cuenta,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!persona) return null;

  const inviteResult = generarEnlaceActivacionWhatsApp(persona, cuenta);

  const handleCopyLink = () => {
    if (inviteResult.textPayload) {
      navigator.clipboard.writeText(inviteResult.textPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Modal
      id="modal-whatsapp-invite"
      isOpen={isOpen}
      onClose={onClose}
      title={`Acceso por WhatsApp: ${persona.nombre}`}
      subtitle="Envío de enlace seguro de activación de cuenta (sin contraseñas)"
    >
      <div className="space-y-4">
        {/* Status Callout */}
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Función pendiente de configuración</p>
            <p className="text-[11px] leading-relaxed">
              El envío directo por API de WhatsApp Business requiere credenciales de pasarela externa. La arquitectura genera un <strong>enlace seguro de activación</strong> para que el usuario establezca su propia contraseña en Firebase Authentication.
            </p>
          </div>
        </div>

        {/* Person details */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-slate-500 text-[11px]">Destinatario:</span>
              <p className="font-semibold text-slate-900 dark:text-white">
                {persona.nombre} ({persona.empleo})
              </p>
            </div>
            <div>
              <span className="text-slate-500 text-[11px]">Teléfono:</span>
              <p className="font-semibold text-slate-900 dark:text-white">
                {persona.telefono || 'Sin teléfono asignado'}
              </p>
            </div>
          </div>
        </div>

        {/* Message preview */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Mensaje generado con enlace de activación:
          </label>
          <div className="rounded-xl border border-slate-200 bg-slate-950 p-3.5 text-xs text-slate-200 font-mono leading-relaxed relative">
            {inviteResult.textPayload || 'No disponible'}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            id="btn-copy-wa-message"
            type="button"
            onClick={handleCopyLink}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? 'Copiado al portapapeles' : 'Copiar mensaje'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              id="btn-close-wa-modal"
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cerrar
            </button>
            {inviteResult.url && (
              <a
                id="link-open-whatsapp-web"
                href={inviteResult.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Abrir WhatsApp Web</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
