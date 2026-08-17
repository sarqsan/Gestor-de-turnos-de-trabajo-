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
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../firebase/config';
import {
  IncidenciaAusencia,
  TipoAusencia,
  EstadoIncidencia,
  ServicioDia,
  Persona,
  ParteMedico,
} from '../types';
import { registrarAuditLog } from './auditService';
import { crearNotificacion } from './notificacionesService';
import { modificarServicioManual, getServiciosByCuadranteId } from './cuadranteService';
import { getPersonas } from './personasService';

const INCIDENCIAS_COLLECTION = 'incidencias_ausencia';
const PARTES_COLLECTION = 'partes_medicos';
const INCIDENCIAS_STORAGE_KEY = 'incidencias_ausencia_cache_v2';
const PARTES_STORAGE_KEY = 'partes_medicos_cache_v2';

// Caché en memoria para entorno de desarrollo / fallback
let memoryIncidenciasCache: IncidenciaAusencia[] = [];
let memoryPartesCache: ParteMedico[] = [];

const loadIncidenciasLocalCache = () => {
  try {
    const rawI = localStorage.getItem(INCIDENCIAS_STORAGE_KEY);
    if (rawI) {
      const parsed = JSON.parse(rawI);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryIncidenciasCache = parsed;
      }
    }
    const rawP = localStorage.getItem(PARTES_STORAGE_KEY);
    if (rawP) {
      const parsedP = JSON.parse(rawP);
      if (Array.isArray(parsedP) && parsedP.length > 0) {
        memoryPartesCache = parsedP;
      }
    }
  } catch (e) {
    console.warn('Error cargando incidencias de localStorage:', e);
  }
};

const saveIncidenciasLocalCache = () => {
  try {
    localStorage.setItem(INCIDENCIAS_STORAGE_KEY, JSON.stringify(memoryIncidenciasCache));
    localStorage.setItem(PARTES_STORAGE_KEY, JSON.stringify(memoryPartesCache));
  } catch (e) {
    console.warn('Error guardando incidencias en localStorage:', e);
  }
};

loadIncidenciasLocalCache();

export interface ResultadoAnalisisIA {
  fechaInicio?: string;
  fechaFin?: string;
  diasDuracion?: number;
  estado: 'CONFIRMADO' | 'REVISION_MANUAL';
  motivoRevision?: string;
  resumenDiagnostico: string;
  confianza?: string;
}

/**
 * Llama al endpoint de servidor con Gemini para analizar el documento médico o texto.
 */
