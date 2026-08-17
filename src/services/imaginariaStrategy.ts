import { Persona, ServicioDia, Empleo } from '../types';

/**
 * Estrategia de asignación de imaginarias con ROTACIÓN CIRCULAR DETERMINISTA.
 *
 * REGLAS INVIOLABLES:
 * 1. 1 Cabo de imaginaria y 1 Soldado de imaginaria cada día (08:00 a 08:00).
 * 2. Correspondencia estricta de empleo (Cabo cubre Cabo, Soldado cubre Soldado).
 * 3. Si una persona tiene servicio en el día D:
 *    - PROHIBIDO ser imaginaria en D-1 (víspera)
 *    - PROHIBIDO ser imaginaria en D (día de servicio)
 *    - PROHIBIDO ser imaginaria en D+1 (día saliente)
 * 4. Nadie puede ser titular e imaginaria en el mismo día.
 * 5. Rotación circular lógica, predecible y determinista:
 *    - La lista de efectivos se ordena estrictamente por ordenRotacion.
 *    - Se mantiene un puntero circular por empleo.
 *    - Para cada día D, se busca la siguiente persona elegible en orden circular a partir del puntero.
 *    - Al seleccionar a la persona en el índice K, el puntero avanza a (K + 1) % Total.
 *    - Dos ejecuciones con los mismos datos iniciales producen exactamente el mismo resultado.
 */
export interface ImaginariaAssignmentStrategy {
  asignarImaginarias(params: {
    diasFechas: string[];
    serviciosTitulares: Partial<ServicioDia>[];
    cabos: Persona[];
    soldados: Persona[];
    diasServicioPorPersona: Map<string, Set<string>>;
  }): {
    caboImaginariaPorDia: Map<string, Persona>;
    soldadoImaginariaPorDia: Map<string, Persona>;
  };
}

/**
 * Comprueba si una persona es elegible para ser imaginaria en una fecha dada
 */
export const esPersonaElegibleParaImaginaria = (
  persona: Persona,
  fechaStr: string,
  diasServicioPorPersona: Map<string, Set<string>>
): boolean => {
  const serviciosSet = diasServicioPorPersona.get(persona.id);
  if (!serviciosSet) return true;

  const fechaActual = new Date(fechaStr);

  // Fecha D (mismo día de servicio)
  if (serviciosSet.has(fechaStr)) return false;

  // Fecha D-1 (víspera: si mañana tiene servicio, hoy NO puede ser imaginaria)
  const manana = new Date(fechaActual);
  manana.setDate(manana.getDate() + 1);
  const mananaStr = manana.toISOString().split('T')[0];
  if (serviciosSet.has(mananaStr)) return false;

  // Fecha D+1 (día posterior / saliente: si ayer tuvo servicio, hoy NO puede ser imaginaria)
  const ayer = new Date(fechaActual);
  ayer.setDate(ayer.getDate() - 1);
  const ayerStr = ayer.toISOString().split('T')[0];
  if (serviciosSet.has(ayerStr)) return false;

  return true;
};

/**
 * Implementación de la estrategia de rotación circular determinista de imaginaria
 */
export class CircularDeterministicImaginariaStrategy implements ImaginariaAssignmentStrategy {
  asignarImaginarias(params: {
    diasFechas: string[];
    serviciosTitulares: Partial<ServicioDia>[];
    cabos: Persona[];
    soldados: Persona[];
    diasServicioPorPersona: Map<string, Set<string>>;
  }): {
    caboImaginariaPorDia: Map<string, Persona>;
    soldadoImaginariaPorDia: Map<string, Persona>;
  } {
    const { diasFechas, cabos, soldados, diasServicioPorPersona } = params;

    const caboImaginariaPorDia = new Map<string, Persona>();
    const soldadoImaginariaPorDia = new Map<string, Persona>();

    // 1. Asignar Cabos siguiendo cola circular determinista
    this.asignarColaCircularPorEmpleo(
      cabos,
      diasFechas,
      diasServicioPorPersona,
      caboImaginariaPorDia
    );

    // 2. Asignar Soldados siguiendo cola circular determinista
    this.asignarColaCircularPorEmpleo(
      soldados,
      diasFechas,
      diasServicioPorPersona,
      soldadoImaginariaPorDia
    );

    return {
      caboImaginariaPorDia,
      soldadoImaginariaPorDia,
    };
  }

  private asignarColaCircularPorEmpleo(
    efectivos: Persona[],
    diasFechas: string[],
    diasServicioPorPersona: Map<string, Set<string>>,
    resultadoMap: Map<string, Persona>
  ) {
    if (efectivos.length === 0) return;

    // Asegurar orden estricto por ordenRotacion ASC (con fallback por id)
    const listaOrdenada = [...efectivos].sort(
      (a, b) => (a.ordenRotacion ?? 999) - (b.ordenRotacion ?? 999) || a.id.localeCompare(b.id)
    );

    const total = listaOrdenada.length;
    let punteroCircular = 0;

    for (let diaIdx = 0; diaIdx < diasFechas.length; diaIdx++) {
      const fechaActual = diasFechas[diaIdx];
      let asignado: Persona | null = null;

      // 1. Búsqueda circular de la primera persona elegible (cumple D-1, D y D+1)
      for (let offset = 0; offset < total; offset++) {
        const candidateIdx = (punteroCircular + offset) % total;
        const candidate = listaOrdenada[candidateIdx];

        if (esPersonaElegibleParaImaginaria(candidate, fechaActual, diasServicioPorPersona)) {
          asignado = candidate;
          // El puntero avanza a la siguiente posición circular
          punteroCircular = (candidateIdx + 1) % total;
          break;
        }
      }

      // 2. Fallback circular si ninguna cumple D-1 y D+1 simultáneamente (ej: plantilla reducida)
      if (!asignado) {
        for (let offset = 0; offset < total; offset++) {
          const candidateIdx = (punteroCircular + offset) % total;
          const candidate = listaOrdenada[candidateIdx];
          const servicios = diasServicioPorPersona.get(candidate.id);

          // Al menos que NO tenga servicio titular el mismo día D
          if (!servicios || !servicios.has(fechaActual)) {
            asignado = candidate;
            punteroCircular = (candidateIdx + 1) % total;
            break;
          }
        }
      }

      // 3. Fallback de seguridad final
      if (!asignado) {
        asignado = listaOrdenada[punteroCircular % total];
        punteroCircular = (punteroCircular + 1) % total;
      }

      resultadoMap.set(fechaActual, asignado);
    }
  }
}

// Instancia por defecto de la estrategia
export const defaultImaginariaStrategy = new CircularDeterministicImaginariaStrategy();

