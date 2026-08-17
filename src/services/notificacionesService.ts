import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  orderBy,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { Notificacion, TipoNotificacion, Empleo, TipoUnidad } from '../types';

const NOTIFICACIONES_COLLECTION = 'notificaciones';
const NOTIFICACIONES_STORAGE_KEY = 'notificaciones_cache_v2';

// Caché en memoria para entorno de desarrollo / fallback sin conexión
let memoryNotificacionesCache: Notificacion[] = [
  {
    id: 'notif-bienvenida',
    tipo: 'AVISO_IMPORTANTE',
    titulo: 'Bienvenido al Sistema Operativo',
    mensaje: 'Cuadrantes de 24h, gestión de imaginarias, cambios y coberturas activos.',
    fechaCreacion: new Date().toISOString(),
    leida: false,
    esParaTodos: true,
    tipoUnidad: 'GUARDIA',
  },
];

const loadNotifStorage = () => {
  try {
    const raw = localStorage.getItem(NOTIFICACIONES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryNotificacionesCache = parsed;
      }
    }
  } catch (e) {
    console.warn('Error cargando notificaciones de localStorage:', e);
  }
};

const saveNotifStorage = () => {
  try {
    localStorage.setItem(NOTIFICACIONES_STORAGE_KEY, JSON.stringify(memoryNotificacionesCache));
  } catch (e) {
    console.warn('Error guardando notificaciones en localStorage:', e);
  }
};

loadNotifStorage();

/**
 * Crea y envía una notificación en el sistema
 */
export const crearNotificacion = async (params: {
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  destinatarioPersonaId?: string;
  destinatarioUid?: string;
  destinatarioEmpleo?: Empleo;
  esParaAdmin?: boolean;
  esParaTodos?: boolean;
  linkTab?: string;
  referenciaId?: string;
  cuadranteId?: string;
  servicioId?: string;
  tipoUnidad?: TipoUnidad;
}): Promise<Notificacion> => {
  const notifId = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const notificacion: Notificacion = {
    id: notifId,
    tipo: params.tipo,
    titulo: params.titulo,
    mensaje: params.mensaje,
    destinatarioPersonaId: params.destinatarioPersonaId,
    destinatarioUid: params.destinatarioUid,
    destinatarioEmpleo: params.destinatarioEmpleo,
    esParaAdmin: params.esParaAdmin || false,
    esParaTodos: params.esParaTodos || false,
    fechaCreacion: new Date().toISOString(),
    leida: false,
    linkTab: params.linkTab,
    referenciaId: params.referenciaId,
    cuadranteId: params.cuadranteId,
    servicioId: params.servicioId,
    tipoUnidad: params.tipoUnidad,
  };

  // Guardar en memoria y persistencia local
  memoryNotificacionesCache.unshift(notificacion);
  saveNotifStorage();

  // Persistir en Firestore si hay conexión
  if (auth.currentUser) {
    try {
      const docRef = doc(db, NOTIFICACIONES_COLLECTION, notifId);
      await setDoc(docRef, notificacion);
    } catch (err: any) {
      console.warn('Persistencia de notificación en Firestore diferida:', err.message || err);
    }
  }

  return notificacion;
};

/**
 * Obtiene las notificaciones que corresponden a un usuario o administrador
 */
export const getNotificaciones = async (
  personaId?: string | null,
  uid?: string | null,
  isAdmin: boolean = false
): Promise<Notificacion[]> => {
  if (auth.currentUser) {
    try {
      const colRef = collection(db, NOTIFICACIONES_COLLECTION);
      const q = query(colRef, orderBy('fechaCreacion', 'desc'));
      const snapshot = await getDocs(q);
      const notifs: Notificacion[] = [];

      snapshot.forEach((docSnap) => {
        const item = docSnap.data() as Notificacion;
        // Filtrar según pertinencia
        if (isAdmin) {
          notifs.push(item);
        } else if (
          item.esParaTodos ||
          (personaId && item.destinatarioPersonaId === personaId) ||
          (uid && item.destinatarioUid === uid)
        ) {
          notifs.push(item);
        }
      });

      if (notifs.length > 0) {
        memoryNotificacionesCache = notifs;
        return notifs;
      }
    } catch (err: any) {
      console.warn('Lectura de notificaciones de Firestore diferida (usando memoria):', err.message || err);
    }
  }

  // Filtrar de memoria
  return memoryNotificacionesCache
    .filter((item) => {
      if (isAdmin) return true;
      if (item.esParaTodos) return true;
      if (personaId && item.destinatarioPersonaId === personaId) return true;
      if (uid && item.destinatarioUid === uid) return true;
      return false;
    })
    .sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime());
};

/**
 * Marca una notificación como leída
 */
export const marcarNotificacionLeida = async (notificacionId: string): Promise<void> => {
  const item = memoryNotificacionesCache.find((n) => n.id === notificacionId);
  if (item) {
    item.leida = true;
    item.fechaLeida = new Date().toISOString();
    saveNotifStorage();
  }

  if (auth.currentUser) {
    try {
      const docRef = doc(db, NOTIFICACIONES_COLLECTION, notificacionId);
      await updateDoc(docRef, {
        leida: true,
        fechaLeida: new Date().toISOString(),
      });
    } catch (err: any) {
      console.warn('Actualización de notificación en Firestore diferida:', err.message || err);
    }
  }
};

/**
 * Marca todas las notificaciones relevantes como leídas
 */
export const marcarTodasNotificacionesLeidas = async (
  personaId?: string | null,
  uid?: string | null,
  isAdmin: boolean = false
): Promise<void> => {
  const items = await getNotificaciones(personaId, uid, isAdmin);
  const now = new Date().toISOString();

  items.forEach((n) => {
    n.leida = true;
    n.fechaLeida = now;
  });

  if (auth.currentUser && items.length > 0) {
    try {
      const batch = writeBatch(db);
      items.slice(0, 400).forEach((n) => {
        const ref = doc(db, NOTIFICACIONES_COLLECTION, n.id);
        batch.update(ref, { leida: true, fechaLeida: now });
      });
      await batch.commit();
    } catch (err: any) {
      console.warn('Batch marcar todas leídas en Firestore diferido:', err.message || err);
    }
  }
};

/**
 * CONFIGURACIÓN Y REGISTRO FCM (FIREBASE CLOUD MESSAGING):
 * Esta función documenta la infraestructura para notificaciones Push web/dispositivo.
 * Para activar FCM en producción:
 * 1. Habilitar Cloud Messaging en Firebase Console.
 * 2. Generar clave par web (VAPID Key).
 * 3. Crear firebase-messaging-sw.js en la raíz de public/.
 * 4. Al solicitar permiso en el navegador con Notification.requestPermission(), llamar a getToken(messaging, { vapidKey }).
 * 5. Guardar el token obtenido en la cuenta del usuario mediante registrarTokenFCM.
 */
export const registrarTokenFCM = async (uid: string, token: string): Promise<boolean> => {
  if (auth.currentUser) {
    try {
      const cuentaRef = doc(db, 'cuentas', uid);
      await updateDoc(cuentaRef, { fcmToken: token, ultimoTokenUpdate: new Date().toISOString() });
      return true;
    } catch (err) {
      console.warn('Error guardando token FCM:', err);
    }
  }
  return false;
};
