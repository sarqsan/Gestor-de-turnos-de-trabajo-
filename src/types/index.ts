export type Empleo = 'CABO' | 'SOLDADO';

export type Unidad = 'GOE III' | 'GOE IV' | 'BOEL XIX' | 'GCG' | 'ULOE' | 'US_SEGURIDAD';

export type TipoUnidad = 'GUARDIA' | 'US';

export const UNIDADES_VALIDAS: Unidad[] = [
  'GOE III',
  'GOE IV',
  'BOEL XIX',
  'GCG',
  'ULOE',
  'US_SEGURIDAD',
];

export type RolUsuario = 'ADMIN' | 'USUARIO';

export type EstadoAcceso = 'SIN_CUENTA' | 'INVITACION_PENDIENTE' | 'ACTIVA' | 'DESACTIVADA';

export interface Persona {
  id: string; // Identificador único permanente del sistema
  nombre: string;
  empleo: Empleo;
  unidad: Unidad;
  dni: string; // Identificador oficial para vinculación de ciclos
  telefono: string; // Teléfono de contacto operativo para coberturas
  activo: boolean; // true = activo en el grupo actual, false = histórico/inactivo
  ordenRotacion?: number; // Posición asignada para el ciclo actual (1, 2, 3...)
  cicloId?: string; // Ciclo o promoción (ej: "2026-A", "2027-A")
  tipoUnidad?: TipoUnidad; // GUARDIA (24h) | SEGURIDAD (12h)
  notas?: string;
  fechaCreacion: string; // ISO string
  fechaActualizacion: string; // ISO string
}

export interface Cuenta {
  id: string;
  uid: string; // Firebase Auth UID
  personaId: string | null; // ID de la persona vinculada (si aplica)
  email: string;
  nombre: string;
  rol: RolUsuario;
  activo: boolean;
  telefono?: string;
  dni?: string;
  firma?: string; // Firma electrónica (data URL / PNG base64)
  fechaFirma?: string;
  requiereCambioCredenciales?: boolean; // true en primer acceso con DNI
  tipoUnidad?: TipoUnidad;
  fechaCreacion: string;
  ultimoAcceso: string;
}

export type TipoAccionAudit =
  | 'CREAR_PERSONA'
  | 'MODIFICAR_PERSONA'
  | 'ACTIVAR_PERSONA'
  | 'DESACTIVAR_PERSONA'
  | 'IMPORTAR_PERSONAL'
  | 'SIMULAR_IMPORTACION'
  | 'CREAR_CUENTA'
  | 'ACTIVAR_CUENTA'
  | 'DESACTIVAR_CUENTA'
  | 'MODIFICAR_ROL'
  | 'GENERAR_INVITACION'
  | 'INICIO_SESION'
  | 'SISTEMA_RESETEO'
  | 'GENERAR_CUADRANTE'
  | 'CONFIRMAR_CUADRANTE'
  | 'MODIFICAR_SERVICIO_MANUAL'
  | 'CAMBIAR_TITULAR'
  | 'PUBLICAR_CUADRANTE'
  | 'ARCHIVAR_CUADRANTE'
  | 'SOLICITAR_CAMBIO'
  | 'ACEPTAR_CAMBIO'
  | 'RECHAZAR_CAMBIO'
  | 'APROBAR_CAMBIO'
  | 'RECHAZAR_CAMBIO_ADMIN'
  | 'COMUNICAR_AUSENCIA'
  | 'SOLICITAR_COBERTURA'
  | 'ACEPTAR_COBERTURA'
  | 'APROBAR_COBERTURA'
  | 'RECHAZAR_COBERTURA'
  | 'ENVIAR_MENSAJE_ADMIN'
  | 'MODIFICAR_ORDEN_ROTACION'
  | 'IMPORTAR_NUEVO_CICLO'
  | 'CREAR_CICLO'
  | 'CONFIRMAR_IMAGINARIA_RECEPCION'
  | 'ACTIVAR_IMAGINARIA_COBERTURA'
  | 'MODO_ADMIN_VER_COMO_USUARIO_INICIO'
  | 'MODO_ADMIN_VER_COMO_USUARIO_FIN';

export interface AuditLog {
  id: string;
  timestamp: string; // ISO string
  adminUid: string;
  adminNombre: string;
  accion: TipoAccionAudit;
  cuadranteId?: string;
  fechaAfectada?: string;
  personaId?: string;
  personaNombre?: string;
  personaIdOriginal?: string;
  personaIdReal?: string;
  detalles: string;
  motivo?: string;
  cambios?: {
    campo: string;
    anterior: any;
    nuevo: any;
  }[];
}