export const analizarDocumentoParteMedicoIA = async (params: {
  fileBase64?: string;
  mimeType?: string;
  textoObservaciones?: string;
}): Promise<ResultadoAnalisisIA> => {
  try {
    const res = await fetch('/api/analizar-parte-medico', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const json = await res.json();
    if (json.success && json.data) {
      return json.data;
    }
    return {
      estado: 'REVISION_MANUAL',
      motivoRevision: 'Respuesta no concluyente del servicio de análisis.',
      resumenDiagnostico: 'Documento médico adjunto para revisión manual.',
      confianza: 'BAJA',
    };
  } catch (err: any) {
    console.warn('Error llamando a Gemini para parte médico:', err);
    return {
      estado: 'REVISION_MANUAL',
      motivoRevision: 'Error de conexión con el servicio de IA. Requiere comprobación por el mando.',
      resumenDiagnostico: 'Parte médico en revisión administrativa.',
      confianza: 'BAJA',
    };
  }
};

/**
 * Sube un archivo a Firebase Storage (NUNCA como base64 en Firestore)
 */
export const subirDocumentoStorage = async (
  file: File,
  personaId: string
): Promise<{ url: string; path: string }> => {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `partes_medicos/${personaId}/${timestamp}_${safeName}`;

  try {
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(storageRef);
    return { url: downloadUrl, path: storagePath };
  } catch (err: any) {
    console.warn('Storage de Firebase no disponible directamente, generando URL local simulada:', err.message || err);
    const localUrl = URL.createObjectURL(file);
    return { url: localUrl, path: storagePath };
  }
};

/**
 * Comunica una ausencia / indisposición por parte de un titular.
 * - Registra la hora exacta de comunicación.
 * - Alerta ÚNICAMENTE al Cabo y Soldado de imaginaria de ese día y a los administradores.
 * - Registra la acción en AuditLogs.
 * - Detecta si la baja afecta a > 2 servicios y emite la alerta reglamentaria (sin sustitución automática).
 */
export const comunicarAusencia = async (params: {
  cuadranteId: string;
  servicioId: string;
  fechaServicio: string;
  titular: Persona;
  slotTipo: 'cabo_1' | 'cabo_2' | 'soldado_1' | 'soldado_2';
  tipoAusencia: TipoAusencia;
  observaciones?: string;
  servicioDia: ServicioDia;
  personas: Persona[];
  documentoUrl?: string;
  documentoNombre?: string;
  documentoPath?: string;
  analisisIA?: ResultadoAnalisisIA;
  todosLosServicios?: ServicioDia[];
}): Promise<{ success: boolean; incidencia?: IncidenciaAusencia; message: string; alertaMasDeDosServicios?: boolean }> => {
  const {
    cuadranteId,
    servicioId,
    fechaServicio,
    titular,
    slotTipo,
    tipoAusencia,
    observaciones,
    servicioDia,
    personas,
    documentoUrl,
    documentoNombre,
    documentoPath,
    analisisIA,
    todosLosServicios = [],
  } = params;

  const now = new Date();
  const nowIso = now.toISOString();
  const horaExacta = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Determinar momento temporal respecto al servicio (08:00 a 08:00)
  const hoyStr = now.toISOString().split('T')[0];
  let estadoMomento: IncidenciaAusencia['estadoMomentoServicio'] = 'ANTES_DE_INICIAR';
  if (fechaServicio < hoyStr) {
    estadoMomento = 'DIA_SIGUIENTE';
  } else if (fechaServicio === hoyStr) {
    const horaActual = now.getHours();
    estadoMomento = horaActual >= 8 ? 'EN_CURSO' : 'MISMO_DIA';
  }

  // Determinar la imaginaria correspondiente según el empleo exacto del titular
  const imagCaboId = servicioDia.imaginarias.cabo.personaIdReal;
  const imagSoldadoId = servicioDia.imaginarias.soldado.personaIdReal;

  const imagCabo = personas.find((p) => p.id === imagCaboId);
  const imagSoldado = personas.find((p) => p.id === imagSoldadoId);

  // Imaginaria específica asignada al empleo del titular
  const imagAsignada = titular.empleo === 'CABO' ? imagCabo : imagSoldado;
  const imagAsignadaId = titular.empleo === 'CABO' ? imagCaboId : imagSoldadoId;
  const imagAsignadaNombre = imagAsignada?.nombre || (titular.empleo === 'CABO' ? 'Cabo de Imaginaria' : 'Soldado de Imaginaria');
  const imagAsignadaTelefono = imagAsignada?.telefono || undefined;

  // Calcular servicios futuros afectados por la baja
  const fechaFinEstimada = analisisIA?.fechaFin || (analisisIA?.diasDuracion ? (() => {
    const d = new Date(fechaServicio);
    d.setDate(d.getDate() + (analisisIA.diasDuracion || 1) - 1);
    return d.toISOString().split('T')[0];
  })() : fechaServicio);

  const serviciosAfectados = todosLosServicios.filter((s) => {
    if (s.fecha < fechaServicio || s.fecha > fechaFinEstimada) return false;
    const esTitular =
      s.titulares.cabos.some((c) => c.personaIdReal === titular.id) ||
      s.titulares.soldados.some((so) => so.personaIdReal === titular.id);
    return esTitular;
  });

  const totalAfectados = Math.max(1, serviciosAfectados.length);
  const fechasAfectadas = serviciosAfectados.length > 0 ? serviciosAfectados.map((s) => s.fecha) : [fechaServicio];
  const alertaMasDeDos = totalAfectados > 2;

  const incidenciaId = `inc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const nuevaIncidencia: IncidenciaAusencia = {
    id: incidenciaId,
    cuadranteId,
    servicioId,
    fechaServicio,
    horaInicio: '08:00',
    horaFin: '08:00',
    puesto: titular.empleo,
    slotTipo,
    titularPersonaId: titular.id,
    titularNombre: titular.nombre,
    titularEmpleo: titular.empleo,
    titularUnidad: titular.unidad,
    titularTelefono: titular.telefono,
    tipoAusencia,
    observaciones: observaciones?.trim() || '',
    fechaComunicacion: nowIso,
    horaExactaComunicacion: horaExacta,
    estadoMomentoServicio: estadoMomento,
    imaginariaNotificadaPersonaId: imagAsignadaId,
    imaginariaNotificadaNombre: imagAsignadaNombre,
    imaginariaNotificadaTelefono: imagAsignadaTelefono,
    imaginariaCaboPersonaId: imagCaboId,
    imaginariaCaboNombre: imagCabo?.nombre || 'Cabo Imaginaria',
    imaginariaSoldadoPersonaId: imagSoldadoId,
    imaginariaSoldadoNombre: imagSoldado?.nombre || 'Soldado Imaginaria',
    confirmacionImaginaria: {
      confirmada: false,
      personaId: imagAsignadaId,
      nombre: imagAsignadaNombre,
      empleo: titular.empleo,
      titularSustituidoNombre: titular.nombre,
      servicioFecha: fechaServicio,
    },
    estado: 'COMUNICADA_PENDIENTE_COBERTURA',
    documentoUrl,
    documentoNombre,
    documentoPath,
    fechaInicioBaja: analisisIA?.fechaInicio || fechaServicio,
    fechaFinBaja: fechaFinEstimada,
    diasDuracion: analisisIA?.diasDuracion,
    estadoAnalisisIA: analisisIA?.estado || (documentoUrl ? 'CONFIRMADO' : undefined),
    motivoRevisionIA: analisisIA?.motivoRevision,
    diagnosticoResumen: analisisIA?.resumenDiagnostico,
    serviciosAfectadosCount: totalAfectados,
    serviciosAfectadosFechas: fechasAfectadas,
    alertaMasDeDosServicios: alertaMasDeDos,
  };

  memoryIncidenciasCache.unshift(nuevaIncidencia);

  // Si adjuntó parte médico, registrarlo en la colección confidencial partes_medicos
  if (documentoUrl) {
    const parteId = `parte-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nuevoParte: ParteMedico = {
      id: parteId,
      personaId: titular.id,
      personaNombre: titular.nombre,
      personaEmpleo: titular.empleo,
      personaUnidad: titular.unidad,
      fechaSubida: nowIso,
      fechaInicio: analisisIA?.fechaInicio || fechaServicio,
      fechaFin: fechaFinEstimada,
      diasDuracion: analisisIA?.diasDuracion,
      estadoAnalisisIA: analisisIA?.estado || 'CONFIRMADO',
      motivoRevisionIA: analisisIA?.motivoRevision,
      diagnosticoResumen: analisisIA?.resumenDiagnostico,
      documentoUrl,
      documentoNombre: documentoNombre || 'parte_medico',
      documentoPath: documentoPath || '',
      incidenciaId,
      cuadranteId,
      serviciosAfectadosFechas: fechasAfectadas,
      serviciosAfectadosCount: totalAfectados,
      alertaMasDeDosServicios: alertaMasDeDos,
    };
    memoryPartesCache.unshift(nuevoParte);

    if (auth.currentUser) {
      try {
        await setDoc(doc(db, PARTES_COLLECTION, parteId), nuevoParte);
      } catch (err: any) {
        console.warn('Persistencia de parte médico en Firestore diferida:', err.message || err);
      }
    }
  }

  if (auth.currentUser) {
    try {
      const docRef = doc(db, INCIDENCIAS_COLLECTION, incidenciaId);
      await setDoc(docRef, nuevaIncidencia);
    } catch (err: any) {
      console.warn('Persistencia de incidencia en Firestore diferida:', err.message || err);
    }
  }

  // 1. Alertar a la Imaginaria específica de ese empleo (FILTRO ESTRICTO: Cabo -> Cabo, Soldado -> Soldado)
  if (imagAsignada && imagAsignada.empleo === titular.empleo) {
    await crearNotificacion({
      tipo: 'SOLICITUD_COBERTURA',
      tipoUnidad: 'GUARDIA',
      titulo: `AVISO DE COBERTURA: Guardia del ${fechaServicio} asignada por baja del titular.`,
      mensaje: `Debes presentarte para cubrir la guardia de 24h de ${titular.nombre} (${titular.empleo}) el día ${fechaServicio}. Por favor, confirma la recepción en la aplicación. La notificación de la aplicación no sustituye la comunicación directa con el personal de guardia si procede.`,
      destinatarioPersonaId: imagAsignada.id,
      linkTab: 'imaginarias',
      referenciaId: incidenciaId,
      cuadranteId,
      servicioId,
    });
  } else {
    // Si no hay imaginaria del mismo empleo disponible, avisar al administrador para asignación manual
    await crearNotificacion({
      tipo: 'AVISO_IMPORTANTE',
      tipoUnidad: 'GUARDIA',
      titulo: `⚠️ SIN IMAGINARIA DE ${titular.empleo} PARA ${fechaServicio}`,
      mensaje: `No se encontró imaginaria de empleo ${titular.empleo} asignada para cubrir la baja de ${titular.nombre}. Requiere asignación manual por el mando.`,
      esParaAdmin: true,
      linkTab: 'cuadrantes',
      referenciaId: incidenciaId,
      cuadranteId,
      servicioId,
    });
  }

  // 2. Alertar a los administradores
  let mensajeAdmin = `Indisposición comunicada para el servicio del ${fechaServicio} (${horaExacta}) por ${titular.nombre}. Alertada imaginaria de ${titular.empleo}: ${imagAsignadaNombre}${imagAsignadaTelefono ? ` (Tel: ${imagAsignadaTelefono})` : ''}.`;
  if (alertaMasDeDos) {
    mensajeAdmin += ` [ALERTA: La baja continuada afecta a ${totalAfectados} servicios (> 2). Continúan cubiertos por imaginarias mientras no haya sustitución oficial.]`;
  }

  await crearNotificacion({
    tipo: 'NUEVA_INCIDENCIA_AUSENCIA',
    tipoUnidad: 'GUARDIA',
    titulo: `INCIDENCIA URGENTE: Ausencia de ${titular.nombre}${alertaMasDeDos ? ' (> 2 servicios)' : ''}`,
    mensaje: mensajeAdmin,
    esParaAdmin: true,
    linkTab: 'cuadrantes',
    referenciaId: incidenciaId,
    cuadranteId,
    servicioId,
  });

  // 3. Registrar en AuditLogs
  await registrarAuditLog({
    adminUid: titular.id,
    adminNombre: titular.nombre,
    accion: 'COMUNICAR_AUSENCIA',
    cuadranteId,
    fechaAfectada: fechaServicio,
    personaId: titular.id,
    personaNombre: titular.nombre,
    motivo: `${tipoAusencia}: ${observaciones || 'Sin observaciones'}${analisisIA ? ` | IA: ${analisisIA.estado} (${analisisIA.resumenDiagnostico})` : ''}`,
    detalles: `Ausencia comunicada por ${titular.nombre} para guardia del ${fechaServicio} a las ${horaExacta}. ${alertaMasDeDos ? `Afecta a ${totalAfectados} servicios continuados.` : ''} Alertada imaginaria de su empleo: ${imagAsignadaNombre}.`,
  });

  saveIncidenciasLocalCache();

  return {
    success: true,
    incidencia: nuevaIncidencia,
    alertaMasDeDosServicios: alertaMasDeDos,
    message: `Tu imaginaria asignada es ${imagAsignadaNombre}.\nTeléfono: ${imagAsignadaTelefono || 'No registrado'}.\n\nLa aplicación ha enviado el aviso automáticamente, pero DEBES COMUNICAR PERSONALMENTE LA BAJA AL IMAGINARIA. La notificación de la aplicación no sustituye la comunicación directa.`,
  };
};

