import {
  Persona,
  CuadranteMaestro,
  ServicioDia,
  CuadranteSimulacionResult,
  ServicioAsignacion,
} from '../types';
import { defaultImaginariaStrategy } from './imaginariaStrategy';
import { validarCuadrante, validarCapacidadPlantilla } from './cuadranteValidatorService';
import { calcularMetricasCuadrante } from './cuadranteMetricsService';

/**
 * Genera la lista de fechas consecutivas en formato YYYY-MM-DD
 */
export const generarRangoFechas = (fechaInicioStr: string, fechaFinStr: string): string[] => {
  const fechas: string[] = [];
  const inicio = new Date(fechaInicioStr);
  const fin = new Date(fechaFinStr);

  const cursor = new Date(inicio);
  while (cursor <= fin) {
    fechas.push(cursor.toISOString().split('T')[0]);
    cursor.setDate(cursor.getDate() + 1);
  }

  return fechas;
};

/**
 * Motor de simulación matemática inicial para generación de cuadrantes (FASE 2B).
 *
 * CARACTERÍSTICAS:
 * - Opera 100% EN MEMORIA (no escribe en Firestore).
 * - Valida previamente la capacidad matemática y reglamentaria de la plantilla (mín. 21 efectivos, mín. 6 Cabos).
 * - Desacopla la rotación de CABOS y SOLDADOS en dos colas circulares independientes.
 * - Soporta plantillas dinámicas de 21, 22, 23 o cualquier número válido de personal.
 * - Respeta el orden de rotación explícito (`ordenRotacion`) de cada persona.
 * - Asigna 2 Cabos y 2 Soldados titulares diarios.
 * - Asigna 1 Cabo y 1 Soldado de imaginaria en bloques dinámicos respetando D-1, D y D+1.
 * - Audita restricciones y calcula métricas de equilibrio.
 */