export interface CicloPersonal {
  id: string;
  nombre: string;
  fechaInicio: string;
  fechaFin?: string;
  activo: boolean;
  descripcion?: string;
}

// ----------------------------------------------------
// TIPOS DE CUADRANTE Y MOTOR DE ROTACIÓN (FASE 2)
// ----------------------------------------------------

export type EstadoCuadrante = 'SIMULACION' | 'CONFIRMADO' | 'HISTORICO' | 'ARCHIVADO';

export type TipoOrigenAsignacion = 'GENERADO_AUTOMATICO' | 'MODIFICADO_MANUAL';

export type EstadoAsignacion =
  | 'PROGRAMADO'
  | 'REALIZADO'
  | 'CAMBIADO'
  | 'CUBIERTO_POR_IMAGINARIA';

export interface ServicioAsignacion {
  personaIdOriginal: string; // Titular asignado por el generador (inmutable)
  personaIdReal: string;     // Titular final (modificable por cambio/cobertura)
  empleoRequerido: Empleo;
  estadoAsignacion: EstadoAsignacion;
  tipoOrigen: TipoOrigenAsignacion;
  motivoCambio?: string;
  modificadoPorUid?: string;
  fechaModificacion?: string;
}

export interface ServicioDia {
  id: string; // Canónico: "SRV-YYYY-MM-DD"
  cuadranteId: string;
  fecha: string; // YYYY-MM-DD
  diaSemana: number; // 0=Domingo, 1=Lunes, ..., 6=Sábado
  esFinDeSemana: boolean; // true si es Sábado o Domingo
  horaInicio: string; // "08:00"
  horaFin: string; // "08:00"

  // 4 Titulares Diarios de Guardia (2 Cabos + 2 Soldados)
  titulares: {
    cabos: [ServicioAsignacion, ServicioAsignacion];
    soldados: [ServicioAsignacion, ServicioAsignacion];
  };

  // 2 Efectivos Diarios de Alerta / Cobertura (1 Cabo + 1 Soldado)
  imaginarias: {
    cabo: ServicioAsignacion;
    soldado: ServicioAsignacion;
  };

  // Estado y Auditoría del Día
  tieneModificacionesManuales: boolean;
  observaciones?: string;
  ultimaActualizacion: string;
}

export interface MetricasIndividuales {
  personaId: string;
  nombre: string;
  empleo: Empleo;
  unidad: Unidad;
  ordenRotacion?: number;
  totalServicios: number;
  serviciosSabado: number;
  serviciosDomingo: number;
  totalFinDeSemana: number;
  totalDiasImaginaria: number;
  bloquesImaginaria: number;
  descansoMedioDias: number;
  descansoMinimoDias: number;
}

export interface MetricasResumenEmpleo {
  totalEfectivos: number;
  serviciosMin: number;
  serviciosMax: number;
  diferenciaServicios: number;
  desviacionEstandarServicios: number;
  imaginariasMin: number;
  imaginariasMax: number;
  diferenciaImaginarias: number;
  desviacionEstandarImaginarias: number;
  promedioServicios: number;
  promedioImaginarias: number;
}

export interface MetricasCuadrante {
  scoreEquilibrio: number; // 0 - 100
  cabos: MetricasResumenEmpleo;
  soldados: MetricasResumenEmpleo;
  detallePorPersona: Record<string, MetricasIndividuales>;
}

export interface ValidacionItem {
  codigo: string; // 'RD-01', 'RD-06', 'RB-01', etc.
  severidad: 'ERROR' | 'ADVERTENCIA';
  fecha?: string;
  personaId?: string;
  personaNombre?: string;
  descripcion: string;
  detalleConflicto?: string;
}

export interface InformeValidacion {
  valido: boolean;
  totalErrores: number;
  totalAdvertencias: number;
  items: ValidacionItem[];
}

export interface CuadranteMaestro {
  id: string;
  cicloId: string;
  nombre: string;
  tipoUnidad?: TipoUnidad;
  unidadId?: string;
  fechaInicio: string; // YYYY-MM-DD
  fechaFin: string; // YYYY-MM-DD
  totalDias: number;
  totalPersonas: number;
  totalCabos: number;
  totalSoldados: number;
  estado: EstadoCuadrante;
  metricasEquilibrio: MetricasCuadrante;
  fechaCreacion: string;
  creadoPorUid: string;
  creadoPorNombre?: string;
  fechaModificacion?: string;
  modificadoPorUid?: string;
}

export interface CuadranteSimulacionResult {
  cuadrante: CuadranteMaestro;
  servicios: ServicioDia[];
  metricas: MetricasCuadrante;
  validacion: InformeValidacion;
}