/**
 * La imaginaria confirma que ha RECIBIDO el aviso de indisposición/cobertura.
 * Cambia el estado de recepción a 'IMAGINARIA ACTIVADA / COBERTURA'.
 */
export const confirmarRecepcionAvisoImaginaria = async (params: {
  incidenciaId: string;
  imaginariaPersona: Persona;
}): Promise<{ success: boolean; message: string }> => {
  const { incidenciaId, imaginariaPersona } = params;
  const inc = memoryIncidenciasCache.find((i) => i.id === incidenciaId);
  if (!inc) {
    return { success: false, message: 'Incidencia no encontrada.' };
  }

  // Comprobar equivalencia estricta de empleo
  if (imaginariaPersona.empleo !== inc.puesto) {
    return {
      success: false,
      message: `Restricción reglamentaria: Solo un ${inc.puesto} puede cubrir un puesto de ${inc.puesto}. Tu empleo es ${imaginariaPersona.empleo}.`,
    };
  }

  const now = new Date().toISOString();
  inc.confirmacionImaginaria = {
    confirmada: true,
    fechaHoraConfirmacion: now,
    personaId: imaginariaPersona.id,
    nombre: imaginariaPersona.nombre,
    empleo: imaginariaPersona.empleo,
    titularSustituidoNombre: inc.titularNombre,
    servicioFecha: inc.fechaServicio,
  };
  inc.imaginariaAceptantePersonaId = imaginariaPersona.id;
  inc.imaginariaAceptanteNombre = imaginariaPersona.nombre;
  inc.imaginariaAceptanteEmpleo = imaginariaPersona.empleo;
  inc.fechaAceptacionImaginaria = now;
  inc.estado = 'IMAGINARIA_ACTIVADA_COBERTURA';

  saveIncidenciasLocalCache();

  if (auth.currentUser) {
    try {
      const docRef = doc(db, INCIDENCIAS_COLLECTION, incidenciaId);
      await updateDoc(docRef, {
        confirmacionImaginaria: inc.confirmacionImaginaria,
        imaginariaAceptantePersonaId: inc.imaginariaAceptantePersonaId,
        imaginariaAceptanteNombre: inc.imaginariaAceptanteNombre,
        imaginariaAceptanteEmpleo: inc.imaginariaAceptanteEmpleo,
        fechaAceptacionImaginaria: now,
        estado: 'IMAGINARIA_ACTIVADA_COBERTURA',
      });
    } catch (err: any) {
      console.warn('Actualización de confirmación de imaginaria en Firestore diferida:', err.message || err);
    }
  }

  // 1. Notificar al titular indispuesto
  await crearNotificacion({
    tipo: 'COBERTURA_ACEPTADA',
    titulo: 'Imaginaria Confirmó Recepción del Aviso',
    mensaje: `${imaginariaPersona.nombre} (${imaginariaPersona.empleo}) ha confirmado la recepción del aviso y activado la cobertura para tu guardia del ${inc.fechaServicio}.`,
    destinatarioPersonaId: inc.titularPersonaId,
    linkTab: 'mis-servicios',
    referenciaId: incidenciaId,
  });

  // 2. Notificar a los administradores
  await crearNotificacion({
    tipo: 'COBERTURA_ACEPTADA',
    titulo: 'Recepción de Aviso de Cobertura Confirmada',
    mensaje: `La imaginaria de ${imaginariaPersona.empleo} (${imaginariaPersona.nombre}) ha confirmado la recepción del aviso de baja para el servicio del ${inc.fechaServicio}. Estado: IMAGINARIA ACTIVADA / COBERTURA.`,
    esParaAdmin: true,
    linkTab: 'cuadrantes',
    referenciaId: incidenciaId,
  });

  // 3. Registrar en auditoría
  await registrarAuditLog({
    adminUid: imaginariaPersona.id,
    adminNombre: imaginariaPersona.nombre,
    accion: 'ACTIVAR_IMAGINARIA_COBERTURA',
    cuadranteId: inc.cuadranteId,
    fechaAfectada: inc.fechaServicio,
    personaId: imaginariaPersona.id,
    personaNombre: imaginariaPersona.nombre,
    detalles: `El imaginaria ${imaginariaPersona.nombre} (${imaginariaPersona.empleo}) confirmó la recepción y activó la cobertura de guardia del ${inc.fechaServicio} por baja de ${inc.titularNombre}. Estado: IMAGINARIA ACTIVADA / COBERTURA.`,
  });

  return {
    success: true,
    message: "Has confirmado la recepción del aviso de cobertura. El estado ha pasado a 'IMAGINARIA ACTIVADA / COBERTURA'. Recuerda: la notificación de la aplicación no sustituye la comunicación directa con el personal de guardia si procede.",
  };
};

