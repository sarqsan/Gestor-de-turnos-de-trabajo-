import {
  ServicioDia,
  Persona,
  MetricasCuadrante,
  MetricasIndividuales,
  MetricasResumenEmpleo,
  Empleo,
} from '../types';

/**
 * Calcula la desviación estándar de un arreglo de números
 */
const calcularDesviacionEstandar = (numeros: number[], media: number): number => {
  if (numeros.length <= 1) return 0;
  const sumaCuadrados = numeros.reduce(
    (acc, val) => acc + Math.pow(val - media, 2),
    0
  );
  return Math.sqrt(sumaCuadrados / numeros.length);
};

/**
 * Calcula el resumen de métricas para un empleo (CABO o SOLDADO)
 */
const calcularResumenEmpleo = (
  metricasPersonas: MetricasIndividuales[]
): MetricasResumenEmpleo => {
  const totalEfectivos = metricasPersonas.length;
  if (totalEfectivos === 0) {
    return {
      totalEfectivos: 0,
      serviciosMin: 0,
      serviciosMax: 0,
      diferenciaServicios: 0,
      desviacionEstandarServicios: 0,
      imaginariasMin: 0,
      imaginariasMax: 0,
      diferenciaImaginarias: 0,
      desviacionEstandarImaginarias: 0,
      promedioServicios: 0,
      promedioImaginarias: 0,
    };
  }

  const serviciosArr = metricasPersonas.map((m) => m.totalServicios);
  const imaginariasArr = metricasPersonas.map((m) => m.totalDiasImaginaria);

  const serviciosMin = Math.min(...serviciosArr);
  const serviciosMax = Math.max(...serviciosArr);
  const diferenciaServicios = serviciosMax - serviciosMin;
  const promedioServicios =
    serviciosArr.reduce((a, b) => a + b, 0) / totalEfectivos;
  const desviacionEstandarServicios = Number(
    calcularDesviacionEstandar(serviciosArr, promedioServicios).toFixed(2)
  );

  const imaginariasMin = Math.min(...imaginariasArr);
  const imaginariasMax = Math.max(...imaginariasArr);
  const diferenciaImaginarias = imaginariasMax - imaginariasMin;
  const promedioImaginarias =
    imaginariasArr.reduce((a, b) => a + b, 0) / totalEfectivos;
  const desviacionEstandarImaginarias = Number(
    calcularDesviacionEstandar(imaginariasArr, promedioImaginarias).toFixed(2)
  );

  return {
    totalEfectivos,
    serviciosMin,
    serviciosMax,
    diferenciaServicios,
    desviacionEstandarServicios,
    imaginariasMin,
    imaginariasMax,
    diferenciaImaginarias,
    desviacionEstandarImaginarias,
    promedioServicios: Number(promedioServicios.toFixed(1)),
    promedioImaginarias: Number(promedioImaginarias.toFixed(1)),
  };
};

/**
 * Calcula todas las métricas del cuadrante y su puntuación de equilibrio global
 */
