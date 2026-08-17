import { Persona, Cuenta } from '../types';

export interface WhatsAppInviteResult {
  success: boolean;
  message: string;
  url?: string;
  textPayload?: string;
  isConfigured: boolean;
}

/**
 * Servicio independiente de WhatsApp para envío de accesos
 * FASE 1: Estructura preparada sin credenciales ni contraseñas.
 * Los usuarios recibirán un enlace seguro de activación para establecer su contraseña en Firebase Auth.
 */
export const generarEnlaceActivacionWhatsApp = (
  persona: Persona,
  cuenta?: Cuenta | null
): WhatsAppInviteResult => {
  // En Fase 1 no hay pasarela de mensajería API configurada
  const isConfigured = false;

  // Limpiar y normalizar teléfono (ej: +34 o 9 dígitos españoles)
  const rawPhone = persona.telefono.replace(/[^0-9+]/g, '');
  
  if (!rawPhone) {
    return {
      success: false,
      message: 'La persona no tiene un número de teléfono registrado.',
      isConfigured,
    };
  }

  // Token simulado o de activación única
  const activationToken = btoa(`token-${persona.id}-${Date.now()}`);
  const activationUrl = `${window.location.origin}/activar-cuenta?token=${activationToken}&p=${persona.id}`;

  const messageBody = `Hola ${persona.nombre}, has sido dado de alta en el sistema de gestión del grupo (${persona.empleo}). Por favor, accede al siguiente enlace seguro para activar tu cuenta y establecer tu contraseña: ${activationUrl}`;

  const encodedMessage = encodeURIComponent(messageBody);
  const waUrl = `https://wa.me/${rawPhone.startsWith('+') ? rawPhone.substring(1) : rawPhone}?text=${encodedMessage}`;

  return {
    success: true,
    message: 'Función de envío directo pendiente de configuración de pasarela SMS/WhatsApp API. Enlace generado para previsualización.',
    url: waUrl,
    textPayload: messageBody,
    isConfigured,
  };
};