/**
 * Obtiene las incidencias de ausencia
 */
export const getIncidenciasAusencia = async (cuadranteId?: string): Promise<IncidenciaAusencia[]> => {
  if (auth.currentUser) {
    try {
      const colRef = collection(db, INCIDENCIAS_COLLECTION);
      const q = query(colRef, orderBy('fechaComunicacion', 'desc'));
      const snapshot = await getDocs(q);
      const items: IncidenciaAusencia[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() as IncidenciaAusencia;
        if (!cuadranteId || d.cuadranteId === cuadranteId) {
          items.push(d);
        }
      });
      if (items.length > 0) {
        memoryIncidenciasCache = items;
        return items;
      }
    } catch (err: any) {
      console.warn('Lectura de incidencias de Firestore diferida:', err.message || err);
    }
  }

  return memoryIncidenciasCache.filter((i) => !cuadranteId || i.cuadranteId === cuadranteId);
};

/**
 * Obtiene los partes médicos respetando la privacidad estricta:
 * - Admin: puede consultar todos los partes
 * - Usuario normal: ÚNICAMENTE los suyos (personaId coincidente)
 */
export const getPartesMedicos = async (
  personaId?: string,
  isAdmin: boolean = false
): Promise<ParteMedico[]> => {
  if (auth.currentUser) {
    try {
      const colRef = collection(db, PARTES_COLLECTION);
      let q = query(colRef, orderBy('fechaSubida', 'desc'));
      if (!isAdmin && personaId) {
        q = query(colRef, where('personaId', '==', personaId), orderBy('fechaSubida', 'desc'));
      }
      const snapshot = await getDocs(q);
      const items: ParteMedico[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as ParteMedico);
      });
      if (items.length > 0) {
        memoryPartesCache = items;
        return isAdmin ? items : items.filter((p) => p.personaId === personaId);
      }
    } catch (err: any) {
      console.warn('Lectura de partes médicos de Firestore diferida:', err.message || err);
    }
  }

  if (isAdmin) {
    return memoryPartesCache;
  }
  return memoryPartesCache.filter((p) => p.personaId === personaId);
};

