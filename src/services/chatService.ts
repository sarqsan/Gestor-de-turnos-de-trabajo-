import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  orderBy,
  where,
  arrayUnion,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import {
  MensajeChat,
  TipoMensajeChat,
  DestinoAdminMensaje,
  Persona,
  Unidad,
  RolUsuario,
  Empleo,
  TipoUnidad,
} from '../types';
import { registrarAuditLog } from './auditService';
import { crearNotificacion } from './notificacionesService';

const CHAT_COLLECTION = 'mensajes_chat';
export const ADMIN_OFICIAL_ID = 'ADMIN_OFICIAL';

// Generar ID de conversación privada consistente (orden alfabético de IDs)
export const getConversacionPrivadaId = (p1Id: string, p2Id: string): string => {
  return [p1Id, p2Id].sort().join('_');
};

let memoryChatCache: MensajeChat[] = [
  {
    id: 'msg-init-1',
    tipo: 'GRUPO',
    tipoUnidad: 'GUARDIA',
    autorUid: 'admin-1-uid',
    autorNombre: 'Oficina de Cuadrantes (Mando)',
    autorRol: 'ADMIN',
    contenido: 'Canal general operativo abierto. Utilizar para coordinación de relevos, incidencias de material y novedades del servicio de 24h.',
    fechaHora: new Date(Date.now() - 3600000 * 24).toISOString(),
    leidoPor: ['admin-1-uid'],
  },
  {
    id: 'msg-init-2',
    tipo: 'ADMINISTRATIVO',
    tipoUnidad: 'GUARDIA',
    autorUid: 'admin-1-uid',
    autorNombre: 'Mando / Administración',
    autorRol: 'ADMIN',
    destinoAdmin: 'TODOS',
    contenido: 'RECORDATORIO OFICIAL: El horario de las guardias de 24 horas es estrictamente de 08:00 a 08:00. El personal de imaginaria debe permanecer localizable y disponible durante todo el turno.',
    fechaHora: new Date(Date.now() - 3600000 * 12).toISOString(),
    leidoPor: ['admin-1-uid'],
  },
  {
    id: 'msg-init-us-1',
    tipo: 'GRUPO',
    tipoUnidad: 'US',
    autorUid: 'admin-1-uid',
    autorNombre: 'Oficina de Seguridad U.S.',
    autorRol: 'ADMIN',
    contenido: 'Canal operativo de la Unidad de Seguridad (U.S.). Relevos de 12 horas en turnos diurno (08:00-20:00) y nocturno (20:00-08:00).',
    fechaHora: new Date(Date.now() - 3600000 * 10).toISOString(),
    leidoPor: ['admin-1-uid'],
  },
];

/**
 * Envía un mensaje al canal general del grupo
 */
