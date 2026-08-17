import {
  collection,
  doc,
  writeBatch,
  getDocs,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { Persona, Cuenta, AuditLog, Unidad } from '../types';
import { registrarAuditLog } from './auditService';

export const ADMIN_1_DATA: Cuenta = {
  id: 'admin-1-uid',
  uid: 'admin-1-uid',
  personaId: null,
  email: 'admin1@grupo.local',
  nombre: 'Administrador 1',
  rol: 'ADMIN',
  activo: true,
  fechaCreacion: '2026-01-01T08:00:00.000Z',
  ultimoAcceso: new Date().toISOString(),
};

export const ADMIN_2_DATA: Cuenta = {
  id: 'admin-2-uid',
  uid: 'admin-2-uid',
  personaId: null,
  email: 'admin2@grupo.local',
  nombre: 'Administrador 2',
  rol: 'ADMIN',
  activo: true,
  fechaCreacion: '2026-01-01T08:00:00.000Z',
  ultimoAcceso: new Date().toISOString(),
};

export const generateInitialMockPersonas = (): Persona[] => {
  const personas: Persona[] = [];
  const now = '2026-01-01T08:00:00.000Z';

  // --- UNIDAD DE GUARDIA (24 Horas) ---
  const unidadesCabo: Unidad[] = [
    'GOE III', 'GOE III', 'GOE III',
    'GOE IV', 'GOE IV', 'GOE IV',
    'BOEL XIX', 'BOEL XIX',
    'GCG', 'GCG',
    'ULOE'
  ];

  const unidadesSoldado: Unidad[] = [
    'GOE III', 'GOE III',
    'GOE IV', 'GOE IV',
    'BOEL XIX', 'BOEL XIX',
    'GCG', 'GCG',
    'ULOE', 'ULOE', 'ULOE'
  ];

  // 11 Cabos Guardia
  for (let i = 1; i <= 11; i++) {
    const pad = i.toString().padStart(2, '0');
    personas.push({
      id: `persona-cabo-${i}`,
      nombre: `Cabo ${i}`,
      empleo: 'CABO',
      unidad: unidadesCabo[i - 1] || 'GOE III',
      tipoUnidad: 'GUARDIA',
      dni: `1000000${pad}A`,
      telefono: `6001112${pad}`,
      activo: true,
      ordenRotacion: i,
      cicloId: 'Ciclo Inicial 2026',
      notas: `Ficha de guardia 24h para Cabo ${i}`,
      fechaCreacion: now,
      fechaActualizacion: now,
    });
  }

  // 11 Soldados Guardia
  for (let i = 1; i <= 11; i++) {
    const pad = i.toString().padStart(2, '0');
    personas.push({
      id: `persona-soldado-${i}`,
      nombre: `Soldado ${i}`,
      empleo: 'SOLDADO',
      unidad: unidadesSoldado[i - 1] || 'GOE IV',
      tipoUnidad: 'GUARDIA',
      dni: `2000000${pad}B`,
      telefono: `6002222${pad}`,
      activo: true,
      ordenRotacion: i,
      cicloId: 'Ciclo Inicial 2026',
      notas: `Ficha de guardia 24h para Soldado ${i}`,
      fechaCreacion: now,
      fechaActualizacion: now,
    });
  }

  // --- U.S. (UNIDAD DE SEGURIDAD - Turnos 12h) ---
  // 4 Cabos US
  for (let i = 1; i <= 4; i++) {
    const pad = i.toString().padStart(2, '0');
    personas.push({
      id: `persona-us-cabo-${i}`,
      nombre: `Cabo U.S. ${i}`,
      empleo: 'CABO',
      unidad: 'US_SEGURIDAD',
      tipoUnidad: 'US',
      dni: `3000000${pad}C`,
      telefono: `6003332${pad}`,
      activo: true,
      ordenRotacion: i,
      cicloId: 'Ciclo U.S. Octubre 2026',
      notas: `Efectivo de la Unidad de Seguridad (Turnos 12h)`,
      fechaCreacion: now,
      fechaActualizacion: now,
    });
  }

  // 8 Soldados US
  for (let i = 1; i <= 8; i++) {
    const pad = i.toString().padStart(2, '0');
    personas.push({
      id: `persona-us-soldado-${i}`,
      nombre: `Soldado U.S. ${i}`,
      empleo: 'SOLDADO',
      unidad: 'US_SEGURIDAD',
      tipoUnidad: 'US',
      dni: `4000000${pad}D`,
      telefono: `6004442${pad}`,
      activo: true,
      ordenRotacion: i,
      cicloId: 'Ciclo U.S. Octubre 2026',
      notas: `Efectivo de la Unidad de Seguridad (Turnos 12h)`,
      fechaCreacion: now,
      fechaActualizacion: now,
    });
  }

  return personas;
};

export const generateInitialMockCuentas = (personas: Persona[]): Cuenta[] => {
  const now = new Date().toISOString();
  const cabo1 = personas.find((p) => p.nombre === 'Cabo 1');
  const cabo2 = personas.find((p) => p.nombre === 'Cabo 2');
  const sold1 = personas.find((p) => p.nombre === 'Soldado 1');
  const caboUS1 = personas.find((p) => p.nombre === 'Cabo U.S. 1');
  const soldUS1 = personas.find((p) => p.nombre === 'Soldado U.S. 1');

  return [
    ADMIN_1_DATA,
    ADMIN_2_DATA,
    {
      id: 'user-cabo-1',
      uid: 'user-cabo-1',
      personaId: cabo1?.id || 'persona-cabo-1',
      email: 'cabo1@guardia.local',
      nombre: 'Cabo 1',
      rol: 'USUARIO',
      tipoUnidad: 'GUARDIA',
      activo: true,
      fechaCreacion: now,
      ultimoAcceso: now,
    },
    {
      id: 'user-soldado-1',
      uid: 'user-soldado-1',
      personaId: sold1?.id || 'persona-soldado-1',
      email: 'soldado1@guardia.local',
      nombre: 'Soldado 1',
      rol: 'USUARIO',
      tipoUnidad: 'GUARDIA',
      activo: true,
      fechaCreacion: now,
      ultimoAcceso: now,
    },
    {
      id: 'user-cabo-2',
      uid: 'user-cabo-2',
      personaId: cabo2?.id || 'persona-cabo-2',
      email: 'cabo2@guardia.local',
      nombre: 'Cabo 2',
      rol: 'USUARIO',
      tipoUnidad: 'GUARDIA',
      activo: false,
      fechaCreacion: now,
      ultimoAcceso: now,
    },
    {
      id: 'user-us-cabo-1',
      uid: 'user-us-cabo-1',
      personaId: caboUS1?.id || 'persona-us-cabo-1',
      email: 'cabo1@seguridad.local',
      nombre: 'Cabo U.S. 1',
      rol: 'USUARIO',
      tipoUnidad: 'US',
      activo: true,
      fechaCreacion: now,
      ultimoAcceso: now,
    },
    {
      id: 'user-us-soldado-1',
      uid: 'user-us-soldado-1',
      personaId: soldUS1?.id || 'persona-us-soldado-1',
      email: 'soldado1@seguridad.local',
      nombre: 'Soldado U.S. 1',
      rol: 'USUARIO',
      tipoUnidad: 'US',
      activo: true,
      fechaCreacion: now,
      ultimoAcceso: now,
    },
  ];
};

export const seedDatabaseInitial = async (
  adminExecutor = { uid: 'sistema-init', nombre: 'Administrador' }
): Promise<{ success: boolean; personasCount: number; cuentasCount: number }> => {
  const personas = generateInitialMockPersonas();
  const cuentas = generateInitialMockCuentas(personas);

  // Always save to local fallback cache first
  localStorage.setItem('app_cached_personas', JSON.stringify(personas));
  localStorage.setItem('app_cached_cuentas', JSON.stringify(cuentas));

  // If authenticated with Firebase, write to Firestore batch
  if (auth.currentUser) {
    try {
      const batch = writeBatch(db);

      personas.forEach((p) => {
        const ref = doc(db, 'personas', p.id);
        batch.set(ref, p);
      });

      cuentas.forEach((c) => {
        const ref = doc(db, 'cuentas', c.uid);
        batch.set(ref, c);
      });

      await batch.commit();

      await registrarAuditLog({
        adminUid: adminExecutor.uid,
        adminNombre: adminExecutor.nombre,
        accion: 'SISTEMA_RESETEO',
        detalles: `Inicialización en Firestore completada: 22 personas creadas (11 Cabos, 11 Soldados) y cuentas iniciales.`,
      });
    } catch (error: any) {
      console.warn('Advertencia en sync Firestore (se mantiene fallback local):', error.message || error);
    }
  }

  return {
    success: true,
    personasCount: personas.length,
    cuentasCount: cuentas.length,
  };
};