/**
 * El Imaginaria acepta cubrir la guardia
 */
export const aceptarCoberturaImaginaria = async (params: {
  incidenciaId: string;
  imaginariaPersona: Persona;
}): Promise<{ success: boolean; message: string }> => {
  const { incidenciaId, imaginariaPersona } = params;
  const inc = memoryIncidenciasCache.find((i) => i.id === incidenciaId);
  if (!inc) {
    return { success: false, message: 'Incidencia no encontrada.' };
  }

  // Verificar que coincide el empleo
  if (imaginariaPersona.empleo !== inc.puesto) {
    return {
      success: false,
      message: `El puesto de baja es de ${inc.puesto}. No coincide con tu empleo (${imaginariaPersona.empleo}).`,
    };
  }

  const now = new Date().toISOString();
  inc.imaginariaAceptantePersonaId = imaginariaPersona.id;
  inc.imaginariaAceptanteNombre = imaginariaPersona.nombre;
  inc.imaginariaAceptanteEmpleo = imaginariaPersona.empleo;
  inc.fechaAceptacionImaginaria = now;
  inc.estado = 'COBERTURA_ACEPTADA_PENDIENTE_ADMIN';

  if (auth.currentUser) {
    try {
      const docRef = doc(db, INCIDENCIAS_COLLECTION, incidenciaId);
      await updateDoc(docRef, {
        imaginariaAceptantePersonaId: imaginariaPersona.id,
        imaginariaAceptanteNombre: imaginariaPersona.nombre,
        imaginariaAceptanteEmpleo: imaginariaPersona.empleo,
        fechaAceptacionImaginaria: now,
        estado: 'COBERTURA_ACEPTADA_PENDIENTE_ADMIN',
      });
    } catch (err: any) {
      console.warn('Actualización de aceptación de cobertura en Firestore diferida:', err.message || err);
    }
  }

  saveIncidenciasLocalCache();

  // Notificar a los administradores para aprobación
  await crearNotificacion({
    tipo: 'COBERTURA_ACEPTADA',
    titulo: 'Cobertura de Imaginaria Aceptada',
    mensaje: `${imaginariaPersona.nombre} (${imaginariaPersona.empleo}) ha aceptado cubrir la baja de ${inc.titularNombre} para el ${inc.fechaServicio}. Pendiente de ratificación.`,
    esParaAdmin: true,
    linkTab: 'cuadrantes',
    referenciaId: incidenciaId,
  });

  return {
    success: true,
    message: `Has confirmado tu disponibilidad para cubrir el servicio del ${inc.fechaServicio}. Pendiente de ratificación por el administrador.`,
  };
};