export const enviarMensajeGrupo = async (params: {
  autorUid: string;
  autorNombre: string;
  autorRol: RolUsuario;
  autorPersonaId?: string;
  autorEmpleo?: Empleo;
  contenido: string;
  tipoUnidad?: TipoUnidad;
}): Promise<MensajeChat> => {
  const { autorUid, autorNombre, autorRol, autorPersonaId, autorEmpleo, contenido, tipoUnidad = 'GUARDIA' } = params;
  const msgId = `chat-grp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  const nuevoMensaje: MensajeChat = {
    id: msgId,
    tipo: 'GRUPO',
    tipoUnidad,
    autorUid,
    autorNombre,
    autorRol,
    autorPersonaId,
    autorEmpleo,
    contenido: contenido.trim(),
    fechaHora: new Date().toISOString(),
    leidoPor: [autorUid],
  };

  memoryChatCache.push(nuevoMensaje);

  if (auth.currentUser) {
    try {
      const docRef = doc(db, CHAT_COLLECTION, msgId);
      await setDoc(docRef, nuevoMensaje);
    } catch (err: any) {
      console.warn('Persistencia de mensaje en Firestore diferida:', err.message || err);
    }
  }

  return nuevoMensaje;
};

/**
 * Envía un mensaje privado 1 a 1 entre dos usuarios (Admin-Usuario, Usuario-Admin, Usuario-Usuario)
 */
export const enviarMensajePrivado = async (params: {
  autorUid: string;
  autorNombre: string;
  autorRol: RolUsuario;
  autorPersonaId?: string;
  autorEmpleo?: Empleo;
  destinatarioPersonaId: string;
  destinatarioNombre: string;
  destinatarioUid?: string;
  contenido: string;
  tipoUnidad?: TipoUnidad;
}): Promise<MensajeChat> => {
  const {
    autorUid,
    autorNombre,
    autorRol,
    autorPersonaId,
    autorEmpleo,
    destinatarioPersonaId,
    destinatarioNombre,
    destinatarioUid,
    contenido,
    tipoUnidad = 'GUARDIA',
  } = params;

  const remitenteId = autorPersonaId || ADMIN_OFICIAL_ID;
  const conversacionId = getConversacionPrivadaId(remitenteId, destinatarioPersonaId);
  const msgId = `chat-priv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  const nuevoMensaje: MensajeChat = {
    id: msgId,
    tipo: 'PRIVADO',
    tipoUnidad,
    conversacionId,
    autorUid,
    autorNombre,
    autorRol,
    autorPersonaId: remitenteId,
    autorEmpleo,
    destinatarioPersonaId,
    destinatarioNombre,
    destinatarioUid,
    destinatariosUids: [autorUid, ...(destinatarioUid ? [destinatarioUid] : [])],
    contenido: contenido.trim(),
    fechaHora: new Date().toISOString(),
    leidoPor: [autorUid],
  };

  memoryChatCache.push(nuevoMensaje);

  if (auth.currentUser) {
    try {
      const docRef = doc(db, CHAT_COLLECTION, msgId);
      await setDoc(docRef, nuevoMensaje);
    } catch (err: any) {
      console.warn('Persistencia de mensaje privado en Firestore diferida:', err.message || err);
    }
  }

  // Notificar al destinatario si es una persona física
  if (destinatarioPersonaId !== ADMIN_OFICIAL_ID) {
    await crearNotificacion({
      tipo: 'AVISO_IMPORTANTE',
      tipoUnidad,
      titulo: `Mensaje privado de ${autorNombre}`,
      mensaje: contenido.length > 80 ? `${contenido.substring(0, 80)}...` : contenido,
      destinatarioPersonaId,
      destinatarioUid,
      linkTab: 'chat',
      referenciaId: remitenteId,
    });
  } else {
    // Notificar a administración
    await crearNotificacion({
      tipo: 'AVISO_IMPORTANTE',
      tipoUnidad,
      titulo: `Mensaje directo de ${autorNombre}`,
      mensaje: contenido.length > 80 ? `${contenido.substring(0, 80)}...` : contenido,
      esParaAdmin: true,
      linkTab: 'chat',
      referenciaId: remitenteId,
    });
  }

  return nuevoMensaje;
};

/**
 * Envía un comunicado administrativo / directiva de mando
 */
