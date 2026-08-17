import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { Cuenta, EstadoAcceso, RolUsuario } from '../types';
import { registrarAuditLog } from './auditService';
import { generateInitialMockCuentas, generateInitialMockPersonas } from './seedService';
import { handleFirestoreError, OperationType } from '../firebase/errors';

const CUENTAS_COLLECTION = 'cuentas';

// In-memory fallback for local dev/testing only
let memoryCuentasCache: Cuenta[] | null = null;

const getSandboxCuentas = (): Cuenta[] => {
  if (!memoryCuentasCache) {
    const personas = generateInitialMockPersonas();
    memoryCuentasCache = generateInitialMockCuentas(personas);
  }
  return memoryCuentasCache;
};

export const getCuentas = async (): Promise<Cuenta[]> => {
  if (auth.currentUser) {
    try {
      const snapshot = await getDocs(collection(db, CUENTAS_COLLECTION));
      if (!snapshot.empty) {
        const cuentas: Cuenta[] = [];
        snapshot.forEach((docSnap) => {
          cuentas.push({ id: docSnap.id, ...(docSnap.data() as Omit<Cuenta, 'id'>) });
        });
        memoryCuentasCache = cuentas;
        return cuentas;
      }
    } catch (error: any) {
      console.warn('Lectura de cuentas Firestore diferida (usando sandbox):', error.message || error);
    }
  }

  return getSandboxCuentas();
};

export const getCuentaByUid = async (uid: string): Promise<Cuenta | null> => {
  if (auth.currentUser) {
    try {
      const docRef = doc(db, CUENTAS_COLLECTION, uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...(docSnap.data() as Omit<Cuenta, 'id'>) };
      }
    } catch (error) {
      console.warn('Error leyendo cuenta de Firestore:', error);
    }
  }

  const local = getSandboxCuentas();
  return local.find((c) => c.uid === uid || c.id === uid) || null;
};

export const getCuentaByPersonaId = async (personaId: string): Promise<Cuenta | null> => {
  if (auth.currentUser) {
    try {
      const q = query(
        collection(db, CUENTAS_COLLECTION),
        where('personaId', '==', personaId)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const first = snapshot.docs[0];
        return { id: first.id, ...(first.data() as Omit<Cuenta, 'id'>) };
      }
    } catch (error) {
      console.warn('Error buscando cuenta por personaId en Firestore:', error);
    }
  }

  const local = getSandboxCuentas();
  return local.find((c) => c.personaId === personaId) || null;
};

export const crearCuenta = async (
  datos: {
    uid: string;
    personaId: string | null;
    email: string;
    nombre: string;
    rol: RolUsuario;
    activo?: boolean;
  },
  adminInfo: { uid: string; nombre: string }
): Promise<Cuenta> => {
  const docRef = doc(db, CUENTAS_COLLECTION, datos.uid);
  const now = new Date().toISOString();

  const nuevaCuenta: Cuenta = {
    id: datos.uid,
    uid: datos.uid,
    personaId: datos.personaId,
    email: datos.email.toLowerCase().trim(),
    nombre: datos.nombre.trim(),
    rol: datos.rol,
    activo: datos.activo !== undefined ? datos.activo : true,
    fechaCreacion: now,
    ultimoAcceso: now,
  };

  const local = getSandboxCuentas();
  const existingIdx = local.findIndex((c) => c.uid === datos.uid);
  if (existingIdx >= 0) {
    local[existingIdx] = nuevaCuenta;
  } else {
    local.push(nuevaCuenta);
  }
  memoryCuentasCache = local;

  if (auth.currentUser) {
    try {
      await setDoc(docRef, nuevaCuenta);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `cuentas/${datos.uid}`);
    }
  }

  await registrarAuditLog({
    adminUid: adminInfo.uid,
    adminNombre: adminInfo.nombre,
    accion: 'CREAR_CUENTA',
    personaId: datos.personaId || undefined,
    personaNombre: datos.nombre,
    detalles: `Creación de cuenta para ${datos.nombre} (${datos.email}) con rol ${datos.rol}`,
  });

  return nuevaCuenta;
};

export const toggleEstadoCuenta = async (
  uid: string,
  nuevoEstado: boolean,
  adminInfo: { uid: string; nombre: string }
): Promise<boolean> => {
  const local = getSandboxCuentas();
  const index = local.findIndex((c) => c.uid === uid || c.id === uid);
  if (index < 0) return false;

  const anterior = local[index];
  local[index] = {
    ...anterior,
    activo: nuevoEstado,
  };
  memoryCuentasCache = local;

  if (auth.currentUser) {
    try {
      const docRef = doc(db, CUENTAS_COLLECTION, uid);
      await updateDoc(docRef, { activo: nuevoEstado });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `cuentas/${uid}`);
    }
  }

  await registrarAuditLog({
    adminUid: adminInfo.uid,
    adminNombre: adminInfo.nombre,
    accion: nuevoEstado ? 'ACTIVAR_CUENTA' : 'DESACTIVAR_CUENTA',
    personaId: anterior.personaId || undefined,
    personaNombre: anterior.nombre,
    detalles: nuevoEstado
      ? `Activación de cuenta para ${anterior.nombre}`
      : `Desactivación de cuenta para ${anterior.nombre}`,
    cambios: [{ campo: 'activo', anterior: anterior.activo, nuevo: nuevoEstado }],
  });

  return true;
};

export const actualizarUltimoAcceso = async (uid: string): Promise<void> => {
  const local = getSandboxCuentas();
  const index = local.findIndex((c) => c.uid === uid || c.id === uid);
  if (index >= 0) {
    local[index].ultimoAcceso = new Date().toISOString();
    memoryCuentasCache = local;
  }

  if (auth.currentUser) {
    try {
      const docRef = doc(db, CUENTAS_COLLECTION, uid);
      await updateDoc(docRef, { ultimoAcceso: new Date().toISOString() });
    } catch (error) {
      // Non-critical background update
    }
  }
};

export const actualizarPersonaCuenta = async (
  uid: string,
  personaId: string | null,
  adminInfo: { uid: string; nombre: string }
): Promise<boolean> => {
  const local = getSandboxCuentas();
  const index = local.findIndex((c) => c.uid === uid || c.id === uid);
  if (index >= 0) {
    local[index] = {
      ...local[index],
      personaId,
    };
    memoryCuentasCache = local;
  }

  if (auth.currentUser) {
    try {
      const docRef = doc(db, CUENTAS_COLLECTION, uid);
      await updateDoc(docRef, { personaId });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `cuentas/${uid}`);
    }
  }

  await registrarAuditLog({
    adminUid: adminInfo.uid,
    adminNombre: adminInfo.nombre,
    accion: 'MODIFICAR_PERSONA',
    personaId: personaId || undefined,
    detalles: `Vinculación de cuenta ${uid} con ficha de persona ${personaId || 'ninguna'}`,
  });

  return true;
};

export const determinarEstadoAcceso = (
  personaId: string,
  cuentas: Cuenta[]
): EstadoAcceso => {
  const cuenta = cuentas.find((c) => c.personaId === personaId);
  if (!cuenta) return 'SIN_CUENTA';
  if (!cuenta.activo) return 'DESACTIVADA';
  return 'ACTIVA';
};