/**
 * El Administrador resuelve y ratifica la cobertura de imaginaria.
 * Actualiza el cuadrante:
 * - Titular original se mantiene inalterado en personaIdOriginal.
 * - personaIdReal se actualiza al imaginaria aceptante.
 * - estadoAsignacion pasa a 'CUBIERTO_POR_IMAGINARIA'.
 * - Se emite log de auditoría.
 */
export const resolverIncidenciaAdmin = async (params: {
  incidenciaId: string;
  aprobada: boolean;
  motivoRechazo?: string;
  adminInfo: { uid: string; nombre: string };
  personas: Persona[];
}): Promise<{ success: boolean; message: string }> => {
  const { incidenciaId, aprobada, motivoRechazo, adminInfo, personas } = params;
  const inc = memoryIncidenciasCache.find((i) => i.id === incidenciaId);
  if (!inc) {
    return { success: false, message: 'Incidencia no encontrada.' };
  }

  const now = new Date().toISOString();
  inc.fechaResolucionAdmin = now;
  inc.adminResolucionUid = adminInfo.uid;
  inc.adminResolucionNombre = adminInfo.nombre;

  if (!aprobada) {
    inc.estado = 'RECHAZADA_ADMIN';
    inc.motivoRechazoAdmin = motivoRechazo?.trim() || 'Cobertura desestimada por el mando';
    saveIncidenciasLocalCache();

    if (auth.currentUser) {
      try {
        const docRef = doc(db, INCIDENCIAS_COLLECTION, incidenciaId);
        await updateDoc(docRef, {
          estado: 'RECHAZADA_ADMIN',
          fechaResolucionAdmin: now,
          adminResolucionUid: adminInfo.uid,
          adminResolucionNombre: adminInfo.nombre,
          motivoRechazoAdmin: inc.motivoRechazoAdmin,
        });
      } catch (err: any) {
        console.warn('Actualización de rechazo de incidencia en Firestore diferida:', err.message || err);
      }
    }

    await registrarAuditLog({
      adminUid: adminInfo.uid,
      adminNombre: adminInfo.nombre,
      accion: 'RECHAZAR_COBERTURA',
      cuadranteId: inc.cuadranteId,
      fechaAfectada: inc.fechaServicio,
      personaId: inc.titularPersonaId,
      personaNombre: inc.titularNombre,
      detalles: `Cobertura de imaginaria rechazada por ${adminInfo.nombre}. Motivo: ${inc.motivoRechazoAdmin}`,
    });

    return { success: true, message: 'La cobertura ha sido rechazada.' };
  }

  if (!inc.imaginariaAceptantePersonaId) {
    return { success: false, message: 'No hay un imaginaria registrado que haya aceptado la cobertura.' };
  }

  // Modificar el servicio en el cuadrante
  const modRes = await modificarServicioManual({
    cuadranteId: inc.cuadranteId,
    servicioId: inc.servicioId,
    slotTipo: inc.slotTipo,
    nuevaPersonaId: inc.imaginariaAceptantePersonaId,
    motivo: `Cobertura por ausencia (${inc.tipoAusencia}) de ${inc.titularNombre}. Asume el servicio el imaginaria ${inc.imaginariaAceptanteNombre}.`,
    personas,
    adminInfo,
  });

  if (!modRes.success) {
    return { success: false, message: `Error al actualizar cuadrante: ${modRes.message}` };
  }

  inc.estado = 'RESUELTA_APROBADA';
  saveIncidenciasLocalCache();

  if (auth.currentUser) {
    try {
      const docRef = doc(db, INCIDENCIAS_COLLECTION, incidenciaId);
      await updateDoc(docRef, {
        estado: 'RESUELTA_APROBADA',
        fechaResolucionAdmin: now,
        adminResolucionUid: adminInfo.uid,
        adminResolucionNombre: adminInfo.nombre,
      });
    } catch (err: any) {
      console.warn('Actualización de resolución de incidencia en Firestore diferida:', err.message || err);
    }
  }

  // Registrar en AuditLogs
  await registrarAuditLog({
    adminUid: adminInfo.uid,
    adminNombre: adminInfo.nombre,
    accion: 'APROBAR_COBERTURA',
    cuadranteId: inc.cuadranteId,
    fechaAfectada: inc.fechaServicio,
    personaIdOriginal: inc.titularPersonaId,
    personaIdReal: inc.imaginariaAceptantePersonaId,
    personaNombre: inc.imaginariaAceptanteNombre,
    detalles: `Cobertura APROBADA para guardia del ${inc.fechaServicio}. Titular ausente (${inc.titularNombre}) relevado por imaginaria ${inc.imaginariaAceptanteNombre}.`,
  });

  // Notificar al imaginaria
  await crearNotificacion({
    tipo: 'COBERTURA_APROBADA',
    titulo: 'Cobertura de Servicio Ratificada',
    mensaje: `Has sido confirmado como titular del servicio del ${inc.fechaServicio} en relevo por baja de ${inc.titularNombre}.`,
    destinatarioPersonaId: inc.imaginariaAceptantePersonaId,
    referenciaId: incidenciaId,
    cuadranteId: inc.cuadranteId,
    servicioId: inc.servicioId,
  });

  // Notificar al titular
  await crearNotificacion({
    tipo: 'COBERTURA_APROBADA',
    titulo: 'Cobertura de Ausencia Tramitada',
    mensaje: `Tu ausencia para el ${inc.fechaServicio} ha sido cubierta oficialmente por ${inc.imaginariaAceptanteNombre}.`,
    destinatarioPersonaId: inc.titularPersonaId,
    referenciaId: incidenciaId,
  });

  return {
    success: true,
    message: `Cobertura ratificada exitosamente. ${inc.imaginariaAceptanteNombre} asignado como titular real para el ${inc.fechaServicio}.`,
  };
};