export interface DiferenciaCuadrante {
  fecha: string;
  tipoPuesto: 'CABO_TITULAR_1' | 'CABO_TITULAR_2' | 'SOLDADO_TITULAR_1' | 'SOLDADO_TITULAR_2' | 'CABO_IMAGINARIA' | 'SOLDADO_IMAGINARIA';
  personaRealId?: string;
  personaRealNombre: string;
  personaGeneradaId?: string;
  personaGeneradaNombre: string;
  coincide: boolean;
  comentarios?: string;
}

export interface ResultadoComparacionCuadrante {
  totalDiasAnalizados: number;
  totalPuestosEvaluados: number;
  coincidenciasExactas: number;
  porcentajeFidelidad: number;
  diferencias: DiferenciaCuadrante[];
  analisisCausas: {
    diferenciasPorOrdenInicial: number;
    diferenciasPorImaginarias: number;
    ajustesManualesDetectados: number;
  };
}

export interface ExcelRowParsed {
  rowNumber: number;
  nombre: string;
  empleo: string;
  unidad: string;
  dni: string;
  telefono: string;
  valid: boolean;
  errors: string[];
}

export interface ImportSimulationRow {
  nombre: string;
  empleo: Empleo;
  unidad: Unidad;
  dni: string;
  telefono: string;
  tipoAccion: 'NUEVA' | 'MODIFICADA' | 'SIN_CAMBIOS' | 'CAMBIO_EMPLEO' | 'DESACTIVAR' | 'REVISION_MANUAL';
  personaExistenteId?: string;
  motivo: string;
}

export interface ImportSimulationSummary {
  nuevas: number;
  modificadas: number;
  desactivadas: number;
  sinCambios: number;
  cambiosEmpleo: number;
  revisionManual: number;
  detalles: ImportSimulationRow[];
}

export interface ExcelValidationResult {
  isValid: boolean;
  totalCount: number;
  cabosCount: number;
  soldadosCount: number;
  unidadesCount: Record<Unidad, number>;
  validRows: ExcelRowParsed[];
  invalidRows: ExcelRowParsed[];
  generalErrors: string[];
  simulation?: ImportSimulationSummary;
}

export interface StatsPersonal {
  totalPersonal: number;
  personalActivo: number;
  personalInactivo: number;
  cabosActivos: number;
  soldadosActivos: number;
  unidadesActivas?: Record<Unidad, number>;
  cuentasActivas: number;
  cuentasPendientes: number;
  cuentasDesactivadas: number;
  totalCuentas: number;
}

// ----------------------------------------------------
// TIPOS OPERATIVOS FASE 3: CAMBIOS, AUSENCIAS, CHAT, NOTIFICACIONES
// ----------------------------------------------------

export type EstadoSolicitudCambio =
  | 'PENDIENTE_COMPAÑERO'
  | 'CONTRAOFERTA_COMPAÑERO'
  | 'ACEPTADA_COMPAÑERO'
  | 'RECHAZADA_COMPAÑERO'
  | 'PENDIENTE_ADMIN'
  | 'APROBADA_ADMIN'
  | 'RECHAZADA_ADMIN'
  | 'CANCELADA';

export type SlotServicioTipo =
  | 'cabo_1'
  | 'cabo_2'
  | 'soldado_1'
  | 'soldado_2'
  | 'cabo_imag'
  | 'soldado_imag'
  | 'imaginaria_cabo'
  | 'imaginaria_soldado';

export interface SolicitudCambio {
  id: string;
  cuadranteId: string;
  tipoUnidad?: TipoUnidad;
  unidadId?: string;
  servicioId: string;
  fechaServicio: string; // YYYY-MM-DD
  puesto: Empleo; // 'CABO' | 'SOLDADO'
  slotTipo: SlotServicioTipo;
  tipoCambio?: 'SERVICIO' | 'IMAGINARIA';

  // Solicitante (usuario A)
  solicitantePersonaId: string;
  solicitanteNombre: string;
  solicitanteEmpleo: Empleo;
  solicitanteUnidad: Unidad;
  solicitanteUid?: string;
  firmaSolicitante?: string;
  fechaFirmaSolicitante?: string;

  // Compañero solicitado (usuario B)
  destinatarioPersonaId: string;
  destinatarioNombre: string;
  destinatarioEmpleo: Empleo;
  destinatarioUnidad: Unidad;
  destinatarioUid?: string;
  firmaDestinatario?: string;
  fechaFirmaDestinatario?: string;

  // Servicio de devolución propuesto / acordado
  servicioDevolucionId?: string;
  servicioDevolucionFecha?: string;
  servicioDevolucionSlot?: SlotServicioTipo;

