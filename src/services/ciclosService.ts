import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { CicloPersonal, Persona, Unidad, Empleo } from '../types';
import { registrarAuditLog } from './auditService';
import { crearNotificacion } from './notificacionesService';

const CICLOS_COLLECTION = 'ciclos';

let memoryCiclosCache: CicloPersonal[] = [
  {
    id: 'ciclo-2026-2027',
    nombre: 'Ciclo Sep 2026 - Feb 2027',
    fechaInicio: '2026-09-01',
    fechaFin: '2027-02-28',
    activo: true,
    descripcion: 'Ciclo operativo principal de 6 meses (01/09/2026 al 28/02/2027).',
  },
];

export interface ProcesarNuevoCicloParams {
  cicloId: string;
  nombreCiclo: string;
  fechaInicio: string;
  fechaFin: string;
  descripcion?: string;
  personalImportado: {
    nombre: string;
    empleo: Empleo;
    unidad: Unidad;
    dni: string;
    telefono?: string;
    ordenRotacion?: number;
    notas?: string;
  }[];
  personasActuales: Persona[];
  adminInfo: { uid: string; nombre: string };
}

export interface ResultadoProcesarNuevoCiclo {
  success: boolean;
  message: string;
  ciclo: CicloPersonal;
  personalTotalActualizado: Persona[];
  resumen: {
    continuidadesDni: number;
    nuevasIncorporaciones: number;
    bajasMarcadasInactivas: number;
    totalCabos: number;
    totalSoldados: number;
  };
}

/**
 * Obtiene todos los ciclos del sistema
 */
export const getCiclos = async (): Promise<CicloPersonal[]> => {
  if (auth.currentUser) {
    try {
      const colRef = collection(db, CICLOS_COLLECTION);
      const snapshot = await getDocs(colRef);
      const items: CicloPersonal[] = [];
      snapshot.forEach((docSnap) => items.push(docSnap.data() as CicloPersonal));
      if (items.length > 0) {
        memoryCiclosCache = items;
        return items;
      }
    } catch (err: any) {
      console.warn('Lectura de ciclos de Firestore diferida:', err.message || err);
    }
  }
  return memoryCiclosCache;
};

/**
 * Procesa la creación de un nuevo ciclo asegurando continuidad por DNI
 */
