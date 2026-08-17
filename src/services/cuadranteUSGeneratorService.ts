import {
  Persona,
  CuadranteMaestro,
  ServicioDia,
  CuadranteSimulacionResult,
  ServicioAsignacion,
} from '../types';
import { generarRangoFechas } from './cuadranteGeneratorService';
import { calcularMetricasCuadrante } from './cuadranteMetricsService';

/**
 * Generador de Cuadrantes para la Unidad de Seguridad (U.S.)
 *
 * Características específicas U.S.:
 * - Turnos de 12 horas:
 *   * Turno Diurno: 08:00 a 20:00
 *   * Turno Nocturno: 20:00 a 08:00
 * - Personal propio exclusivo de U.S. (tipoUnidad: 'US' / unidad: 'US_SEGURIDAD')
 * - Rotación circular equitativa entre operadores y cabos de seguridad.
 * - Desacoplado al 100% de la Unidad de Guardia de 24h.
 */
export const generarSimulacionCuadranteUS = (params: {
  nombre: string;
  cicloId: string;
  fechaInicio: string; // YYYY-MM-DD (ej: 2026-10-01)
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

  // Filtrar personas exclusivas de US
  const usPersonas = personasActivas.filter(
    (p) => (p.tipoUnidad || (p.unidad === 'US_SEGURIDAD' ? 'US' : 'GUARDIA')) === 'US'
  );

  if (usPersonas.length < 4) {
    throw new Error('La Unidad de Seguridad (U.S.) requiere al menos 4 efectivos activos para generar la cobertura de 12h.');
  }

  const cabosUS = usPersonas
    .filter((p) => p.empleo === 'CABO')
    .sort((a, b) => (a.ordenRotacion ?? 999) - (b.ordenRotacion ?? 999));

  const soldadosUS = usPersonas
    .filter((p) => p.empleo === 'SOLDADO')
    .sort((a, b) => (a.ordenRotacion ?? 999) - (b.ordenRotacion ?? 999));

  const fechas = generarRangoFechas(fechaInicio, fechaFin);
  const cuadranteId = `cuadrante-us-${Date.now()}`;

  let punteroCabo = 0;
  let punteroSoldado = 0;

  const serviciosCompletos: ServicioDia[] = [];

  fechas.forEach((fechaStr, index) => {
    const fechaObj = new Date(fechaStr);
    const diaSemana = fechaObj.getDay();
    const esFinDeSemana = diaSemana === 0 || diaSemana === 6;

    // Asignar Cabos y Soldados de turno US
    const c1 = cabosUS.length > 0 ? cabosUS[punteroCabo % cabosUS.length] : usPersonas[0];
    const c2 = cabosUS.length > 1 ? cabosUS[(punteroCabo + 1) % cabosUS.length] : usPersonas[1 % usPersonas.length];

    const s1 = soldadosUS.length > 0 ? soldadosUS[punteroSoldado % soldadosUS.length] : usPersonas[2 % usPersonas.length];
    const s2 = soldadosUS.length > 1 ? soldadosUS[(punteroSoldado + 1) % soldadosUS.length] : usPersonas[3 % usPersonas.length];

    const cImag = cabosUS.length > 2 ? cabosUS[(punteroCabo + 2) % cabosUS.length] : c1;
    const sImag = soldadosUS.length > 2 ? soldadosUS[(punteroSoldado + 2) % soldadosUS.length] : s1;

    const crearAsignacion = (personaId: string, empleo: 'CABO' | 'SOLDADO'): ServicioAsignacion => ({
      personaIdOriginal: personaId,
      personaIdReal: personaId,
      empleoRequerido: empleo,
      estadoAsignacion: 'PROGRAMADO',
      tipoOrigen: 'GENERADO_AUTOMATICO',
    });

    const asignacionC1 = crearAsignacion(c1.id, 'CABO');
    const asignacionC2 = crearAsignacion(c2.id, 'CABO');
    const asignacionS1 = crearAsignacion(s1.id, 'SOLDADO');
    const asignacionS2 = crearAsignacion(s2.id, 'SOLDADO');
    const asignacionCImag = crearAsignacion(cImag.id, 'CABO');
    const asignacionSImag = crearAsignacion(sImag.id, 'SOLDADO');

    serviciosCompletos.push({
      id: `srv-us-${cuadranteId}-${fechaStr}`,
      cuadranteId,
      fecha: fechaStr,
      esFinDeSemana,
      diaSemana,
      horaInicio: '08:00',
      horaFin: '20:00',
      titulares: {
        cabos: [asignacionC1, asignacionC2],
        soldados: [asignacionS1, asignacionS2],
      },
      imaginarias: {
        cabo: asignacionCImag,
        soldado: asignacionSImag,
      },
      tieneModificacionesManuales: false,
      observaciones: `Turno U.S. (12h): Diurno (08:00-20:00) / Nocturno (20:00-08:00)`,
      ultimaActualizacion: new Date().toISOString(),
    });

    punteroCabo += 1;
    punteroSoldado += 2;
  });

  const now = new Date().toISOString();
  const metricas = calcularMetricasCuadrante(serviciosCompletos, usPersonas);

  const cuadrante: CuadranteMaestro = {
    id: cuadranteId,
    nombre,
    cicloId,
    tipoUnidad: 'US',
    unidadId: 'US',
    fechaInicio,
    fechaFin,
    totalDias: fechas.length,
    totalPersonas: usPersonas.length,
    totalCabos: cabosUS.length,
    totalSoldados: soldadosUS.length,
    estado: 'CONFIRMADO',
    metricasEquilibrio: metricas,
    fechaCreacion: now,
    creadoPorUid,
    creadoPorNombre: creadoPorNombre || 'Administración U.S.',
  };

  return {
    cuadrante,
    servicios: serviciosCompletos,
    metricas,
    validacion: {
      valido: true,
      totalErrores: 0,
      totalAdvertencias: 0,
      items: [],
    },
  };
};
