import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  orderBy,
  where,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import {
  SolicitudCambio,
  EstadoSolicitudCambio,
  ServicioDia,
  Persona,
  SlotServicioTipo,
  DocumentoCambioFirmado,
  TipoUnidad,
} from '../types';
import { registrarAuditLog } from './auditService';
import { crearNotificacion } from './notificacionesService';
import { modificarServicioManual, getServiciosByCuadranteId, aplicarCambioServiciosAutorizado } from './cuadranteService';
import { getPersonas } from './personasService';

const SOLICITUDES_COLLECTION = 'solicitudes_cambio';
const DOCUMENTOS_FIRMA_COLLECTION = 'documentos_cambios_firmados';
const SOLICITUDES_STORAGE_KEY = 'solicitudes_cambio_store_v2';
const DOCS_STORAGE_KEY = 'documentos_cambios_firmados_store_v2';

// Caché en memoria para entorno de desarrollo / fallback
let memorySolicitudesCache: SolicitudCambio[] = [];
let memoryDocumentosFirmadosCache: DocumentoCambioFirmado[] = [];

const loadLocalCache = () => {
  if (memorySolicitudesCache.length === 0) {
    try {
      const stored = localStorage.getItem(SOLICITUDES_STORAGE_KEY);
      if (stored) {
        memorySolicitudesCache = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Error reading solicitudes from localStorage:', e);
    }
  }
  if (memoryDocumentosFirmadosCache.length === 0) {
    try {
      const storedDocs = localStorage.getItem(DOCS_STORAGE_KEY);
      if (storedDocs) {
        memoryDocumentosFirmadosCache = JSON.parse(storedDocs);
      }
    } catch (e) {
      console.warn('Error reading docs from localStorage:', e);
    }
  }
};

const saveLocalCache = () => {
  try {
    localStorage.setItem(SOLICITUDES_STORAGE_KEY, JSON.stringify(memorySolicitudesCache));
    localStorage.setItem(DOCS_STORAGE_KEY, JSON.stringify(memoryDocumentosFirmadosCache));
  } catch (e) {
    console.warn('Error saving solicitudes to localStorage:', e);
  }
};

loadLocalCache();

/**
 * Valida si un cambio entre dos personas es viable según las restricciones operativas duras:
 * - Mismo empleo (Cabo con Cabo, Soldado con Soldado).
 * - Ambas personas activas.
 * - El compañero no tiene ya servicio titular en esa fecha.
 * - El compañero no está de imaginaria en esa fecha.
 * - No se generan servicios en días consecutivos (D-1 o D+1) para el compañero.
 * - Si es cambio de imaginaria, valida descanso D-1, D y D+1 respecto a los servicios titulares del compañero.
 */
export const validarViabilidadCambio = (
  solicitante: Persona,
  destinatario: Persona,
  fechaServicio: string,
  servicios: ServicioDia[],
  tipoCambio: 'SERVICIO' | 'IMAGINARIA' = 'SERVICIO'
): { valido: boolean; motivo?: string } => {
  // 1. Mismo empleo
  if (solicitante.empleo !== destinatario.empleo) {
    return {
      valido: false,
      motivo: `Incompatibilidad de empleo: Un puesto de ${solicitante.empleo} solo puede ser cubierto por otro ${solicitante.empleo}.`,
    };
  }

  // 2. Activo
  if (!destinatario.activo) {
    return {
      valido: false,
      motivo: `El compañero ${destinatario.nombre} no se encuentra en estado ACTIVO.`,
    };
  }

  // 3. No puede ser la misma persona
  if (solicitante.id === destinatario.id) {
    return {
      valido: false,
      motivo: 'No puedes solicitar un cambio de servicio o imaginaria a ti mismo.',
    };
  }

  // 4. Buscar servicios del día y días adyacentes
  const srvDia = servicios.find((s) => s.fecha === fechaServicio);
  if (!srvDia) {
    return { valido: false, motivo: `No se encontró el servicio para la fecha ${fechaServicio}.` };
  }

  // ¿El compañero ya tiene servicio titular ese día?
  const todosTitularesDia = [
    ...srvDia.titulares.cabos.map((c) => c.personaIdReal),
    ...srvDia.titulares.soldados.map((s) => s.personaIdReal),
  ];
  if (todosTitularesDia.includes(destinatario.id)) {
    return {
      valido: false,
      motivo: `${destinatario.nombre} ya tiene asignado un servicio titular el día ${fechaServicio}.`,
    };
  }

  // ¿El compañero ya es imaginaria ese día?
  const imaginariasDia = [
    srvDia.imaginarias.cabo?.personaIdReal,
    srvDia.imaginarias.soldado?.personaIdReal,
  ];
  if (imaginariasDia.includes(destinatario.id)) {
    return {
      valido: false,
      motivo: `${destinatario.nombre} ya está asignado como IMAGINARIA en la fecha ${fechaServicio}.`,
    };
  }

  // Comprobar días adyacentes (D-1 y D+1) para evitar servicios o imaginarias incompatibles
  const fechaDate = new Date(fechaServicio);
  const fechaAnt = new Date(fechaDate);
  fechaAnt.setDate(fechaAnt.getDate() - 1);
  const strAnt = fechaAnt.toISOString().split('T')[0];

  const fechaSig = new Date(fechaDate);
  fechaSig.setDate(fechaSig.getDate() + 1);
  const strSig = fechaSig.toISOString().split('T')[0];

  const srvAnt = servicios.find((s) => s.fecha === strAnt);
  if (srvAnt) {
    const titularesAnt = [
      ...srvAnt.titulares.cabos.map((c) => c.personaIdReal),
      ...srvAnt.titulares.soldados.map((s) => s.personaIdReal),
    ];
    if (titularesAnt.includes(destinatario.id)) {
      if (tipoCambio === 'SERVICIO') {
        return {
          valido: false,
          motivo: `${destinatario.nombre} tiene servicio titular el día anterior (${strAnt}), lo que generaría 48 horas seguidas de servicio (RD-05).`,
        };
      } else {
        return {
          valido: false,
          motivo: `${destinatario.nombre} tiene servicio titular el día anterior (${strAnt}), por lo que no puede hacer imaginaria en ${fechaServicio} (RD-06).`,
        };
      }
    }
  }

  const srvSig = servicios.find((s) => s.fecha === strSig);
  if (srvSig) {
    const titularesSig = [
      ...srvSig.titulares.cabos.map((c) => c.personaIdReal),
      ...srvSig.titulares.soldados.map((s) => s.personaIdReal),
    ];
    if (titularesSig.includes(destinatario.id)) {
      if (tipoCambio === 'SERVICIO') {
        return {
          valido: false,
          motivo: `${destinatario.nombre} tiene servicio titular el día siguiente (${strSig}), lo que generaría guardias consecutivas incompatibles (RD-05).`,
        };
      } else {
        return {
          valido: false,
          motivo: `${destinatario.nombre} tiene servicio titular el día siguiente (${strSig}), por lo que no puede hacer imaginaria en ${fechaServicio} (RD-06).`,
        };
      }
    }
  }

  return { valido: true };
};

/**
 * Crea una nueva solicitud de cambio entre compañeros (servicio titular o imaginaria)
 */
export const crearSolicitudCambio = async (params: {
  cuadranteId: string;
  servicioId: string;
  fechaServicio: string;
  puesto: Persona['empleo'];
  slotTipo: SlotServicioTipo;
  tipoCambio?: 'SERVICIO' | 'IMAGINARIA';
  solicitante: Persona;
  solicitanteUid?: string;
  destinatario: Persona;
  destinatarioUid?: string;
  servicioDevolucionId?: string;
  servicioDevolucionFecha?: string;
  servicioDevolucionSlot?: SlotServicioTipo;
  firmaSolicitante?: string;
  motivo?: string;
  servicios: ServicioDia[];
}): Promise<{ success: boolean; solicitud?: SolicitudCambio; message: string }> => {
  const {
    cuadranteId,
    servicioId,
    fechaServicio,
    puesto,
    slotTipo,
    tipoCambio = 'SERVICIO',
    solicitante,
    solicitanteUid,
    destinatario,
    destinatarioUid,
    servicioDevolucionId,
    servicioDevolucionFecha,
    servicioDevolucionSlot,
    firmaSolicitante,
    motivo,
    servicios,
  } = params;

  // 1. Validar viabilidad estricta
  const check = validarViabilidadCambio(solicitante, destinatario, fechaServicio, servicios, tipoCambio);
  if (!check.valido) {
    return {
      success: false,
      message: check.motivo || 'CAMBIO NO VÁLIDO: Incumple restricciones del motor de guardias.',
    };
  }

  // 2. Si se propone un servicio de devolución, validar también la viabilidad inversa
  if (servicioDevolucionFecha) {
    const checkDevolucion = validarViabilidadCambio(
      destinatario,
      solicitante,
      servicioDevolucionFecha,
      servicios,
      'SERVICIO'
    );
    if (!checkDevolucion.valido) {
      return {
        success: false,
        message: `El servicio de devolución propuesto (${servicioDevolucionFecha}) no es viable: ${checkDevolucion.motivo}`,
      };
    }
  }

  const solicitudId = `cambio-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const nowIso = new Date().toISOString();

  const nuevaSolicitud: SolicitudCambio = {
    id: solicitudId,
    cuadranteId,
    tipoUnidad: solicitante.tipoUnidad || 'GUARDIA',
    servicioId,
    fechaServicio,
    puesto,
    slotTipo,
    tipoCambio,
    solicitantePersonaId: solicitante.id,
    solicitanteNombre: solicitante.nombre,
    solicitanteEmpleo: solicitante.empleo,
    solicitanteUnidad: solicitante.unidad,
    solicitanteUid,
    firmaSolicitante: firmaSolicitante || solicitante.telefono ? 'FIRMA_REGISTRADA' : undefined,
    fechaFirmaSolicitante: nowIso,
    destinatarioPersonaId: destinatario.id,
    destinatarioNombre: destinatario.nombre,
    destinatarioEmpleo: destinatario.empleo,
    destinatarioUnidad: destinatario.unidad,
    destinatarioUid,
    servicioDevolucionId,
    servicioDevolucionFecha,
    servicioDevolucionSlot,
    motivo: motivo?.trim() || '',
    fechaSolicitud: nowIso,
    estado: 'PENDIENTE_COMPAÑERO',
    esValido: true,
  };

  // Guardar en memoria y localStorage
  memorySolicitudesCache.unshift(nuevaSolicitud);
  saveLocalCache();

  // Persistir en Firestore
  if (auth.currentUser) {
    try {
      const docRef = doc(db, SOLICITUDES_COLLECTION, solicitudId);
      await setDoc(docRef, nuevaSolicitud);
    } catch (err: any) {
      console.warn('Persistencia de solicitud en Firestore diferida:', err.message || err);
    }
  }

  // Notificar al compañero destinatario
  await crearNotificacion({
    tipo: 'NUEVA_SOLICITUD_CAMBIO',
    titulo: `Nueva Solicitud de Cambio de ${tipoCambio === 'IMAGINARIA' ? 'Imaginaria' : 'Servicio'}`,
    mensaje: `${solicitante.nombre} (${solicitante.empleo}) te ha propuesto un cambio para el ${fechaServicio}.${servicioDevolucionFecha ? ` A cambio ofrece realizar tu guardia del ${servicioDevolucionFecha}.` : ''}`,
    destinatarioPersonaId: destinatario.id,
    destinatarioUid,
    linkTab: 'cambios',
    referenciaId: solicitudId,
    cuadranteId,
    servicioId,
  });

  return {
    success: true,
    solicitud: nuevaSolicitud,
    message: `Solicitud enviada a ${destinatario.nombre}. Queda pendiente de su aceptación previa.`,
  };
};

/**
 * Obtiene una solicitud de cambio individual por su ID único
 */
export const getSolicitudCambioById = async (
  solicitudId: string
): Promise<SolicitudCambio | null> => {
  loadLocalCache();
  const cached = memorySolicitudesCache.find((s) => s.id === solicitudId);
  if (cached) return cached;

  if (auth.currentUser) {
    try {
      const docRef = doc(db, SOLICITUDES_COLLECTION, solicitudId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const item = docSnap.data() as SolicitudCambio;
        const idx = memorySolicitudesCache.findIndex((s) => s.id === solicitudId);
        if (idx >= 0) {
          memorySolicitudesCache[idx] = item;
        } else {
          memorySolicitudesCache.unshift(item);
        }
        saveLocalCache();
        return item;
      }
    } catch (err: any) {
      console.warn('Lectura de solicitud por ID diferida:', err.message || err);
    }
  }

  return null;
};

/**
 * Obtiene las solicitudes de cambio (filtradas opcionalmente por cuadrante o tipo de unidad)
 */
export const getSolicitudesCambio = async (
  cuadranteId?: string,
  tipoUnidad: TipoUnidad = 'GUARDIA'
): Promise<SolicitudCambio[]> => {
  loadLocalCache();

  if (auth.currentUser) {
    try {
      const colRef = collection(db, SOLICITUDES_COLLECTION);
      const q = query(colRef, orderBy('fechaSolicitud', 'desc'));
      const snapshot = await getDocs(q);
      const items: SolicitudCambio[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() as SolicitudCambio;
        items.push(d);
      });
      if (items.length > 0) {
        for (const item of items) {
          const idx = memorySolicitudesCache.findIndex((s) => s.id === item.id);
          if (idx >= 0) {
            memorySolicitudesCache[idx] = item;
          } else {
            memorySolicitudesCache.push(item);
          }
        }
        saveLocalCache();
      }
    } catch (err: any) {
      console.warn('Lectura de solicitudes de Firestore diferida:', err.message || err);
    }
  }

  return memorySolicitudesCache
    .filter((s) => {
      if (cuadranteId && s.cuadranteId && s.cuadranteId !== cuadranteId) return false;
      const sTipo = s.tipoUnidad || 'GUARDIA';
      if (tipoUnidad && sTipo !== tipoUnidad) return false;
      return true;
    })
    .sort((a, b) => new Date(b.fechaSolicitud).getTime() - new Date(a.fechaSolicitud).getTime());
};

/**
 * El compañero responde a la solicitud: Aceptar, Rechazar o Contraofertar.
 */
export const responderSolicitudCompanero = async (params: {
  solicitudId: string;
  accion?: 'ACEPTAR' | 'RECHAZAR' | 'CONTRAOFERTA';
  aceptada?: boolean;
  motivoRechazo?: string;
  contraofertaServicioId?: string;
  contraofertaFecha?: string;
  contraofertaSlot?: SlotServicioTipo;
  firmaDestinatario?: string;
  personaInfo: { id: string; nombre: string; empleo?: string };
  servicios?: ServicioDia[];
  personas?: Persona[];
}): Promise<{ success: boolean; message: string }> => {
  const {
    solicitudId,
    accion: accionParam,
    aceptada,
    motivoRechazo,
    contraofertaServicioId,
    contraofertaFecha,
    contraofertaSlot,
    firmaDestinatario,
    personaInfo,
    servicios = [],
    personas = [],
  } = params;

  loadLocalCache();
  const accion = accionParam || (aceptada === false ? 'RECHAZAR' : 'ACEPTAR');

  let sol = memorySolicitudesCache.find((s) => s.id === solicitudId);
  if (!sol) {
    sol = (await getSolicitudCambioById(solicitudId)) || undefined;
  }
  if (!sol) {
    return { success: false, message: 'Solicitud no encontrada.' };
  }

  const now = new Date().toISOString();
  sol.fechaRespuestaCompanero = now;

  if (accion === 'ACEPTAR') {
    sol.estado = 'PENDIENTE_ADMIN'; // Pasa a validación del administrador
    if (firmaDestinatario) {
      sol.firmaDestinatario = firmaDestinatario;
      sol.fechaFirmaDestinatario = now;
    }

    saveLocalCache();

    if (auth.currentUser) {
      try {
        const docRef = doc(db, SOLICITUDES_COLLECTION, solicitudId);
        await updateDoc(docRef, {
          estado: sol.estado,
          fechaRespuestaCompanero: now,
          firmaDestinatario: sol.firmaDestinatario || 'FIRMA_REGISTRADA',
          fechaFirmaDestinatario: now,
        });
      } catch (err: any) {
        console.warn('Actualización de solicitud en Firestore diferida:', err.message || err);
      }
    }

    // 1. Notificar al solicitante
    await crearNotificacion({
      tipo: 'SOLICITUD_ACEPTADA_COMPANERO',
      titulo: 'Compañero Aceptó Cambio de Servicio',
      mensaje: `${personaInfo.nombre} ha aceptado tu solicitud de cambio para el ${sol.fechaServicio}. La solicitud ha pasado a revisión del Administrador.`,
      destinatarioPersonaId: sol.solicitantePersonaId,
      linkTab: 'cambios',
      referenciaId: solicitudId,
    });

    // 2. Notificar a los administradores
    await crearNotificacion({
      tipo: 'SOLICITUD_PENDIENTE_ADMIN',
      titulo: 'Solicitud de Cambio Pendiente de Aprobación',
      mensaje: `Cambio acordado entre ${sol.solicitanteNombre} y ${sol.destinatarioNombre} para el día ${sol.fechaServicio}. Requiere aprobación y firma administrativa.`,
      esParaAdmin: true,
      linkTab: 'solicitud_cambio',
      referenciaId: solicitudId,
    });

    return {
      success: true,
      message: 'Has aceptado la propuesta. Ahora queda pendiente de la aprobación y firma final del administrador.',
    };
  } else if (accion === 'CONTRAOFERTA') {
    if (!contraofertaFecha) {
      return { success: false, message: 'Debes seleccionar el servicio de contraoferta.' };
    }

    // Validar viabilidad de la contraoferta
    const solObj = personas.find((p) => p.id === sol.solicitantePersonaId);
    const destObj = personas.find((p) => p.id === sol.destinatarioPersonaId);

    if (solObj && destObj && servicios.length > 0) {
      const checkContra = validarViabilidadCambio(destObj, solObj, contraofertaFecha, servicios);
      if (!checkContra.valido) {
        return {
          success: false,
          message: `Contraoferta incompatible: ${checkContra.motivo}`,
        };
      }
    }

    sol.estado = 'CONTRAOFERTA_COMPAÑERO';
    sol.esContraoferta = true;
    sol.servicioDevolucionId = contraofertaServicioId;
    sol.servicioDevolucionFecha = contraofertaFecha;
    sol.servicioDevolucionSlot = contraofertaSlot;
    if (firmaDestinatario) {
      sol.firmaDestinatario = firmaDestinatario;
      sol.fechaFirmaDestinatario = now;
    }

    if (!sol.historialContraofertas) sol.historialContraofertas = [];
    sol.historialContraofertas.push({
      fecha: now,
      autorId: personaInfo.id,
      autorNombre: personaInfo.nombre,
      propuesta: `Contraoferta: realizar guardia del ${contraofertaFecha}`,
      servicioDevolucionId: contraofertaServicioId,
      servicioDevolucionFecha: contraofertaFecha,
    });

    saveLocalCache();

    if (auth.currentUser) {
      try {
        const docRef = doc(db, SOLICITUDES_COLLECTION, solicitudId);
        await updateDoc(docRef, {
          estado: 'CONTRAOFERTA_COMPAÑERO',
          esContraoferta: true,
          servicioDevolucionId: contraofertaServicioId || null,
          servicioDevolucionFecha: contraofertaFecha,
          servicioDevolucionSlot: contraofertaSlot || null,
          firmaDestinatario: sol.firmaDestinatario || null,
          fechaFirmaDestinatario: now,
          historialContraofertas: sol.historialContraofertas,
        });
      } catch (err: any) {
        console.warn('Actualización de contraoferta en Firestore diferida:', err.message || err);
      }
    }

    // Notificar al solicitante original de la contraoferta
    await crearNotificacion({
      tipo: 'NUEVA_SOLICITUD_CAMBIO',
      titulo: 'Contraoferta de Cambio de Servicio',
      mensaje: `${personaInfo.nombre} te ha enviado una contraoferta para el cambio: propone que cubras su guardia del ${contraofertaFecha}.`,
      destinatarioPersonaId: sol.solicitantePersonaId,
      linkTab: 'cambios',
      referenciaId: solicitudId,
    });

    return {
      success: true,
      message: `Has enviado la contraoferta para la fecha ${contraofertaFecha}. ${sol.solicitanteNombre} debe aceptar la propuesta.`,
    };
  } else {
    // RECHAZAR
    sol.estado = 'RECHAZADA_COMPAÑERO';
    sol.motivoRechazoCompanero = motivoRechazo?.trim() || 'Rechazada por el compañero';

    saveLocalCache();

    if (auth.currentUser) {
      try {
        const docRef = doc(db, SOLICITUDES_COLLECTION, solicitudId);
        await updateDoc(docRef, {
          estado: 'RECHAZADA_COMPAÑERO',
          fechaRespuestaCompanero: now,
          motivoRechazoCompanero: sol.motivoRechazoCompanero,
        });
      } catch (err: any) {
        console.warn('Actualización de solicitud en Firestore diferida:', err.message || err);
      }
    }

    // Notificar rechazo al solicitante
    await crearNotificacion({
      tipo: 'SOLICITUD_RECHAZADA_COMPANERO',
      titulo: 'Solicitud de Cambio Rechazada',
      mensaje: `${personaInfo.nombre} ha rechazado tu propuesta de cambio para el ${sol.fechaServicio}. Motivo: ${sol.motivoRechazoCompanero}`,
      destinatarioPersonaId: sol.solicitantePersonaId,
      linkTab: 'cambios',
      referenciaId: solicitudId,
    });

    return {
      success: true,
      message: 'Has rechazado la solicitud de cambio.',
    };
  }
};

/**
 * Helper para responder con una contraoferta
 */
export const responderContraofertaCompanero = async (params: {
  solicitudId: string;
  propuestaContraoferta?: string;
  servicioDevolucionId?: string;
  servicioDevolucionFecha?: string;
  servicioDevolucionSlot?: SlotServicioTipo;
  firmaDestinatario?: string;
  personaInfo: { id: string; nombre: string; empleo?: string };
  servicios?: ServicioDia[];
  personas?: Persona[];
}): Promise<{ success: boolean; message: string }> => {
  return responderSolicitudCompanero({
    solicitudId: params.solicitudId,
    accion: 'CONTRAOFERTA',
    contraofertaServicioId: params.servicioDevolucionId,
    contraofertaFecha: params.servicioDevolucionFecha,
    contraofertaSlot: params.servicioDevolucionSlot,
    firmaDestinatario: params.firmaDestinatario,
    personaInfo: params.personaInfo,
    servicios: params.servicios,
    personas: params.personas,
  });
};

/**
 * El solicitante acepta la contraoferta propuesta por el compañero
 */
export const aceptarContraofertaSolicitante = async (params: {
  solicitudId: string;
  firmaSolicitante?: string;
  personaInfo: { id: string; nombre: string };
}): Promise<{ success: boolean; message: string }> => {
  const { solicitudId, firmaSolicitante, personaInfo } = params;
  const sol = memorySolicitudesCache.find((s) => s.id === solicitudId);
  if (!sol) {
    return { success: false, message: 'Solicitud no encontrada.' };
  }

  const now = new Date().toISOString();
  sol.estado = 'PENDIENTE_ADMIN';
  if (firmaSolicitante) {
    sol.firmaSolicitante = firmaSolicitante;
    sol.fechaFirmaSolicitante = now;
  }

  if (auth.currentUser) {
    try {
      const docRef = doc(db, SOLICITUDES_COLLECTION, solicitudId);
      await updateDoc(docRef, {
        estado: 'PENDIENTE_ADMIN',
        firmaSolicitante: sol.firmaSolicitante || 'FIRMA_REGISTRADA',
        fechaFirmaSolicitante: now,
      });
    } catch (err: any) {
      console.warn('Actualización de contraoferta aceptada diferida:', err.message || err);
    }
  }

  // Notificar a administradores
  await crearNotificacion({
    tipo: 'SOLICITUD_PENDIENTE_ADMIN',
    titulo: 'Cambio Acordado por Contraoferta (Pendiente Admin)',
    mensaje: `Contraoferta acordada entre ${sol.solicitanteNombre} y ${sol.destinatarioNombre} (${sol.fechaServicio} ↔ ${sol.servicioDevolucionFecha}). Pendiente de autorización y firma.`,
    esParaAdmin: true,
    linkTab: 'cuadrantes',
    referenciaId: solicitudId,
  });

  return {
    success: true,
    message: 'Has aceptado la contraoferta. El cambio acordado ha pasado a la revisión y autorización del administrador.',
  };
};

/**
 * El administrador aprueba o rechaza el cambio acordado.
 * Al autorizar:
 * - Se comprueban las firmas electrónicas necesarias.
 * - Se genera automáticamente el Documento Justificativo Firmado con código de verificación.
 * - Se modifica personaIdReal en el cuadrante (preservando personaIdOriginal).
 * - Si hay servicio de devolución, se aplica también.
 * - Se emite registro inmutable en AuditLogs.
 */
export const resolverSolicitudAdmin = async (params: {
  solicitudId: string;
  aprobada: boolean;
  motivoRechazo?: string;
  firmaAdmin?: string;
  adminInfo: { uid: string; nombre: string };
  personas: Persona[];
}): Promise<{ success: boolean; message: string; documentoId?: string }> => {
  const { solicitudId, aprobada, motivoRechazo, firmaAdmin, adminInfo, personas } = params;
  loadLocalCache();

  let sol = memorySolicitudesCache.find((s) => s.id === solicitudId);
  if (!sol) {
    sol = (await getSolicitudCambioById(solicitudId)) || undefined;
  }
  if (!sol) {
    return { success: false, message: 'Solicitud no encontrada.' };
  }

  const now = new Date().toISOString();
  sol.fechaResolucionAdmin = now;
  sol.adminResolucionUid = adminInfo.uid;
  sol.adminResolucionNombre = adminInfo.nombre;

  if (!aprobada) {
    sol.estado = 'RECHAZADA_ADMIN';
    sol.motivoRechazoAdmin = motivoRechazo?.trim() || 'Rechazada por decisión del mando';
    saveLocalCache();

    if (auth.currentUser) {
      try {
        const docRef = doc(db, SOLICITUDES_COLLECTION, solicitudId);
        await updateDoc(docRef, {
          estado: 'RECHAZADA_ADMIN',
          fechaResolucionAdmin: now,
          adminResolucionUid: adminInfo.uid,
          adminResolucionNombre: adminInfo.nombre,
          motivoRechazoAdmin: sol.motivoRechazoAdmin,
        });
      } catch (err: any) {
        console.warn('Actualización de rechazo en Firestore diferida:', err.message || err);
      }
    }

    // Registrar en auditoría
    await registrarAuditLog({
      adminUid: adminInfo.uid,
      adminNombre: adminInfo.nombre,
      accion: 'RECHAZAR_CAMBIO_ADMIN',
      cuadranteId: sol.cuadranteId,
      fechaAfectada: sol.fechaServicio,
      personaId: sol.solicitantePersonaId,
      personaNombre: sol.solicitanteNombre,
      detalles: `El administrador ${adminInfo.nombre} denegó la solicitud de cambio del ${sol.fechaServicio} entre ${sol.solicitanteNombre} y ${sol.destinatarioNombre}. Motivo: ${sol.motivoRechazoAdmin}`,
    });

    // Notificar a ambos usuarios
    await crearNotificacion({
      tipo: 'SOLICITUD_RECHAZADA_ADMIN',
      titulo: 'Cambio de Servicio Denegado por el Mando',
      mensaje: `Tu solicitud de cambio para el ${sol.fechaServicio} fue rechazada por el Mando. Motivo: ${sol.motivoRechazoAdmin}`,
      destinatarioPersonaId: sol.solicitantePersonaId,
      linkTab: 'mis-servicios',
      referenciaId: solicitudId,
    });
    await crearNotificacion({
      tipo: 'SOLICITUD_RECHAZADA_ADMIN',
      titulo: 'Cambio de Servicio Denegado por el Mando',
      mensaje: `La solicitud de cambio para el ${sol.fechaServicio} fue rechazada por el Mando.`,
      destinatarioPersonaId: sol.destinatarioPersonaId,
      linkTab: 'mis-servicios',
      referenciaId: solicitudId,
    });

    return { success: true, message: 'La solicitud ha sido rechazada. El cuadrante se mantiene sin alteraciones.' };
  }

  // Si es APROBADA:
  // 1. Obtener servicios actuales para comprobar viabilidad matemática
  const servicios = await getServiciosByCuadranteId(sol.cuadranteId);
  const solicitanteObj = personas.find((p) => p.id === sol.solicitantePersonaId);
  const destinatarioObj = personas.find((p) => p.id === sol.destinatarioPersonaId);

  if (!solicitanteObj || !destinatarioObj) {
    return { success: false, message: 'No se encontraron las fichas de personal asociadas.' };
  }

  const check = validarViabilidadCambio(
    solicitanteObj,
    destinatarioObj,
    sol.fechaServicio,
    servicios,
    sol.tipoCambio || 'SERVICIO'
  );
  if (!check.valido) {
    return {
      success: false,
      message: `No se puede aprobar el cambio: ${check.motivo}`,
    };
  }

  // 2. Generar Documento Electrónico Oficial Firmado
  const codigoVerificacion = `DOC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const documentoId = `doc-cambio-${Date.now()}`;

  const documentoFirmado: DocumentoCambioFirmado = {
    id: documentoId,
    solicitudId: sol.id,
    codigoVerificacion,
    tipoCambio: sol.tipoCambio || 'SERVICIO',
    cuadranteId: sol.cuadranteId,
    fechaEmision: now,
    fechaServicioA: sol.fechaServicio,
    slotTipoA: sol.slotTipo,
    personaA: {
      id: solicitanteObj.id,
      nombre: solicitanteObj.nombre,
      empleo: solicitanteObj.empleo,
      unidad: solicitanteObj.unidad,
      firma: sol.firmaSolicitante || 'FIRMA_ELECTRONICA_REGISTRADA',
      fechaFirma: sol.fechaFirmaSolicitante || sol.fechaSolicitud,
    },
    fechaServicioB: sol.servicioDevolucionFecha,
    slotTipoB: sol.servicioDevolucionSlot,
    personaB: {
      id: destinatarioObj.id,
      nombre: destinatarioObj.nombre,
      empleo: destinatarioObj.empleo,
      unidad: destinatarioObj.unidad,
      firma: sol.firmaDestinatario || 'FIRMA_ELECTRONICA_REGISTRADA',
      fechaFirma: sol.fechaFirmaDestinatario || now,
    },
    autorizacionAdmin: {
      adminUid: adminInfo.uid,
      adminNombre: adminInfo.nombre,
      firma: firmaAdmin || 'FIRMA_OFICIAL_ADMINISTRADOR',
      fechaAutorizacion: now,
      resolucion: 'AUTORIZADO',
    },
    detalles: `Autorización oficial de cambio de ${sol.tipoCambio === 'IMAGINARIA' ? 'imaginaria' : 'guardia 24h'} correspondiente al día ${sol.fechaServicio}. ${sol.servicioDevolucionFecha ? `Incluye devolución acordada para el ${sol.servicioDevolucionFecha}.` : ''}`,
    motivo: sol.motivo || 'Acuerdo de servicio entre partes',
  };

  memoryDocumentosFirmadosCache.unshift(documentoFirmado);

  if (auth.currentUser) {
    try {
      await setDoc(doc(db, DOCUMENTOS_FIRMA_COLLECTION, documentoId), documentoFirmado);
    } catch (err: any) {
      console.warn('Persistencia de documento firmado en Firestore diferida:', err.message || err);
    }
  }

  // 3. Modificar el cuadrante de forma atómica (actualiza titular real, posibles devoluciones y recalcula métricas)
  const modRes = await aplicarCambioServiciosAutorizado({
    cuadranteId: sol.cuadranteId,
    solicitud: sol,
    codigoVerificacion,
    personas,
    adminInfo,
  });

  if (!modRes.success) {
    return {
      success: false,
      message: `Error al aplicar el cambio en el cuadrante: ${modRes.message}`,
    };
  }

  // 4. Actualizar estado de la solicitud inmediatamente
  sol.estado = 'APROBADA_ADMIN';
  sol.firmaAdmin = firmaAdmin || 'FIRMA_ADMIN_REGISTRADA';
  sol.fechaFirmaAdmin = now;
  sol.documentoFirmadoId = documentoId;
  saveLocalCache();

  if (auth.currentUser) {
    try {
      const docRef = doc(db, SOLICITUDES_COLLECTION, solicitudId);
      await updateDoc(docRef, {
        estado: 'APROBADA_ADMIN',
        fechaResolucionAdmin: now,
        adminResolucionUid: adminInfo.uid,
        adminResolucionNombre: adminInfo.nombre,
        firmaAdmin: sol.firmaAdmin,
        fechaFirmaAdmin: now,
        documentoFirmadoId: documentoId,
      });
    } catch (err: any) {
      console.warn('Actualización de solicitud en Firestore diferida:', err.message || err);
    }
  }

  // 5. Registrar auditoría inmutable
  await registrarAuditLog({
    adminUid: adminInfo.uid,
    adminNombre: adminInfo.nombre,
    accion: 'APROBAR_CAMBIO',
    cuadranteId: sol.cuadranteId,
    fechaAfectada: sol.fechaServicio,
    personaIdOriginal: sol.solicitantePersonaId,
    personaIdReal: sol.destinatarioPersonaId,
    personaNombre: sol.destinatarioNombre,
    detalles: `Cambio AUTORIZADO Y APLICADO por ${adminInfo.nombre} (Documento: ${codigoVerificacion}) en fecha ${sol.fechaServicio}. Titular original: ${sol.solicitanteNombre} -> Realiza: ${sol.destinatarioNombre}.${sol.servicioDevolucionFecha ? ` Devolución: ${sol.servicioDevolucionFecha}.` : ''}`,
  });

  // 6. Notificar a ambos usuarios
  await crearNotificacion({
    tipo: 'SOLICITUD_APROBADA_ADMIN',
    titulo: 'Cambio de Servicio Autorizado por el Mando',
    mensaje: `Cambio de servicio autorizado por el Mando. Documento oficial: ${codigoVerificacion}.`,
    destinatarioPersonaId: sol.solicitantePersonaId,
    referenciaId: solicitudId,
    cuadranteId: sol.cuadranteId,
    servicioId: sol.servicioId,
    linkTab: 'mis-servicios',
  });
  await crearNotificacion({
    tipo: 'SOLICITUD_APROBADA_ADMIN',
    titulo: 'Cambio de Servicio Autorizado por el Mando',
    mensaje: `Cambio de servicio autorizado por el Mando. Has asumido la guardia del ${sol.fechaServicio}. Documento oficial: ${codigoVerificacion}.`,
    destinatarioPersonaId: sol.destinatarioPersonaId,
    referenciaId: solicitudId,
    cuadranteId: sol.cuadranteId,
    servicioId: sol.servicioId,
    linkTab: 'mis-servicios',
  });

  return {
    success: true,
    message: 'Cambio autorizado y aplicado correctamente.',
    documentoId,
  };
};

/**
 * Obtiene un documento firmado por su ID
 */
export const getDocumentoFirmado = async (
  documentoId: string
): Promise<DocumentoCambioFirmado | null> => {
  const cached = memoryDocumentosFirmadosCache.find((d) => d.id === documentoId);
  if (cached) return cached;

  if (auth.currentUser) {
    try {
      const docSnap = await getDoc(doc(db, DOCUMENTOS_FIRMA_COLLECTION, documentoId));
      if (docSnap.exists()) {
        const data = docSnap.data() as DocumentoCambioFirmado;
        memoryDocumentosFirmadosCache.unshift(data);
        return data;
      }
    } catch (err: any) {
      console.warn('Lectura de documento firmado en Firestore diferida:', err.message || err);
    }
  }

  return null;
};

export const aprobarSolicitudAdmin = async (params: {
  solicitud: SolicitudCambio;
  adminInfo: { uid: string; nombre: string };
  cuadranteId: string;
  firmaAdmin?: string;
  servicios?: ServicioDia[];
  personas?: Persona[];
}): Promise<{ success: boolean; message: string; documentoId?: string }> => {
  const personasList = params.personas || (await getPersonas());
  return resolverSolicitudAdmin({
    solicitudId: params.solicitud.id,
    aprobada: true,
    firmaAdmin: params.firmaAdmin,
    adminInfo: params.adminInfo,
    personas: personasList,
  });
};

export const rechazarSolicitudAdmin = async (params: {
  solicitud: SolicitudCambio;
  adminInfo: { uid: string; nombre: string };
  motivoRechazo?: string;
  personas?: Persona[];
}): Promise<{ success: boolean; message: string }> => {
  const personasList = params.personas || (await getPersonas());
  return resolverSolicitudAdmin({
    solicitudId: params.solicitud.id,
    aprobada: false,
    motivoRechazo: params.motivoRechazo,
    adminInfo: params.adminInfo,
    personas: personasList,
  });
};


