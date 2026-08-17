import {
  ServicioDia,
  DiferenciaCuadrante,
  ResultadoComparacionCuadrante,
  Persona,
} from '../types';

/**
 * Servicio preparado para contrastar el cuadrante generado contra un cuadrante real de ~6 meses.
 * Permite detectar divergencias, cambios manuales, permutas y calibrar el algoritmo en FASE 2C.
 */
export const compararCuadrantes = (params: {
  serviciosReales: {
    fecha: string;
    cabo1Nombre: string;
    cabo2Nombre: string;
    soldado1Nombre: string;
    soldado2Nombre: string;
    caboImagNombre: string;
    soldadoImagNombre: string;
  }[];
  serviciosGenerados: ServicioDia[];
  personas: Persona[];
}): ResultadoComparacionCuadrante => {
  const { serviciosReales, serviciosGenerados, personas } = params;
  const personasMap = new Map<string, Persona>();
  personas.forEach((p) => personasMap.set(p.id, p));

  const generadosPorFecha = new Map<string, ServicioDia>();
  serviciosGenerados.forEach((s) => generadosPorFecha.set(s.fecha, s));

  const diferencias: DiferenciaCuadrante[] = [];
  let totalPuestos = 0;
  let coincidencias = 0;

  serviciosReales.forEach((real) => {
    const gen = generadosPorFecha.get(real.fecha);
    if (!gen) return;

    const puestosAComparar: {
      tipo: DiferenciaCuadrante['tipoPuesto'];
      nombreReal: string;
      idGen: string;
    }[] = [
      {
        tipo: 'CABO_TITULAR_1',
        nombreReal: real.cabo1Nombre,
        idGen: gen.titulares.cabos[0]?.personaIdReal,
      },
      {
        tipo: 'CABO_TITULAR_2',
        nombreReal: real.cabo2Nombre,
        idGen: gen.titulares.cabos[1]?.personaIdReal,
      },
      {
        tipo: 'SOLDADO_TITULAR_1',
        nombreReal: real.soldado1Nombre,
        idGen: gen.titulares.soldados[0]?.personaIdReal,
      },
      {
        tipo: 'SOLDADO_TITULAR_2',
        nombreReal: real.soldado2Nombre,
        idGen: gen.titulares.soldados[1]?.personaIdReal,
      },
      {
        tipo: 'CABO_IMAGINARIA',
        nombreReal: real.caboImagNombre,
        idGen: gen.imaginarias.cabo?.personaIdReal,
      },
      {
        tipo: 'SOLDADO_IMAGINARIA',
        nombreReal: real.soldadoImagNombre,
        idGen: gen.imaginarias.soldado?.personaIdReal,
      },
    ];

    puestosAComparar.forEach((p) => {
      totalPuestos++;
      const pGen = personasMap.get(p.idGen);
      const nombreGen = pGen ? pGen.nombre : '';

      // Comparación normalizada
      const normalizar = (s: string) =>
        s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      const coincide = normalizar(p.nombreReal) === normalizar(nombreGen);

      if (coincide) {
        coincidencias++;
      } else {
        diferencias.push({
          fecha: real.fecha,
          tipoPuesto: p.tipo,
          personaRealNombre: p.nombreReal,
          personaGeneradaId: p.idGen,
          personaGeneradaNombre: nombreGen,
          coincide: false,
        });
      }
    });
  });

  const porcentaje =
    totalPuestos > 0
      ? Number(((coincidencias / totalPuestos) * 100).toFixed(1))
      : 0;

  return {
    totalDiasAnalizados: serviciosReales.length,
    totalPuestosEvaluados: totalPuestos,
    coincidenciasExactas: coincidencias,
    porcentajeFidelidad: porcentaje,
    diferencias,
    analisisCausas: {
      diferenciasPorOrdenInicial: 0,
      diferenciasPorImaginarias: 0,
      ajustesManualesDetectados: 0,
    },
  };
};
