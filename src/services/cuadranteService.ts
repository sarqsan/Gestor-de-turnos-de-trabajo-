import {
  collection,
  doc,
  getDocs,
  getDoc,
  writeBatch,
  updateDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import {
  CuadranteMaestro,
  ServicioDia,
  CuadranteSimulacionResult,
  Persona,
  SlotServicioTipo,
  TipoUnidad,
} from '../types';
import { registrarAuditLog } from './auditService';
import { validarCuadrante } from './cuadranteValidatorService';
import { calcularMetricasCuadrante } from './cuadranteMetricsService';
import { generarSimulacionCuadrante } from './cuadranteGeneratorService';
import { generarSimulacionCuadranteUS } from './cuadranteUSGeneratorService';
import { generateInitialMockPersonas } from './seedService';

const CUADRANTES_COLLECTION = 'cuadrantes';
const CUADRANTES_STORAGE_KEY = 'cuadrantes_maestros_cache_v2';
const SERVICIOS_STORAGE_KEY = 'cuadrantes_servicios_cache_v2';

// Caché en memoria para modo Sandbox / offline
let memoryCuadrantesCache: CuadranteMaestro[] = [];
let memoryServiciosCache: Map<string, ServicioDia[]> = new Map();

const loadLocalCache = () => {
  try {
    const rawC = localStorage.getItem(CUADRANTES_STORAGE_KEY);
    if (rawC) {
      memoryCuadrantesCache = JSON.parse(rawC);
    }
    const rawS = localStorage.getItem(SERVICIOS_STORAGE_KEY);
    if (rawS) {
      const parsed = JSON.parse(rawS);
      memoryServiciosCache = new Map(Object.entries(parsed));
    }
  } catch (e) {
    console.warn('Error loading cuadrantes from localStorage:', e);
  }
};

const saveLocalCache = () => {
  try {
    localStorage.setItem(CUADRANTES_STORAGE_KEY, JSON.stringify(memoryCuadrantesCache));
    const obj: Record<string, ServicioDia[]> = {};
    memoryServiciosCache.forEach((val, key) => {
      obj[key] = val;
    });
    localStorage.setItem(SERVICIOS_STORAGE_KEY, JSON.stringify(obj));
  } catch (e) {
    console.warn('Error saving cuadrantes to localStorage:', e);
  }
};

loadLocalCache();

// Auto-inicializar cuadrantes por defecto si la caché está vacía
const ensureDefaultCuadrante = () => {
  if (memoryCuadrantesCache.length === 0) {
    const personas = generateInitialMockPersonas();
    
    // 1. Cuadrante Unidad de Guardia (24h)
    const personasGuardia = personas.filter((p) => p.tipoUnidad !== 'US' && p.unidad !== 'US_SEGURIDAD');
    const simGuardia = generarSimulacionCuadrante({
      nombre: 'Cuadrante Guardias Sep 2026 - Feb 2027',
      cicloId: 'ciclo-2026-2027',
      fechaInicio: '2026-09-01',
      fechaFin: '2027-02-28',
      personasActivas: personasGuardia,
      creadoPorUid: 'admin-1-uid',
      creadoPorNombre: 'Administrador 1',
    });

    const cuadranteGuardia: CuadranteMaestro = {
      ...simGuardia.cuadrante,
      tipoUnidad: 'GUARDIA',
      unidadId: 'GUARDIA',
      estado: 'CONFIRMADO',
    };

    // 2. Cuadrante Unidad de Seguridad U.S. (12h)
    const personasUS = personas.filter((p) => p.tipoUnidad === 'US' || p.unidad === 'US_SEGURIDAD');
    let cuadranteUS: CuadranteMaestro | null = null;
    let serviciosUS: ServicioDia[] = [];

    if (personasUS.length >= 4) {
      const simUS = generarSimulacionCuadranteUS({
        nombre: 'Cuadrante U.S. Octubre 2026 - Marzo 2027',
        cicloId: 'ciclo-us-2026-2027',
        fechaInicio: '2026-10-01',
        fechaFin: '2027-03-31',
        personasActivas: personasUS,
        creadoPorUid: 'admin-1-uid',
        creadoPorNombre: 'Administración U.S.',
      });
      cuadranteUS = simUS.cuadrante;
      serviciosUS = simUS.servicios;
    }

    memoryCuadrantesCache = cuadranteUS ? [cuadranteGuardia, cuadranteUS] : [cuadranteGuardia];
    memoryServiciosCache.set(cuadranteGuardia.id, simGuardia.servicios);
    if (cuadranteUS) {
      memoryServiciosCache.set(cuadranteUS.id, serviciosUS);
    }
    saveLocalCache();
  }
};

ensureDefaultCuadrante();

/**
 * Obtiene la lista de todos los cuadrantes (opcionalmente filtrados por unidad)
 */
export const getCuadrantes = async (options?: { tipoUnidad?: TipoUnidad }): Promise<CuadranteMaestro[]> => {
  if (auth.currentUser) {
    try {
      const q = query(
        collection(db, CUADRANTES_COLLECTION),
        orderBy('fechaCreacion', 'desc')
      );
      const snapshot = await getDocs(q);
      const cuadrantes: CuadranteMaestro[] = [];
      snapshot.forEach((docSnap) => {
        const item = docSnap.data() as CuadranteMaestro;
        if (options?.tipoUnidad && item.tipoUnidad && item.tipoUnidad !== options.tipoUnidad) {
          return;
        }
        cuadrantes.push(item);
      });
      if (cuadrantes.length > 0) {
        memoryCuadrantesCache = cuadrantes;
        return cuadrantes;
      }
    } catch (err: any) {
      console.warn('Lectura Firestore de cuadrantes diferida (usando memoria):', err.message || err);
    }
  }

  ensureDefaultCuadrante();

  return [...memoryCuadrantesCache]
    .filter((c) => !options?.tipoUnidad || (c.tipoUnidad || 'GUARDIA') === options.tipoUnidad)
    .sort(
      (a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime()
    );
};

/**
 * Obtiene un cuadrante por ID
 */
export const getCuadranteById = async (
  cuadranteId: string
): Promise<CuadranteMaestro | null> => {
  if (auth.currentUser) {
    try {
      const docRef = doc(db, CUADRANTES_COLLECTION, cuadranteId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as CuadranteMaestro;
      }
    } catch (err: any) {
      console.warn('Lectura de cuadrante individual diferida:', err.message || err);
    }
  }

  return memoryCuadrantesCache.find((c) => c.id === cuadranteId) || null;
};

/**
 * Obtiene todos los servicios (días) pertenecientes a un cuadrante
 */
export const getServiciosByCuadranteId = async (
  cuadranteId: string
): Promise<ServicioDia[]> => {
  if (auth.currentUser) {
    try {
      const srvCol = collection(db, CUADRANTES_COLLECTION, cuadranteId, 'servicios');
      const q = query(srvCol, orderBy('fecha', 'asc'));
      const snapshot = await getDocs(q);
      const servicios: ServicioDia[] = [];
      snapshot.forEach((docSnap) => {
        servicios.push(docSnap.data() as ServicioDia);
      });
      memoryServiciosCache.set(cuadranteId, servicios);
      return servicios;
    } catch (err: any) {
      console.warn('Lectura de servicios de cuadrante diferida (usando memoria):', err.message || err);
    }
  }

  return memoryServiciosCache.get(cuadranteId) || [];
};

/**
 * Guarda y confirma un cuadrante previamente simulado en Firestore.
 * Transiciona el estado a 'CONFIRMAR_CUADRANTE' y crea todos los servicios con batch write.
 */
export const confirmarCuadrante = async (
  simulacion: CuadranteSimulacionResult,
  adminInfo: { uid: string; nombre: string }
): Promise<{ success: boolean; cuadranteId?: string; message: string }> => {
  // Validación previa de seguridad
  if (!simulacion.validacion.valido) {
    return {
      success: false,
      message: `No se puede confirmar el cuadrante porque contiene ${simulacion.validacion.totalErrores} errores de restricciones duras.`,
    };
  }

  const cuadranteConfirmado: CuadranteMaestro = {
    ...simulacion.cuadrante,
    estado: 'CONFIRMADO',
    fechaCreacion: new Date().toISOString(),
    creadoPorUid: adminInfo.uid,
    creadoPorNombre: adminInfo.nombre,
  };

  const cuadranteId = cuadranteConfirmado.id;
  const servicios = simulacion.servicios;

  // Actualizar caché en memoria
  const idx = memoryCuadrantesCache.findIndex((c) => c.id === cuadranteId);
  if (idx >= 0) {
    memoryCuadrantesCache[idx] = cuadranteConfirmado;
  } else {
    memoryCuadrantesCache.unshift(cuadranteConfirmado);
  }
  memoryServiciosCache.set(cuadranteId, [...servicios]);

  // Persistir en Firestore si hay sesión activa
  if (auth.currentUser) {
    try {
      // 1. Guardar documento maestro
      const batch = writeBatch(db);
      const docRef = doc(db, CUADRANTES_COLLECTION, cuadranteId);
      batch.set(docRef, cuadranteConfirmado);

      // 2. Guardar cada servicio en la subcolección /servicios (en chunks de 400 docs para límites de batch)
      const chunkSize = 400;
      for (let i = 0; i < servicios.length; i += chunkSize) {
        const chunkBatch = i === 0 ? batch : writeBatch(db);
        const slice = servicios.slice(i, i + chunkSize);

        slice.forEach((srv) => {
          const srvRef = doc(
            db,
            CUADRANTES_COLLECTION,
            cuadranteId,
            'servicios',
            srv.id
          );
          chunkBatch.set(srvRef, srv);
        });

        await chunkBatch.commit();
      }
    } catch (err: any) {
      console.warn('Escritura Firestore diferida (guardado en memoria):', err.message || err);
    }
  }

  // Registrar auditoría inmutable
  await registrarAuditLog({
    adminUid: adminInfo.uid,
    adminNombre: adminInfo.nombre,
    accion: 'CONFIRMAR_CUADRANTE',
    cuadranteId,
    detalles: `Cuadrante "${cuadranteConfirmado.nombre}" confirmado y publicado para el periodo ${cuadranteConfirmado.fechaInicio} a ${cuadranteConfirmado.fechaFin} (${cuadranteConfirmado.totalDias} días, score de equilibrio: ${cuadranteConfirmado.metricasEquilibrio.scoreEquilibrio}/100).`,
  });

  return {
    success: true,
    cuadranteId,
    message: `Cuadrante "${cuadranteConfirmado.nombre}" confirmado exitosamente con ${servicios.length} días de servicio.`,
  };
};

/**
 * Modifica manualmente la asignación de un titular o imaginaria en un día concreto.
 * Conserva personaIdOriginal y actualiza personaIdReal.
 * Valida que la modificación no rompa restricciones duras.
 */
export const modificarServicioManual = async (params: {
  cuadranteId: string;
  servicioId: string;
  slotTipo: SlotServicioTipo;
  nuevaPersonaId: string;
  motivo: string;
  personas: Persona[];
  adminInfo: { uid: string; nombre: string };
}): Promise<{ success: boolean; message: string; servicioActualizado?: ServicioDia }> => {
  const {
    cuadranteId,
    servicioId,
    slotTipo,
    nuevaPersonaId,
    motivo,
    personas,
    adminInfo,
  } = params;

  // 1. Obtener los servicios del cuadrante
  const servicios = await getServiciosByCuadranteId(cuadranteId);
  const srvIndex = servicios.findIndex((s) => s.id === servicioId);
  if (srvIndex === -1) {
    return { success: false, message: `No se encontró el servicio con ID "${servicioId}".` };
  }

  const srvActual = { ...servicios[srvIndex] };
  const nuevaPersona = personas.find((p) => p.id === nuevaPersonaId);
  if (!nuevaPersona) {
    return { success: false, message: 'La persona seleccionada no existe en el sistema.' };
  }

  let personaIdAnterior = '';
  let puestoNombre = '';

  // Clonar y actualizar el slot específico
  if (slotTipo === 'cabo_1') {
    puestoNombre = 'Cabo Titular 1';
    personaIdAnterior = srvActual.titulares.cabos[0].personaIdReal;
    srvActual.titulares.cabos[0] = {
      ...srvActual.titulares.cabos[0],
      personaIdReal: nuevaPersonaId,
      tipoOrigen: 'MODIFICADO_MANUAL',
      motivoCambio: motivo,
      modificadoPorUid: adminInfo.uid,
      fechaModificacion: new Date().toISOString(),
    };
  } else if (slotTipo === 'cabo_2') {
    puestoNombre = 'Cabo Titular 2';
    personaIdAnterior = srvActual.titulares.cabos[1].personaIdReal;
    srvActual.titulares.cabos[1] = {
      ...srvActual.titulares.cabos[1],
      personaIdReal: nuevaPersonaId,
      tipoOrigen: 'MODIFICADO_MANUAL',
      motivoCambio: motivo,
      modificadoPorUid: adminInfo.uid,
      fechaModificacion: new Date().toISOString(),
    };
  } else if (slotTipo === 'soldado_1') {
    puestoNombre = 'Soldado Titular 1';
    personaIdAnterior = srvActual.titulares.soldados[0].personaIdReal;
    srvActual.titulares.soldados[0] = {
      ...srvActual.titulares.soldados[0],
      personaIdReal: nuevaPersonaId,
      tipoOrigen: 'MODIFICADO_MANUAL',
      motivoCambio: motivo,
      modificadoPorUid: adminInfo.uid,
      fechaModificacion: new Date().toISOString(),
    };
  } else if (slotTipo === 'soldado_2') {
    puestoNombre = 'Soldado Titular 2';
    personaIdAnterior = srvActual.titulares.soldados[1].personaIdReal;
    srvActual.titulares.soldados[1] = {
      ...srvActual.titulares.soldados[1],
      personaIdReal: nuevaPersonaId,
      tipoOrigen: 'MODIFICADO_MANUAL',
      motivoCambio: motivo,
      modificadoPorUid: adminInfo.uid,
      fechaModificacion: new Date().toISOString(),
    };
  } else if (slotTipo === 'cabo_imag' || slotTipo === 'imaginaria_cabo') {
    puestoNombre = 'Cabo Imaginaria';
    personaIdAnterior = srvActual.imaginarias.cabo?.personaIdReal || '';
    srvActual.imaginarias.cabo = {
      ...srvActual.imaginarias.cabo,
      personaIdOriginal: srvActual.imaginarias.cabo?.personaIdOriginal || nuevaPersonaId,
      personaIdReal: nuevaPersonaId,
      tipoOrigen: 'MODIFICADO_MANUAL',
      motivoCambio: motivo,
      modificadoPorUid: adminInfo.uid,
      fechaModificacion: new Date().toISOString(),
    };
  } else if (slotTipo === 'soldado_imag' || slotTipo === 'imaginaria_soldado') {
    puestoNombre = 'Soldado Imaginaria';
    personaIdAnterior = srvActual.imaginarias.soldado?.personaIdReal || '';
    srvActual.imaginarias.soldado = {
      ...srvActual.imaginarias.soldado,
      personaIdOriginal: srvActual.imaginarias.soldado?.personaIdOriginal || nuevaPersonaId,
      personaIdReal: nuevaPersonaId,
      tipoOrigen: 'MODIFICADO_MANUAL',
      motivoCambio: motivo,
      modificadoPorUid: adminInfo.uid,
      fechaModificacion: new Date().toISOString(),
    };
  }

  srvActual.tieneModificacionesManuales = true;
  srvActual.ultimaActualizacion = new Date().toISOString();

  // 2. Simular el cuadrante modificado y validar restricciones duras
  const copiaServicios = [...servicios];
  copiaServicios[srvIndex] = srvActual;

  const validacion = validarCuadrante(copiaServicios, personas);
  if (!validacion.valido) {
    const erroresDesc = validacion.items
      .filter((i) => i.severidad === 'ERROR')
      .map((i) => `• ${i.descripcion} (${i.detalleConflicto || ''})`)
      .join('\n');

    return {
      success: false,
      message: `El cambio solicitado genera violaciones de restricciones obligatorias:\n${erroresDesc}`,
    };
  }

  // 3. Recalcular métricas
  const nuevasMetricas = calcularMetricasCuadrante(copiaServicios, personas);

  // 4. Persistir actualización
  servicios[srvIndex] = srvActual;
  memoryServiciosCache.set(cuadranteId, servicios);

  const cuadrante = memoryCuadrantesCache.find((c) => c.id === cuadranteId);
  if (cuadrante) {
    cuadrante.metricasEquilibrio = nuevasMetricas;
    cuadrante.fechaModificacion = new Date().toISOString();
    cuadrante.modificadoPorUid = adminInfo.uid;
  }
  saveLocalCache();

  if (auth.currentUser) {
    try {
      const srvRef = doc(
        db,
        CUADRANTES_COLLECTION,
        cuadranteId,
        'servicios',
        servicioId
      );
      await updateDoc(srvRef, { ...srvActual });

      const cuadranteRef = doc(db, CUADRANTES_COLLECTION, cuadranteId);
      await updateDoc(cuadranteRef, {
        metricasEquilibrio: nuevasMetricas,
        fechaModificacion: new Date().toISOString(),
        modificadoPorUid: adminInfo.uid,
      });
    } catch (err: any) {
      console.warn('Actualización Firestore diferida (usando memoria):', err.message || err);
    }
  }

  const personaAnteriorObj = personas.find((p) => p.id === personaIdAnterior);

  // 5. Registrar en AuditLogs
  await registrarAuditLog({
    adminUid: adminInfo.uid,
    adminNombre: adminInfo.nombre,
    accion: 'MODIFICAR_SERVICIO_MANUAL',
    cuadranteId,
    fechaAfectada: srvActual.fecha,
    personaIdOriginal: personaIdAnterior,
    personaIdReal: nuevaPersonaId,
    personaNombre: nuevaPersona.nombre,
    motivo,
    detalles: `Modificación manual en fecha ${srvActual.fecha}, puesto "${puestoNombre}". Titular sustituido: ${personaAnteriorObj?.nombre || personaIdAnterior} -> ${nuevaPersona.nombre}. Motivo: ${motivo}.`,
    cambios: [
      {
        campo: `${slotTipo}.personaIdReal`,
        anterior: personaIdAnterior,
        nuevo: nuevaPersonaId,
      },
    ],
  });

  return {
    success: true,
    message: `Puesto "${puestoNombre}" actualizado con éxito para el día ${srvActual.fecha}.`,
    servicioActualizado: srvActual,
  };
};

/**
 * Aplica atómicamente un cambio de servicio (permuta o cesión autorizada) al cuadrante.
 * Actualiza el servicio principal y, si existe servicio de devolución acordado, también este último.
 */
export const aplicarCambioServiciosAutorizado = async (params: {
  cuadranteId: string;
  solicitud: any;
  codigoVerificacion: string;
  personas: Persona[];
  adminInfo: { uid: string; nombre: string };
}): Promise<{ success: boolean; message: string }> => {
  const { cuadranteId, solicitud, codigoVerificacion, personas, adminInfo } = params;

  let servicios = memoryServiciosCache.get(cuadranteId);
  if (!servicios || servicios.length === 0) {
    servicios = await getServiciosByCuadranteId(cuadranteId);
  }

  if (!servicios || servicios.length === 0) {
    return { success: false, message: 'No se encontraron los servicios del cuadrante.' };
  }

  const copiaServicios: ServicioDia[] = JSON.parse(JSON.stringify(servicios));

  // 1. Aplicar cambio en el servicio principal
  const srvIndex = copiaServicios.findIndex((s) => s.id === solicitud.servicioId || s.fecha === solicitud.fechaServicio);
  if (srvIndex === -1) {
    return { success: false, message: `No se localizó el servicio de fecha ${solicitud.fechaServicio}.` };
  }

  const srvActual = { ...copiaServicios[srvIndex] };
  const slotTipo: SlotServicioTipo = solicitud.slotTipo || (solicitud.puesto === 'CABO' ? 'cabo_1' : 'soldado_1');
  const motivoPrincipal = `PERMUTA AUTORIZADA (${codigoVerificacion}): ${solicitud.solicitanteNombre} cede a ${solicitud.destinatarioNombre}. Motivo: ${solicitud.motivo || 'Acuerdo mutuo'}`;

  // Actualizar slot principal
  if (slotTipo === 'cabo_1' && srvActual.titulares.cabos[0]) {
    srvActual.titulares.cabos[0] = {
      ...srvActual.titulares.cabos[0],
      personaIdReal: solicitud.destinatarioPersonaId,
      tipoOrigen: 'MODIFICADO_MANUAL',
      motivoCambio: motivoPrincipal,
    };
  } else if (slotTipo === 'cabo_2' && srvActual.titulares.cabos[1]) {
    srvActual.titulares.cabos[1] = {
      ...srvActual.titulares.cabos[1],
      personaIdReal: solicitud.destinatarioPersonaId,
      tipoOrigen: 'MODIFICADO_MANUAL',
      motivoCambio: motivoPrincipal,
    };
  } else if (slotTipo === 'soldado_1' && srvActual.titulares.soldados[0]) {
    srvActual.titulares.soldados[0] = {
      ...srvActual.titulares.soldados[0],
      personaIdReal: solicitud.destinatarioPersonaId,
      tipoOrigen: 'MODIFICADO_MANUAL',
      motivoCambio: motivoPrincipal,
    };
  } else if (slotTipo === 'soldado_2' && srvActual.titulares.soldados[1]) {
    srvActual.titulares.soldados[1] = {
      ...srvActual.titulares.soldados[1],
      personaIdReal: solicitud.destinatarioPersonaId,
      tipoOrigen: 'MODIFICADO_MANUAL',
      motivoCambio: motivoPrincipal,
    };
  } else if (slotTipo === 'imaginaria_cabo') {
    srvActual.imaginarias.cabo = {
      ...srvActual.imaginarias.cabo,
      personaIdReal: solicitud.destinatarioPersonaId,
    };
  } else if (slotTipo === 'imaginaria_soldado') {
    srvActual.imaginarias.soldado = {
      ...srvActual.imaginarias.soldado,
      personaIdReal: solicitud.destinatarioPersonaId,
    };
  }
  copiaServicios[srvIndex] = srvActual;

  // 2. Si hay servicio de devolución pactado, aplicar la contraprestación
  let srvDevIndex = -1;
  let srvDevActual: ServicioDia | null = null;
  if (solicitud.servicioDevolucionFecha) {
    srvDevIndex = copiaServicios.findIndex(
      (s) => (solicitud.servicioDevolucionId && s.id === solicitud.servicioDevolucionId) || s.fecha === solicitud.servicioDevolucionFecha
    );
    if (srvDevIndex !== -1) {
      srvDevActual = { ...copiaServicios[srvDevIndex] };
      const slotDevTipo: SlotServicioTipo =
        solicitud.servicioDevolucionSlot || (solicitud.destinatarioEmpleo === 'CABO' ? 'cabo_1' : 'soldado_1');
      const motivoDevolucion = `PERMUTA AUTORIZADA (${codigoVerificacion}): Devolución de ${solicitud.destinatarioNombre} a ${solicitud.solicitanteNombre}`;

      if (slotDevTipo === 'cabo_1' && srvDevActual.titulares.cabos[0]) {
        srvDevActual.titulares.cabos[0] = {
          ...srvDevActual.titulares.cabos[0],
          personaIdReal: solicitud.solicitantePersonaId,
          tipoOrigen: 'MODIFICADO_MANUAL',
          motivoCambio: motivoDevolucion,
        };
      } else if (slotDevTipo === 'cabo_2' && srvDevActual.titulares.cabos[1]) {
        srvDevActual.titulares.cabos[1] = {
          ...srvDevActual.titulares.cabos[1],
          personaIdReal: solicitud.solicitantePersonaId,
          tipoOrigen: 'MODIFICADO_MANUAL',
          motivoCambio: motivoDevolucion,
        };
      } else if (slotDevTipo === 'soldado_1' && srvDevActual.titulares.soldados[0]) {
        srvDevActual.titulares.soldados[0] = {
          ...srvDevActual.titulares.soldados[0],
          personaIdReal: solicitud.solicitantePersonaId,
          tipoOrigen: 'MODIFICADO_MANUAL',
          motivoCambio: motivoDevolucion,
        };
      } else if (slotDevTipo === 'soldado_2' && srvDevActual.titulares.soldados[1]) {
        srvDevActual.titulares.soldados[1] = {
          ...srvDevActual.titulares.soldados[1],
          personaIdReal: solicitud.solicitantePersonaId,
          tipoOrigen: 'MODIFICADO_MANUAL',
          motivoCambio: motivoDevolucion,
        };
      }
      copiaServicios[srvDevIndex] = srvDevActual;
    }
  }

  // 3. Validar consistencia global
  const valResult = validarCuadrante(copiaServicios, personas);
  const erroresBloqueantes = (valResult.items || []).filter((d) => d.severidad === 'ERROR');
  if (erroresBloqueantes.length > 0) {
    const erroresDesc = erroresBloqueantes
      .map((e) => `• [${e.codigo}] ${e.fecha || ''}: ${e.descripcion}`)
      .join('\n');
    return {
      success: false,
      message: `El cambio solicitado genera incompatibilidades en el cuadrante:\n${erroresDesc}`,
    };
  }

  // 4. Guardar en memoria y persistir localmente
  memoryServiciosCache.set(cuadranteId, copiaServicios);
  const nuevasMetricas = calcularMetricasCuadrante(copiaServicios, personas);

  const cuadrante = memoryCuadrantesCache.find((c) => c.id === cuadranteId);
  if (cuadrante) {
    cuadrante.metricasEquilibrio = nuevasMetricas;
    cuadrante.fechaModificacion = new Date().toISOString();
    cuadrante.modificadoPorUid = adminInfo.uid;
  }
  saveLocalCache();

  // 5. Persistir en Firestore si hay conexión
  if (auth.currentUser) {
    try {
      const srvRef = doc(db, CUADRANTES_COLLECTION, cuadranteId, 'servicios', srvActual.id);
      await updateDoc(srvRef, { ...srvActual });

      if (srvDevActual) {
        const srvDevRef = doc(db, CUADRANTES_COLLECTION, cuadranteId, 'servicios', srvDevActual.id);
        await updateDoc(srvDevRef, { ...srvDevActual });
      }

      const cuadranteRef = doc(db, CUADRANTES_COLLECTION, cuadranteId);
      await updateDoc(cuadranteRef, {
        metricasEquilibrio: nuevasMetricas,
        fechaModificacion: new Date().toISOString(),
        modificadoPorUid: adminInfo.uid,
      });
    } catch (err: any) {
      console.warn('Persistencia Firestore diferida:', err.message || err);
    }
  }

  return {
    success: true,
    message: 'Servicios del cuadrante actualizados y recalculados con éxito.',
  };
};