export const generarSimulacionCuadrante = (params: {
  nombre: string;
  cicloId: string;
  fechaInicio: string; // YYYY-MM-DD
  fechaFin: string; // YYYY-MM-DD
  personasActivas: Persona[];
  creadoPorUid: string;
  creadoPorNombre?: string;
}): CuadranteSimulacionResult => {
  const {
    nombre,
    cicloId,
    fechaInicio,
    fechaFin,
    personasActivas,
    creadoPorUid,
    creadoPorNombre,
  } = params;

  // Validación previa de capacidad reglamentaria
  const capacidad = validarCapacidadPlantilla(personasActivas);
  if (!capacidad.viable) {
    throw new Error(capacidad.motivoBloqueo || 'Plantilla insuficiente para generar el cuadrante');
  }

  const fechas = generarRangoFechas(fechaInicio, fechaFin);
  const totalDias = fechas.length;

  // 1. Filtrar y ordenar personal por empleo y por ordenRotacion ASC
  const cabos = personasActivas
    .filter((p) => p.empleo === 'CABO')
    .sort((a, b) => (a.ordenRotacion ?? 999) - (b.ordenRotacion ?? 999));

  const soldados = personasActivas
    .filter((p) => p.empleo === 'SOLDADO')
    .sort((a, b) => (a.ordenRotacion ?? 999) - (b.ordenRotacion ?? 999));

  const totalCabos = cabos.length;
  const totalSoldados = soldados.length;

  const cuadranteId = `cuadrante-${Date.now()}`;

  // 2. FASE A: Asignación de Titulares mediante dos colas circulares independientes
  let punteroCabo = 0;
  let punteroSoldado = 0;

  const diasServicioPorPersona = new Map<string, Set<string>>();
  personasActivas.forEach((p) => diasServicioPorPersona.set(p.id, new Set()));

  const serviciosBorrador: Partial<ServicioDia>[] = [];

  fechas.forEach((fechaStr) => {
    const fechaObj = new Date(fechaStr);
    const diaSemana = fechaObj.getDay();
    const esFinDeSemana = diaSemana === 0 || diaSemana === 6;

    // Seleccionar 2 Cabos
    const c1 = cabos[punteroCabo % totalCabos];
    const c2 = cabos[(punteroCabo + 1) % totalCabos];
    punteroCabo = (punteroCabo + 2) % totalCabos;

    // Seleccionar 2 Soldados
    const s1 = soldados[punteroSoldado % totalSoldados];
    const s2 = soldados[(punteroSoldado + 1) % totalSoldados];
    punteroSoldado = (punteroSoldado + 2) % totalSoldados;

    // Registrar fechas de servicio para la exclusión de imaginarias
    if (c1) diasServicioPorPersona.get(c1.id)?.add(fechaStr);
    if (c2) diasServicioPorPersona.get(c2.id)?.add(fechaStr);
    if (s1) diasServicioPorPersona.get(s1.id)?.add(fechaStr);
    if (s2) diasServicioPorPersona.get(s2.id)?.add(fechaStr);

    const asignacionCabo1: ServicioAsignacion = {
      personaIdOriginal: c1.id,
      personaIdReal: c1.id,
      empleoRequerido: 'CABO',
      estadoAsignacion: 'PROGRAMADO',
      tipoOrigen: 'GENERADO_AUTOMATICO',
    };

    const asignacionCabo2: ServicioAsignacion = {
      personaIdOriginal: c2.id,
      personaIdReal: c2.id,
      empleoRequerido: 'CABO',
      estadoAsignacion: 'PROGRAMADO',
      tipoOrigen: 'GENERADO_AUTOMATICO',
    };

    const asignacionSoldado1: ServicioAsignacion = {
      personaIdOriginal: s1.id,
      personaIdReal: s1.id,
      empleoRequerido: 'SOLDADO',
      estadoAsignacion: 'PROGRAMADO',
      tipoOrigen: 'GENERADO_AUTOMATICO',
    };

    const asignacionSoldado2: ServicioAsignacion = {
      personaIdOriginal: s2.id,
      personaIdReal: s2.id,
      empleoRequerido: 'SOLDADO',
      estadoAsignacion: 'PROGRAMADO',
      tipoOrigen: 'GENERADO_AUTOMATICO',
    };

    serviciosBorrador.push({
      id: `SRV-${fechaStr}`,
      cuadranteId,
      fecha: fechaStr,
      diaSemana,
      esFinDeSemana,
      horaInicio: '08:00',
      horaFin: '08:00',
      titulares: {
        cabos: [asignacionCabo1, asignacionCabo2],
        soldados: [asignacionSoldado1, asignacionSoldado2],
      },
      tieneModificacionesManuales: false,
      ultimaActualizacion: new Date().toISOString(),
    });
  });

  // 3. FASE B: Asignación de Imaginarias mediante la estrategia dinámica
  const { caboImaginariaPorDia, soldadoImaginariaPorDia } =
    defaultImaginariaStrategy.asignarImaginarias({
      diasFechas: fechas,
      serviciosTitulares: serviciosBorrador,
      cabos,
      soldados,
      diasServicioPorPersona,
    });

  // 4. Construir arreglo final de ServicioDia
  const servicios: ServicioDia[] = serviciosBorrador.map((borrador) => {
    const fecha = borrador.fecha!;
    const cImag = caboImaginariaPorDia.get(fecha) || cabos[0];
    const sImag = soldadoImaginariaPorDia.get(fecha) || soldados[0];

    const asignacionCaboImag: ServicioAsignacion = {
      personaIdOriginal: cImag.id,
      personaIdReal: cImag.id,
      empleoRequerido: 'CABO',
      estadoAsignacion: 'PROGRAMADO',
      tipoOrigen: 'GENERADO_AUTOMATICO',
    };

    const asignacionSoldadoImag: ServicioAsignacion = {
      personaIdOriginal: sImag.id,
      personaIdReal: sImag.id,
      empleoRequerido: 'SOLDADO',
      estadoAsignacion: 'PROGRAMADO',
      tipoOrigen: 'GENERADO_AUTOMATICO',
    };

    return {
      ...borrador,
      imaginarias: {
        cabo: asignacionCaboImag,
        soldado: asignacionSoldadoImag,
      },
    } as ServicioDia;
  });

  // 5. FASE C: Métricas y Validación
  const metricas = calcularMetricasCuadrante(servicios, personasActivas);
  const validacion = validarCuadrante(servicios, personasActivas);

  const cuadrante: CuadranteMaestro = {
    id: cuadranteId,
    cicloId,
    nombre,
    fechaInicio,
    fechaFin,
    totalDias,
    totalPersonas: personasActivas.length,
    totalCabos,
    totalSoldados,
    estado: 'SIMULACION',
    metricasEquilibrio: metricas,
    fechaCreacion: new Date().toISOString(),
    creadoPorUid,
    creadoPorNombre: creadoPorNombre || 'Administrador',
  };

  return {
    cuadrante,
    servicios,
    metricas,
    validacion,
  };
};