  // Contraofertas
  esContraoferta?: boolean;
  historialContraofertas?: {
    fecha: string;
    autorId: string;
    autorNombre: string;
    propuesta: string;
    servicioDevolucionId?: string;
    servicioDevolucionFecha?: string;
  }[];

  motivo?: string;
  fechaSolicitud: string; // ISO
  estado: EstadoSolicitudCambio;

  // Respuesta del compañero
  fechaRespuestaCompanero?: string;
  motivoRechazoCompanero?: string;

  // Resolución del Administrador
  fechaResolucionAdmin?: string;
  adminResolucionUid?: string;
  adminResolucionNombre?: string;
  firmaAdmin?: string;
  fechaFirmaAdmin?: string;
  motivoRechazoAdmin?: string;
  documentoFirmadoId?: string;

  // Validación de restricciones del motor
  esValido?: boolean;
  mensajeValidacion?: string;
}

export interface DocumentoCambioFirmado {
  id: string;
  solicitudId: string;
  codigoVerificacion: string;
  tipoCambio: 'SERVICIO' | 'IMAGINARIA';
  cuadranteId: string;
  fechaEmision: string;
  fechaServicioA: string;
  slotTipoA: SlotServicioTipo;
  personaA: {
    id: string;
    nombre: string;
    empleo: Empleo;
    unidad: Unidad;
    firma?: string;
    fechaFirma: string;
  };
  fechaServicioB?: string;
  slotTipoB?: SlotServicioTipo;
  personaB: {
    id: string;
    nombre: string;
    empleo: Empleo;
    unidad: Unidad;
    firma?: string;
    fechaFirma: string;
  };
  autorizacionAdmin: {
    adminUid: string;
    adminNombre: string;
    firma?: string;
    fechaAutorizacion: string;
    resolucion: 'AUTORIZADO';
  };
  detalles: string;
  motivo?: string;
}

export interface ConfirmacionImaginaria {
  confirmada: boolean;
  fechaHoraConfirmacion?: string;
  personaId: string;
  nombre: string;
  empleo: Empleo;
  titularSustituidoNombre: string;
  servicioFecha: string;
}

export type TipoAusencia = 'ENFERMEDAD' | 'INDISPOSICION' | 'OTRA_AUSENCIA';

export type EstadoIncidencia =
  | 'COMUNICADA_PENDIENTE_COBERTURA'
  | 'IMAGINARIA_ACTIVADA_COBERTURA'
  | 'COBERTURA_ACEPTADA_PENDIENTE_ADMIN'
  | 'RESUELTA_APROBADA'
  | 'RECHAZADA_ADMIN'
  | 'CANCELADA';

export interface IncidenciaAusencia {
  id: string;
  cuadranteId: string;
  tipoUnidad?: TipoUnidad;
  unidadId?: string;
  servicioId: string;
  fechaServicio: string; // YYYY-MM-DD
  horaInicio: string; // "08:00"
  horaFin: string; // "08:00"
  puesto: Empleo; // 'CABO' | 'SOLDADO'
  slotTipo: 'cabo_1' | 'cabo_2' | 'soldado_1' | 'soldado_2';

  titularPersonaId: string;
  titularNombre: string;
  titularEmpleo: Empleo;
  titularUnidad: Unidad;
  titularTelefono?: string;

  tipoAusencia: TipoAusencia;
  observaciones?: string;
  fechaComunicacion: string; // ISO timestamp
  horaExactaComunicacion: string; // HH:mm:ss o string localizado
  estadoMomentoServicio: 'ANTES_DE_INICIAR' | 'EN_CURSO' | 'MISMO_DIA' | 'DIA_SIGUIENTE';

  // Imaginaria asignada por empleo que es alertada (SOLO del mismo empleo)
  imaginariaNotificadaPersonaId: string;
  imaginariaNotificadaNombre: string;
  imaginariaNotificadaTelefono?: string;
  imaginariaCaboPersonaId?: string;
  imaginariaCaboNombre?: string;
  imaginariaSoldadoPersonaId?: string;
  imaginariaSoldadoNombre?: string;

  // Confirmación de recepción por la imaginaria
  confirmacionImaginaria?: ConfirmacionImaginaria;

  // Imaginaria que acepta cubrir
  imaginariaAceptantePersonaId?: string;
  imaginariaAceptanteNombre?: string;
  imaginariaAceptanteEmpleo?: Empleo;
  fechaAceptacionImaginaria?: string;

  // Estado y resolución
  estado: EstadoIncidencia;
  fechaResolucionAdmin?: string;
  adminResolucionUid?: string;
  adminResolucionNombre?: string;
  motivoRechazoAdmin?: string;