export const enviarMensajeAdministrativo = async (params: {
  adminUid: string;
  adminNombre: string;
  destino: DestinoAdminMensaje;
  unidadDestino?: Unidad;
  destinatarioPersona?: Persona;
  destinatarioUid?: string;
  contenido: string;
  tipoUnidad?: TipoUnidad;
}): Promise<MensajeChat> => {
  const {
    adminUid,
    adminNombre,
    destino,
    unidadDestino,
    destinatarioPersona,
    destinatarioUid,
    contenido,
    tipoUnidad = 'GUARDIA',
  } = params;

  const msgId = `chat-adm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  const nuevoMensaje: MensajeChat = {
    id: msgId,
    tipo: 'ADMINISTRATIVO',
    tipoUnidad,
    autorUid: adminUid,
    autorNombre: adminNombre,
    autorRol: 'ADMIN',
    destinoAdmin: destino,
    unidadDestino,
    destinatarioPersonaId: destinatarioPersona?.id,
    destinatarioNombre: destinatarioPersona?.nombre,
    destinatarioUid,
    destinatariosUids: destinatarioUid ? [adminUid, destinatarioUid] : undefined,
    contenido: contenido.trim(),
    fechaHora: new Date().toISOString(),
    leidoPor: [adminUid],
  };

  memoryChatCache.push(nuevoMensaje);

  if (auth.currentUser) {
    try {
      const docRef = doc(db, CHAT_COLLECTION, msgId);
      await setDoc(docRef, nuevoMensaje);
    } catch (err: any) {
      console.warn('Persistencia de aviso admin en Firestore diferida:', err.message || err);
    }
  }

  // Registrar auditoría de directiva de mando
  await registrarAuditLog({
    adminUid,
    adminNombre,
    accion: 'ENVIAR_MENSAJE_ADMIN',
    detalles: `Directiva oficial emitida a ${destino}${unidadDestino ? ` (${unidadDestino})` : ''}${destinatarioPersona ? ` (${destinatarioPersona.nombre})` : ''}: "${contenido.substring(0, 100)}..."`,
  });

  // Notificar a los destinatarios
  await crearNotificacion({
    tipo: 'MENSAJE_ADMINISTRATIVO',
    tipoUnidad,
    titulo: `Directiva de Mando (${destino})`,
    mensaje: contenido.length > 90 ? `${contenido.substring(0, 90)}...` : contenido,
    esParaTodos: destino === 'TODOS',
    destinatarioPersonaId: destinatarioPersona?.id,
    destinatarioUid,
    destinatarioEmpleo: destino === 'CABOS' ? 'CABO' : destino === 'SOLDADOS' ? 'SOLDADO' : undefined,
    linkTab: 'chat',
  });

  return nuevoMensaje;
};

/**
 * Obtiene los mensajes del sistema filtrados para un usuario y unidad
 */
export const getMensajes = async (params: {
  personaId?: string | null;
  uid?: string | null;
  isAdmin?: boolean;
  tipo?: TipoMensajeChat;
  conversacionId?: string;
  tipoUnidad?: TipoUnidad;
}): Promise<MensajeChat[]> => {
  const { personaId, uid, isAdmin, tipo, conversacionId, tipoUnidad } = params;

  if (auth.currentUser) {
    try {
      const colRef = collection(db, CHAT_COLLECTION);
      const q = query(colRef, orderBy('fechaHora', 'asc'));
      const snapshot = await getDocs(q);
      const items: MensajeChat[] = [];

      snapshot.forEach((docSnap) => {
        const msg = docSnap.data() as MensajeChat;
        if (tipo && msg.tipo !== tipo) return;
        if (tipoUnidad && msg.tipoUnidad && msg.tipoUnidad !== tipoUnidad) return;
        if (conversacionId && msg.conversacionId !== conversacionId) return;

        // Permisos de lectura
        if (isAdmin) {
          items.push(msg);
        } else if (msg.tipo === 'GRUPO') {
          items.push(msg);
        } else if (msg.tipo === 'ADMINISTRATIVO') {
          items.push(msg);
        } else if (msg.tipo === 'PRIVADO') {
          const pId = personaId || '';
          if (
            msg.autorPersonaId === pId ||
            msg.destinatarioPersonaId === pId ||
            (pId && msg.conversacionId && msg.conversacionId.includes(pId)) ||
            (uid && (msg.autorUid === uid || (msg.destinatariosUids && msg.destinatariosUids.includes(uid))))
          ) {
            items.push(msg);
          }
        }
      });

      if (items.length > 0) {
        memoryChatCache = items;
        return items;
      }
    } catch (err: any) {
      console.warn('Lectura de mensajes de Firestore diferida:', err.message || err);
    }
  }

  return memoryChatCache.filter((msg) => {
    if (tipo && msg.tipo !== tipo) return false;
    if (tipoUnidad && msg.tipoUnidad && msg.tipoUnidad !== tipoUnidad) return false;
    if (conversacionId && msg.conversacionId !== conversacionId) return false;
    if (isAdmin) return true;
    if (msg.tipo === 'GRUPO' || msg.tipo === 'ADMINISTRATIVO') return true;
    if (msg.tipo === 'PRIVADO') {
      const pId = personaId || '';
      return (
        msg.autorPersonaId === pId ||
        msg.destinatarioPersonaId === pId ||
        (pId && msg.conversacionId ? msg.conversacionId.includes(pId) : false) ||
        (uid ? msg.autorUid === uid || (msg.destinatariosUids && msg.destinatariosUids.includes(uid)) : false)
      );
    }
    return false;
  });
};

/**
 * Marca un mensaje como leído por el usuario actual
 */
export const marcarMensajeLeido = async (mensajeId: string, uid: string): Promise<void> => {
  const msg = memoryChatCache.find((m) => m.id === mensajeId);
  if (msg && !msg.leidoPor.includes(uid)) {
    msg.leidoPor.push(uid);
  }

  if (auth.currentUser) {
    try {
      const docRef = doc(db, CHAT_COLLECTION, mensajeId);
      await updateDoc(docRef, {
        leidoPor: arrayUnion(uid),
      });
    } catch (err: any) {
      console.warn('Actualización de lectura de mensaje en Firestore diferida:', err.message || err);
    }
  }
};