/**
 * Sustitución oficial por mando (ADMIN ONLY)
 * Cuando la unidad determina que debe sustituirse a un usuario de forma oficial por otro compañero.
 * - Mantiene personaIdOriginal = titular original
 * - Establece personaIdReal = compañero sustituto
 * - Registra en audit_logs de forma pormenorizada
 */
export const sustituirTitularOficialAdmin = async (params: {
  cuadranteId: string;
  servicioId: string;
  fechaServicio: string;
  slotTipo: 'cabo_1' | 'cabo_2' | 'soldado_1' | 'soldado_2';
  personaOriginal: Persona;
  personaSustituta: Persona;
  motivoSustitucion: string;
  adminInfo: { uid: string; nombre: string };
  personas: Persona[];
}): Promise<{ success: boolean; message: string }> => {
  const {
    cuadranteId,
    servicioId,
    fechaServicio,
    slotTipo,
    personaOriginal,
    personaSustituta,
    motivoSustitucion,
    adminInfo,
    personas,
  } = params;

  if (personaOriginal.empleo !== personaSustituta.empleo) {
    return {
      success: false,
      message: `El sustituto debe tener el mismo empleo (${personaOriginal.empleo}) que el titular original.`,
    };
  }

  const modRes = await modificarServicioManual({
    cuadranteId,
    servicioId,
    slotTipo,
    nuevaPersonaId: personaSustituta.id,
    motivo: `SUSTITUCIÓN OFICIAL POR MANDO: ${motivoSustitucion}. Titular original: ${personaOriginal.nombre} -> Sustituto asignado: ${personaSustituta.nombre}`,
    personas,
    adminInfo,
  });

  if (!modRes.success) {
    return { success: false, message: modRes.message };
  }

  await registrarAuditLog({
    adminUid: adminInfo.uid,
    adminNombre: adminInfo.nombre,
    accion: 'CAMBIAR_TITULAR',
    cuadranteId,
    fechaAfectada: fechaServicio,
    personaIdOriginal: personaOriginal.id,
    personaIdReal: personaSustituta.id,
    personaNombre: personaSustituta.nombre,
    motivo: motivoSustitucion,
    detalles: `Sustitución oficial ordenada por ${adminInfo.nombre}. Servicio del ${fechaServicio}. Titular original ${personaOriginal.nombre} (${personaOriginal.empleo}) relevado oficialmente por ${personaSustituta.nombre} (${personaSustituta.empleo}).`,
  });

  await crearNotificacion({
    tipo: 'AVISO_IMPORTANTE',
    titulo: 'Asignación Oficial de Sustitución',
    mensaje: `Has sido asignado oficialmente por el mando para cubrir la guardia del ${fechaServicio} en sustitución de ${personaOriginal.nombre}.`,
    destinatarioPersonaId: personaSustituta.id,
    cuadranteId,
    servicioId,
  });

  return {
    success: true,
    message: `Sustitución oficial completada. ${personaSustituta.nombre} asignado como titular real para el ${fechaServicio}.`,
  };
};

export const ratificarCoberturaAdmin = async (params: {
  incidencia: IncidenciaAusencia;
  adminInfo: { uid: string; nombre: string };
  cuadranteId: string;
  servicios?: ServicioDia[];
  personas?: Persona[];
}): Promise<{ success: boolean; message: string }> => {
  const personasList = params.personas || (await getPersonas());
  return resolverIncidenciaAdmin({
    incidenciaId: params.incidencia.id,
    aprobada: true,
    adminInfo: params.adminInfo,
    personas: personasList,
  });
};


