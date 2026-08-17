import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { Persona, Cuenta, StatsPersonal, Empleo, Unidad, TipoUnidad } from '../types';
import { registrarAuditLog } from './auditService';
import { normalizeDni, normalizeEmpleo, normalizeUnidad } from '../utils/validators';
import { generateInitialMockPersonas } from './seedService';
import { handleFirestoreError, OperationType } from '../firebase/errors';

const PERSONAS_COLLECTION = 'personas';

// In-memory fallback for local development/offline sandbox only (never persists real personal data in localStorage)
let memoryPersonasCache: Persona[] | null = null;

const getSandboxPersonas = (): Persona[] => {
  if (!memoryPersonasCache) {
    memoryPersonasCache = generateInitialMockPersonas();
  }
  return memoryPersonasCache;
};

export const sanitizePersonaForUser = (
  persona: Persona,
  currentPersonaId?: string | null,
  isAdmin: boolean = false
): Persona => {
  if (isAdmin || (currentPersonaId && persona.id === currentPersonaId)) {
    return { ...persona };
  }

  // Sanitize strictly: remove PII (DNI, phone, notes) for other users
  return {
    id: persona.id,
    nombre: persona.nombre,
    empleo: persona.empleo,
    unidad: persona.unidad,
    dni: '',
    telefono: '',
    activo: persona.activo,
    cicloId: persona.cicloId,
    notas: '',
    fechaCreacion: persona.fechaCreacion,
    fechaActualizacion: persona.fechaActualizacion,
  };
};

export const getPersonasPublicas = async (
  currentPersonaId?: string | null,
  isAdmin: boolean = false,
  tipoUnidad?: TipoUnidad
): Promise<Persona[]> => {
  const todas = await getPersonas({ activoOnly: true, tipoUnidad });
  return todas.map((p) => sanitizePersonaForUser(p, currentPersonaId, isAdmin));
};

export const getPersonas = async (options?: {
  activoOnly?: boolean;
  cicloId?: string;
  tipoUnidad?: TipoUnidad;
}): Promise<Persona[]> => {
  // If user is authenticated in Firebase, fetch strictly from Firestore
  if (auth.currentUser) {
    try {
      let q = query(collection(db, PERSONAS_COLLECTION), orderBy('fechaCreacion', 'desc'));

      if (options?.activoOnly) {
        q = query(
          collection(db, PERSONAS_COLLECTION),
          where('activo', '==', true),
          orderBy('fechaCreacion', 'desc')
        );
      }

      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const personas: Persona[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Omit<Persona, 'id'>;
          const personaItem: Persona = {
            id: docSnap.id,
            ...data,
            unidad: data.unidad || 'GOE III',
            tipoUnidad: data.tipoUnidad || (data.unidad === 'US_SEGURIDAD' ? 'US' : 'GUARDIA'),
          };
          if (options?.tipoUnidad && personaItem.tipoUnidad !== options.tipoUnidad) {
            return;
          }
          personas.push(personaItem);
        });
        memoryPersonasCache = personas;

        if (options?.cicloId) {
          return personas.filter((p) => p.cicloId === options.cicloId);
        }
        return personas;
      }
    } catch (error: any) {
      console.warn('Lectura Firestore en modo sandbox o sin conexión:', error.message || error);
    }
  }

  // Sandbox fallback for local dev
  let personas = getSandboxPersonas();
  if (options?.tipoUnidad) {
    personas = personas.filter((p) => (p.tipoUnidad || (p.unidad === 'US_SEGURIDAD' ? 'US' : 'GUARDIA')) === options.tipoUnidad);
  }
  if (options?.activoOnly) {
    personas = personas.filter((p) => p.activo);
  }
  if (options?.cicloId) {
    personas = personas.filter((p) => p.cicloId === options.cicloId);
  }
  return personas;
};

export const getPersonaById = async (id: string): Promise<Persona | null> => {
  if (auth.currentUser) {
    try {
      const docRef = doc(db, PERSONAS_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as Omit<Persona, 'id'>;
        return {
          id: docSnap.id,
          ...data,
          unidad: data.unidad || 'GOE III',
        };
      }
    } catch (error) {
      console.warn('Error leyendo persona de Firestore:', error);
    }
  }

  const local = getSandboxPersonas();
  return local.find((p) => p.id === id) || null;
};

export const crearPersona = async (
  datos: {
    nombre: string;
    empleo: Empleo;
    unidad: Unidad;
    dni?: string;
    telefono?: string;
    activo?: boolean;
    cicloId?: string;
    notas?: string;
  },
  adminInfo: { uid: string; nombre: string }
): Promise<Persona> => {
  const personaRef = doc(collection(db, PERSONAS_COLLECTION));
  const now = new Date().toISOString();

  const nuevaPersona: Persona = {
    id: personaRef.id,
    nombre: datos.nombre.trim(),
    empleo: datos.empleo,
    unidad: datos.unidad || 'GOE III',
    dni: normalizeDni(datos.dni),
    telefono: (datos.telefono || '').trim(),
    activo: datos.activo !== undefined ? datos.activo : true,
    cicloId: datos.cicloId || 'Ciclo Actual 2026',
    notas: datos.notas || '',
    fechaCreacion: now,
    fechaActualizacion: now,
  };

  // If authenticated with Firebase, write to Firestore
  if (auth.currentUser) {
    try {
      await setDoc(personaRef, nuevaPersona);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `personas/${nuevaPersona.id}`);
    }
  }

  // Update memory cache
  const local = getSandboxPersonas();
  local.unshift(nuevaPersona);
  memoryPersonasCache = local;

  await registrarAuditLog({
    adminUid: adminInfo.uid,
    adminNombre: adminInfo.nombre,
    accion: 'CREAR_PERSONA',
    personaId: nuevaPersona.id,
    personaNombre: nuevaPersona.nombre,
    detalles: `Alta manual de persona: ${nuevaPersona.nombre} (${nuevaPersona.empleo} - ${nuevaPersona.unidad})`,
  });

  return nuevaPersona;
};