  // Documento médico adjunto (Almacenado en Firebase Storage, NUNCA base64 en Firestore)
  documentoUrl?: string;
  documentoNombre?: string;
  documentoPath?: string;

  // Análisis inteligente de parte médico con IA
  fechaInicioBaja?: string;
  fechaFinBaja?: string;
  diasDuracion?: number;
  estadoAnalisisIA?: 'PENDIENTE' | 'CONFIRMADO' | 'REVISION_MANUAL';
  motivoRevisionIA?: string;
  diagnosticoResumen?: string;

  // Alerta de servicios afectados (> 2 servicios)
  serviciosAfectadosCount?: number;
  serviciosAfectadosFechas?: string[];
  alertaMasDeDosServicios?: boolean;
}

export interface ParteMedico {
  id: string;
  personaId: string;
  personaNombre: string;
  personaEmpleo: Empleo;
  personaUnidad: Unidad;
  tipoUnidad?: TipoUnidad;
  unidadId?: string;
  fechaSubida: string; // ISO
  fechaInicio: string; // YYYY-MM-DD
  fechaFin?: string; // YYYY-MM-DD
  diasDuracion?: number;
  estadoAnalisisIA: 'PENDIENTE' | 'CONFIRMADO' | 'REVISION_MANUAL';
  motivoRevisionIA?: string;
  diagnosticoResumen?: string;
  documentoUrl: string; // URL en Firebase Storage
  documentoNombre: string;
  documentoPath: string;
  incidenciaId?: string;
  cuadranteId?: string;
  serviciosAfectadosFechas?: string[];
  serviciosAfectadosCount?: number;
  alertaMasDeDosServicios?: boolean;
  revisadoPorAdmin?: boolean;
  adminRevisionNombre?: string;
  fechaRevisionAdmin?: string;
}

export type TipoNotificacion =
  | 'NUEVA_SOLICITUD_CAMBIO'
  | 'SOLICITUD_ACEPTADA_COMPANERO'
  | 'SOLICITUD_RECHAZADA_COMPANERO'
  | 'SOLICITUD_PENDIENTE_ADMIN'
  | 'SOLICITUD_APROBADA_ADMIN'
  | 'SOLICITUD_RECHAZADA_ADMIN'
  | 'NUEVA_INCIDENCIA_AUSENCIA'
  | 'SOLICITUD_COBERTURA' // Enviada ÚNICAMENTE al Cabo y Soldado de imaginaria del servicio
  | 'COBERTURA_ACEPTADA'
  | 'COBERTURA_APROBADA'
  | 'COBERTURA_RECHAZADA'
  | 'MENSAJE_ADMINISTRATIVO'
  | 'AVISO_IMPORTANTE';

export interface Notificacion {
  id: string;
  tipoUnidad?: TipoUnidad;
  unidadId?: string;
  destinatarioPersonaId?: string; // Si es para una persona específica
  destinatarioUid?: string;
  destinatarioEmpleo?: Empleo; // Si es para un empleo
  esParaAdmin?: boolean; // Para los 2 administradores
  esParaTodos?: boolean; // General
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  fechaCreacion: string; // ISO
  leida: boolean;
  fechaLeida?: string;
  linkTab?: string;
  referenciaId?: string; // ID de solicitud, incidencia o mensaje
  cuadranteId?: string;
  servicioId?: string;
}

export type TipoMensajeChat = 'PRIVADO' | 'GRUPO' | 'ADMINISTRATIVO';
export type DestinoAdminMensaje = 'TODOS' | 'CABOS' | 'SOLDADOS' | 'UNIDAD' | 'INDIVIDUAL';

export interface MensajeChat {
  id: string;
  tipo: TipoMensajeChat;
  tipoUnidad?: TipoUnidad;
  unidadId?: string;
  conversacionId?: string; // Formato para privado: `${p1Id}_${p2Id}` ordenado alfabéticamente

  autorPersonaId?: string;
  autorUid: string;
  autorNombre: string;
  autorEmpleo?: Empleo;
  autorRol: RolUsuario;

  // Destinatario específico (para privado o individual)
  destinatarioPersonaId?: string;
  destinatarioNombre?: string;
  destinatarioUid?: string;
  destinatariosUids?: string[]; // Para verificar lectura y permisos

  // Destino de mensaje administrativo
  destinoAdmin?: DestinoAdminMensaje;
  unidadDestino?: Unidad;

  contenido: string;
  fechaHora: string; // ISO
  leidoPor: string[]; // Lista de UIDs que lo han leído
}