export const procesarNuevoCiclo = async (
  params: ProcesarNuevoCicloParams
): Promise<ResultadoProcesarNuevoCiclo> => {
  const {
    cicloId,
    nombreCiclo,
    fechaInicio,
    fechaFin,
    descripcion,
    personalImportado,
    personasActuales,
    adminInfo,
  } = params;

  const now = new Date().toISOString();

  // 1. Crear documento de ciclo
  const nuevoCiclo: CicloPersonal = {
    id: cicloId,
    nombre: nombreCiclo,
    fechaInicio,
    fechaFin,
    activo: true,
    descripcion: descripcion || `Ciclo operativo ${fechaInicio} a ${fechaFin}`,
  };

  // 2. Mapear personas existentes por DNI normalizado
  const personasPorDni = new Map<string, Persona>();
  personasActuales.forEach((p) => {
    if (p.dni && p.dni.trim()) {
      personasPorDni.set(p.dni.trim().toUpperCase(), p);
    }
  });

  const dnisEnNuevoCiclo = new Set<string>();
  const nuevoPersonal: Persona[] = [];

  let continuidadesDni = 0;
  let nuevasIncorporaciones = 0;

  // 3. Procesar lista del nuevo ciclo
  personalImportado.forEach((item, index) => {
    const dniNorm = item.dni.trim().toUpperCase();
    dnisEnNuevoCiclo.add(dniNorm);

    if (dniNorm && personasPorDni.has(dniNorm)) {
      // CONTINUIDAD: Conserva personaId histórico
      const existente = personasPorDni.get(dniNorm)!;
      continuidadesDni++;
      nuevoPersonal.push({
        ...existente,
        nombre: item.nombre.trim(),
        empleo: item.empleo,
        unidad: item.unidad,
        telefono: item.telefono || existente.telefono,
        activo: true,
        ordenRotacion: item.ordenRotacion || index + 1,
        cicloId,
        notas: item.notas || existente.notas,
        fechaActualizacion: now,
      });
    } else {
      // NUEVA INCORPORACIÓN: Genera nuevo personaId único
      nuevasIncorporaciones++;
      const nuevoId = `persona-${item.empleo.toLowerCase()}-${Date.now()}-${index + 1}`;
      nuevoPersonal.push({
        id: nuevoId,
        nombre: item.nombre.trim(),
        empleo: item.empleo,
        unidad: item.unidad,
        dni: dniNorm,
        telefono: item.telefono || '',
        activo: true,
        ordenRotacion: item.ordenRotacion || index + 1,
        cicloId,
        notas: item.notas || '',
        fechaCreacion: now,
        fechaActualizacion: now,
      });
    }
  });

  // 4. Procesar personas del ciclo anterior que NO están en el nuevo Excel (marcar inactivo/baja)
  let bajasMarcadasInactivas = 0;
  personasActuales.forEach((p) => {
    const dniNorm = p.dni ? p.dni.trim().toUpperCase() : '';
    if (!dniNorm || !dnisEnNuevoCiclo.has(dniNorm)) {
      // No está en el nuevo ciclo -> Se mantiene en base de datos como inactivo
      bajasMarcadasInactivas++;
      nuevoPersonal.push({
        ...p,
        activo: false,
        fechaActualizacion: now,
      });
    }
  });

  const totalCabos = nuevoPersonal.filter((p) => p.activo && p.empleo === 'CABO').length;
  const totalSoldados = nuevoPersonal.filter((p) => p.activo && p.empleo === 'SOLDADO').length;

  // Actualizar cachés
  memoryCiclosCache.push(nuevoCiclo);
  localStorage.setItem('app_cached_personas', JSON.stringify(nuevoPersonal));

  // Persistir en Firestore
  if (auth.currentUser) {
    try {
      const batch = writeBatch(db);

      // Guardar ciclo
      const cicloRef = doc(db, CICLOS_COLLECTION, cicloId);
      batch.set(cicloRef, nuevoCiclo);

      // Guardar personas
      nuevoPersonal.forEach((p) => {
        const pRef = doc(db, 'personas', p.id);
        batch.set(pRef, p, { merge: true });
      });

      await batch.commit();
    } catch (err: any) {
      console.warn('Persistencia de nuevo ciclo en Firestore diferida:', err.message || err);
    }
  }

  // Registrar en auditoría
  await registrarAuditLog({
    adminUid: adminInfo.uid,
    adminNombre: adminInfo.nombre,
    accion: 'IMPORTAR_NUEVO_CICLO',
    detalles: `Nuevo ciclo "${nombreCiclo}" creado (${fechaInicio} a ${fechaFin}). Continuidades DNI: ${continuidadesDni}, Nuevos: ${nuevasIncorporaciones}, Bajas inactivas: ${bajasMarcadasInactivas}. Efectivos activos: ${totalCabos} Cabos + ${totalSoldados} Soldados.`,
  });

  // Notificación general
  await crearNotificacion({
    tipo: 'AVISO_IMPORTANTE',
    titulo: `Apertura de Nuevo Ciclo: ${nombreCiclo}`,
    mensaje: `Se ha configurado el periodo operativo ${fechaInicio} al ${fechaFin} con ${totalCabos} Cabos y ${totalSoldados} Soldados activos.`,
    esParaTodos: true,
  });

  return {
    success: true,
    message: `Ciclo "${nombreCiclo}" establecido con éxito. (${continuidadesDni} continuidades por DNI, ${nuevasIncorporaciones} nuevas altas, ${bajasMarcadasInactivas} bajas archivadas).`,
    ciclo: nuevoCiclo,
    personalTotalActualizado: nuevoPersonal,
    resumen: {
      continuidadesDni,
      nuevasIncorporaciones,
      bajasMarcadasInactivas,
      totalCabos,
      totalSoldados,
    },
  };
};