export const actualizarPersona = async (
  id: string,
  datos: Partial<Omit<Persona, 'id' | 'fechaCreacion'>>,
  adminInfo: { uid: string; nombre: string }
): Promise<Persona | null> => {
  const local = getSandboxPersonas();
  const index = local.findIndex((p) => p.id === id);
  const anterior = index >= 0 ? local[index] : null;

  const now = new Date().toISOString();
  const updates: any = {
    ...datos,
    fechaActualizacion: now,
  };
  if (datos.dni !== undefined) updates.dni = normalizeDni(datos.dni);
  if (datos.nombre !== undefined) updates.nombre = datos.nombre.trim();

  const personaActualizada: Persona = {
    ...(anterior || ({} as Persona)),
    ...updates,
    id,
  };

  // If authenticated with Firebase, update Firestore
  if (auth.currentUser) {
    try {
      const docRef = doc(db, PERSONAS_COLLECTION, id);
      await updateDoc(docRef, updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `personas/${id}`);
    }
  }

  if (index >= 0) {
    local[index] = personaActualizada;
    memoryPersonasCache = local;
  }

  const cambios: { campo: string; anterior: any; nuevo: any }[] = [];
  if (anterior) {
    Object.keys(datos).forEach((key) => {
      const k = key as keyof typeof datos;
      if ((anterior as any)[k] !== (datos as any)[k]) {
        cambios.push({
          campo: key,
          anterior: (anterior as any)[k],
          nuevo: (datos as any)[k],
        });
      }
    });
  }

  await registrarAuditLog({
    adminUid: adminInfo.uid,
    adminNombre: adminInfo.nombre,
    accion: 'MODIFICAR_PERSONA',
    personaId: id,
    personaNombre: personaActualizada.nombre || 'Persona',
    detalles: `Modificación de datos de ficha para ${personaActualizada.nombre}`,
    cambios,
  });

  return personaActualizada;
};

export const toggleEstadoPersona = async (
  id: string,
  nuevoEstado: boolean,
  adminInfo: { uid: string; nombre: string },
  motivo?: string
): Promise<boolean> => {
  const local = getSandboxPersonas();
  const index = local.findIndex((p) => p.id === id);
  if (index < 0) return false;

  const anterior = local[index];
  const now = new Date().toISOString();
  local[index] = {
    ...anterior,
    activo: nuevoEstado,
    fechaActualizacion: now,
  };
  memoryPersonasCache = local;

  if (auth.currentUser) {
    try {
      const docRef = doc(db, PERSONAS_COLLECTION, id);
      await updateDoc(docRef, {
        activo: nuevoEstado,
        fechaActualizacion: now,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `personas/${id}`);
    }
  }

  await registrarAuditLog({
    adminUid: adminInfo.uid,
    adminNombre: adminInfo.nombre,
    accion: nuevoEstado ? 'ACTIVAR_PERSONA' : 'DESACTIVAR_PERSONA',
    personaId: id,
    personaNombre: anterior.nombre,
    detalles: nuevoEstado
      ? `Persona ${anterior.nombre} reactivada como activa en el grupo`
      : `Persona ${anterior.nombre} marcada como inactiva (conservada en histórico)${
          motivo ? ` - Motivo: ${motivo}` : ''
        }`,
    cambios: [{ campo: 'activo', anterior: anterior.activo, nuevo: nuevoEstado }],
  });

  return true;
};

export const calcularStats = (personas: Persona[], cuentas: Cuenta[]): StatsPersonal => {
  const totalPersonal = personas.length;
  const personasActivas = personas.filter((p) => p.activo);
  const personalActivo = personasActivas.length;
  const personalInactivo = totalPersonal - personalActivo;

  // Calculado dinámicamente a partir de personas activas
  const cabosActivos = personasActivas.filter((p) => p.empleo === 'CABO').length;
  const soldadosActivos = personasActivas.filter((p) => p.empleo === 'SOLDADO').length;

  const cuentasActivas = cuentas.filter((c) => c.activo).length;
  const cuentasDesactivadas = cuentas.filter((c) => !c.activo).length;
  const totalCuentas = cuentas.length;

  // Personas activas que aún no tienen cuenta activa
  const personasConCuenta = new Set(
    cuentas.filter((c) => c.personaId && c.activo).map((c) => c.personaId)
  );
  const cuentasPendientes = personasActivas.filter((p) => !personasConCuenta.has(p.id)).length;

  return {
    totalPersonal,
    personalActivo,
    personalInactivo,
    cabosActivos,
    soldadosActivos,
    cuentasActivas,
    cuentasPendientes,
    cuentasDesactivadas,
    totalCuentas,
  };
};