export const calcularMetricasCuadrante = (
  servicios: ServicioDia[],
  personas: Persona[]
): MetricasCuadrante => {
  const detallePorPersona: Record<string, MetricasIndividuales> = {};

  // Inicializar registros de métricas por persona
  personas.forEach((p) => {
    detallePorPersona[p.id] = {
      personaId: p.id,
      nombre: p.nombre,
      empleo: p.empleo,
      unidad: p.unidad,
      ordenRotacion: p.ordenRotacion,
      totalServicios: 0,
      serviciosSabado: 0,
      serviciosDomingo: 0,
      totalFinDeSemana: 0,
      totalDiasImaginaria: 0,
      bloquesImaginaria: 0,
      descansoMedioDias: 0,
      descansoMinimoDias: 0,
    };
  });

  // Mapa de fechas de servicios por persona para calcular descansos
  const fechasServiciosPorPersona = new Map<string, string[]>();
  // Mapa de fechas de imaginarias por persona para contar bloques
  const fechasImaginariasPorPersona = new Map<string, string[]>();

  personas.forEach((p) => {
    fechasServiciosPorPersona.set(p.id, []);
    fechasImaginariasPorPersona.set(p.id, []);
  });

  // Procesar cada día de servicio
  servicios.forEach((dia) => {
    const fecha = dia.fecha;
    const dateObj = new Date(fecha);
    const diaSemana = dateObj.getDay(); // 0 = Domingo, 6 = Sábado
    const esSabado = diaSemana === 6;
    const esDomingo = diaSemana === 0;
    const esFinSemana = esSabado || esDomingo;

    // Titulares
    const titularesIds = [
      dia.titulares.cabos[0]?.personaIdReal,
      dia.titulares.cabos[1]?.personaIdReal,
      dia.titulares.soldados[0]?.personaIdReal,
      dia.titulares.soldados[1]?.personaIdReal,
    ].filter(Boolean);

    titularesIds.forEach((pId) => {
      const metric = detallePorPersona[pId];
      if (metric) {
        metric.totalServicios++;
        if (esSabado) metric.serviciosSabado++;
        if (esDomingo) metric.serviciosDomingo++;
        if (esFinSemana) metric.totalFinDeSemana++;
        fechasServiciosPorPersona.get(pId)?.push(fecha);
      }
    });

    // Imaginarias
    const imagIds = [
      dia.imaginarias.cabo?.personaIdReal,
      dia.imaginarias.soldado?.personaIdReal,
    ].filter(Boolean);

    imagIds.forEach((pId) => {
      const metric = detallePorPersona[pId];
      if (metric) {
        metric.totalDiasImaginaria++;
        fechasImaginariasPorPersona.get(pId)?.push(fecha);
      }
    });
  });

  // Calcular descansos e intervalos por persona
  personas.forEach((p) => {
    const metric = detallePorPersona[p.id];
    if (!metric) return;

    // Descansos entre servicios
    const srvFechas = (fechasServiciosPorPersona.get(p.id) || []).sort();
    if (srvFechas.length > 1) {
      const descansos: number[] = [];
      for (let i = 0; i < srvFechas.length - 1; i++) {
        const d1 = new Date(srvFechas[i]);
        const d2 = new Date(srvFechas[i + 1]);
        const diffDias = Math.round(
          (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)
        ) - 1; // Días libres estrictos entre guardias
        descansos.push(diffDias);
      }

      const sumaDescansos = descansos.reduce((a, b) => a + b, 0);
      metric.descansoMedioDias = Number((sumaDescansos / descansos.length).toFixed(1));
      metric.descansoMinimoDias = Math.min(...descansos);
    } else {
      metric.descansoMedioDias = 0;
      metric.descansoMinimoDias = 0;
    }

    // Contar bloques de imaginaria (días consecutivos se consideran 1 bloque)
    const imagFechas = (fechasImaginariasPorPersona.get(p.id) || []).sort();
    if (imagFechas.length > 0) {
      let bloques = 1;
      for (let i = 0; i < imagFechas.length - 1; i++) {
        const d1 = new Date(imagFechas[i]);
        const d2 = new Date(imagFechas[i + 1]);
        const diffDias = Math.round(
          (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diffDias > 1) {
          bloques++;
        }
      }
      metric.bloquesImaginaria = bloques;
    } else {
      metric.bloquesImaginaria = 0;
    }
  });

  const cabosMetricas = Object.values(detallePorPersona).filter(
    (m) => m.empleo === 'CABO'
  );
  const soldadosMetricas = Object.values(detallePorPersona).filter(
    (m) => m.empleo === 'SOLDADO'
  );

  const resumenCabos = calcularResumenEmpleo(cabosMetricas);
  const resumenSoldados = calcularResumenEmpleo(soldadosMetricas);

  // Cálculo de Puntuación Global de Equilibrio (0 a 100)
  // Penaliza diferencias de servicios (> 1), diferencias de imaginarias (> 2) y varianza en fines de semana
  let score = 100;

  // Penalización por diferencia de servicios
  score -= resumenCabos.diferenciaServicios * 8;
  score -= resumenSoldados.diferenciaServicios * 8;

  // Penalización por dispersión de imaginarias
  score -= Math.max(0, resumenCabos.diferenciaImaginarias - 1) * 4;
  score -= Math.max(0, resumenSoldados.diferenciaImaginarias - 1) * 4;

  // Penalización por desviación estándar
  score -= (resumenCabos.desviacionEstandarServicios + resumenSoldados.desviacionEstandarServicios) * 5;

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    scoreEquilibrio: score,
    cabos: resumenCabos,
    soldados: resumenSoldados,
    detallePorPersona,
  };
};
