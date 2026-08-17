import {
  ServicioDia,
  Persona,
  InformeValidacion,
  ValidacionItem,
} from '../types';

/**
 * Validador estricto de cuadrantes según las reglas FASE 2A / 2B.
 *
 * Restricciones Duras (RD-01 a RD-10):
 * - RD-01: Exactamente 2 Cabos titulares cada día.
 * - RD-02: Exactamente 2 Soldados titulares cada día.
 * - RD-03: Exactamente 1 Cabo imaginaria cada día.
 * - RD-04: Exactamente 1 Soldado imaginaria cada día.
 * - RD-05: Ninguna persona tiene servicios consecutivos (D y D+1).
 * - RD-06: Ninguna persona está de imaginaria en D-1, D o D+1 respecto a su servicio.
 * - RD-07: Ninguna persona ocupa dos puestos el mismo día.
 * - RD-08: Correspondencia estricta de empleo en cada puesto.
 * - RD-09: Todo el personal asignado debe estar activo.
 * - RD-10: Todos los personaIds deben existir en el directorio.
 */
export const validarCuadrante = (
  servicios: ServicioDia[],
  personas: Persona[]
): InformeValidacion => {
  const items: ValidacionItem[] = [];
  const personasMap = new Map<string, Persona>();
  personas.forEach((p) => personasMap.set(p.id, p));

  // Mapa de días de servicio por persona: personaId -> Set de fechas YYYY-MM-DD
  const diasServicioPorPersona = new Map<string, Set<string>>();
  // Mapa de días de imaginaria por persona: personaId -> Set de fechas YYYY-MM-DD
  const diasImaginariaPorPersona = new Map<string, Set<string>>();

  // Primer pase: validar cada día individualmente y poblar mapas
  servicios.forEach((dia) => {
    const fecha = dia.fecha;
    const cabosTitulares = dia.titulares.cabos;
    const soldadosTitulares = dia.titulares.soldados;
    const caboImag = dia.imaginarias.cabo;
    const soldadoImag = dia.imaginarias.soldado;

    // RD-01: Exactamente 2 Cabos titulares
    if (!cabosTitulares || cabosTitulares.length !== 2) {
      items.push({
        codigo: 'RD-01',
        severidad: 'ERROR',
        fecha,
        descripcion: 'El servicio debe tener exactamente 2 Cabos titulares.',
        detalleConflicto: `Detectados ${cabosTitulares?.length || 0} Cabos.`,
      });
    }

    // RD-02: Exactamente 2 Soldados titulares
    if (!soldadosTitulares || soldadosTitulares.length !== 2) {
      items.push({
        codigo: 'RD-02',
        severidad: 'ERROR',
        fecha,
        descripcion: 'El servicio debe tener exactamente 2 Soldados titulares.',
        detalleConflicto: `Detectados ${soldadosTitulares?.length || 0} Soldados.`,
      });
    }

    // RD-03: Exactamente 1 Cabo de imaginaria
    if (!caboImag || !caboImag.personaIdReal) {
      items.push({
        codigo: 'RD-03',
        severidad: 'ERROR',
        fecha,
        descripcion: 'Falta asignar el Cabo de imaginaria.',
      });
    }

    // RD-04: Exactamente 1 Soldado de imaginaria
    if (!soldadoImag || !soldadoImag.personaIdReal) {
      items.push({
        codigo: 'RD-04',
        severidad: 'ERROR',
        fecha,
        descripcion: 'Falta asignar el Soldado de imaginaria.',
      });
    }

    // Comprobar puestos asignados y duplicidades en el mismo día
    const idsEnElDia: { id: string; puesto: string }[] = [];

    const registrarPuesto = (id: string, puesto: string, empleoEsperado: 'CABO' | 'SOLDADO') => {
      if (!id) return;
      const persona = personasMap.get(id);

      // RD-10: Existencia del ID
      if (!persona) {
        items.push({
          codigo: 'RD-10',
          severidad: 'ERROR',
          fecha,
          personaId: id,
          descripcion: `La persona asignada con ID "${id}" no existe en el sistema.`,
        });
        return;
      }

      // RD-09: Persona activa
      if (!persona.activo) {
        items.push({
          codigo: 'RD-09',
          severidad: 'ERROR',
          fecha,
          personaId: id,
          personaNombre: persona.nombre,
          descripcion: `La persona ${persona.nombre} está marcada como INACTIVA.`,
        });
      }

      // RD-08: Correspondencia de empleo
      if (persona.empleo !== empleoEsperado) {
        items.push({
          codigo: 'RD-08',
          severidad: 'ERROR',
          fecha,
          personaId: id,
          personaNombre: persona.nombre,
          descripcion: `Incompatibilidad de empleo en puesto de ${empleoEsperado}.`,
          detalleConflicto: `${persona.nombre} tiene empleo ${persona.empleo}, pero está asignado a un puesto de ${empleoEsperado}.`,
        });
      }

      // Registrar para el mapa global de servicios o imaginarias
      if (puesto.includes('TITULAR')) {
        if (!diasServicioPorPersona.has(id)) {
          diasServicioPorPersona.set(id, new Set());
        }
        diasServicioPorPersona.get(id)!.add(fecha);
      } else {
        if (!diasImaginariaPorPersona.has(id)) {
          diasImaginariaPorPersona.set(id, new Set());
        }
        diasImaginariaPorPersona.get(id)!.add(fecha);
      }

      idsEnElDia.push({ id, puesto });
    };

    if (cabosTitulares) {
      registrarPuesto(cabosTitulares[0]?.personaIdReal, 'CABO_TITULAR_1', 'CABO');
      registrarPuesto(cabosTitulares[1]?.personaIdReal, 'CABO_TITULAR_2', 'CABO');
    }
    if (soldadosTitulares) {
      registrarPuesto(soldadosTitulares[0]?.personaIdReal, 'SOLDADO_TITULAR_1', 'SOLDADO');
      registrarPuesto(soldadosTitulares[1]?.personaIdReal, 'SOLDADO_TITULAR_2', 'SOLDADO');
    }
    if (caboImag) {
      registrarPuesto(caboImag.personaIdReal, 'CABO_IMAGINARIA', 'CABO');
    }
    if (soldadoImag) {
      registrarPuesto(soldadoImag.personaIdReal, 'SOLDADO_IMAGINARIA', 'SOLDADO');
    }

    // RD-07: No duplicidad en el mismo día
    const seenIds = new Set<string>();
    idsEnElDia.forEach(({ id, puesto }) => {
      if (seenIds.has(id)) {
        const p = personasMap.get(id);
        items.push({
          codigo: 'RD-07',
          severidad: 'ERROR',
          fecha,
          personaId: id,
          personaNombre: p?.nombre,
          descripcion: 'Persona duplicada en el mismo día.',
          detalleConflicto: `${p?.nombre || id} figura repetida en el servicio de fecha ${fecha} (puesto: ${puesto}).`,
        });
      }
      seenIds.add(id);
    });
  });

  // Segundo pase: validar secuencias temporales (RD-05 y RD-06)
  diasServicioPorPersona.forEach((fechasSet, personaId) => {
    const persona = personasMap.get(personaId);
    const fechasOrdenadas = Array.from(fechasSet).sort();

    // RD-05: Servicios consecutivos
    for (let i = 0; i < fechasOrdenadas.length - 1; i++) {
      const f1 = new Date(fechasOrdenadas[i]);
      const f2 = new Date(fechasOrdenadas[i + 1]);
      const diffMs = f2.getTime() - f1.getTime();
      const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));

      if (diffDias === 1) {
        items.push({
          codigo: 'RD-05',
          severidad: 'ERROR',
          fecha: fechasOrdenadas[i + 1],
          personaId,
          personaNombre: persona?.nombre,
          descripcion: 'Servicios consecutivos prohibidos.',
          detalleConflicto: `${persona?.nombre || personaId} tiene servicios en días consecutivos: ${fechasOrdenadas[i]} y ${fechasOrdenadas[i + 1]}.`,
        });
      }
    }

    // RD-06: Exclusión de imaginaria en D-1, D y D+1
    const imaginariasSet = diasImaginariaPorPersona.get(personaId);
    if (imaginariasSet) {
      fechasOrdenadas.forEach((fechaServicio) => {
        const fSrv = new Date(fechaServicio);

        // Comprobar D (mismo día ya capturado por RD-07, pero verificado aquí también)
        if (imaginariasSet.has(fechaServicio)) {
          items.push({
            codigo: 'RD-06',
            severidad: 'ERROR',
            fecha: fechaServicio,
            personaId,
            personaNombre: persona?.nombre,
            descripcion: 'Imaginaria el mismo día del servicio (D).',
            detalleConflicto: `${persona?.nombre || personaId} figura como titular e imaginaria en la fecha ${fechaServicio}.`,
          });
        }

        // Comprobar D-1 (víspera)
        const dMenos1 = new Date(fSrv);
        dMenos1.setDate(dMenos1.getDate() - 1);
        const dMenos1Str = dMenos1.toISOString().split('T')[0];
        if (imaginariasSet.has(dMenos1Str)) {
          items.push({
            codigo: 'RD-06',
            severidad: 'ERROR',
            fecha: dMenos1Str,
            personaId,
            personaNombre: persona?.nombre,
            descripcion: 'Imaginaria el día anterior a su servicio (D-1).',
            detalleConflicto: `${persona?.nombre || personaId} está de imaginaria en ${dMenos1Str} teniendo servicio al día siguiente (${fechaServicio}).`,
          });
        }

        // Comprobar D+1 (saliente)
        const dMas1 = new Date(fSrv);
        dMas1.setDate(dMas1.getDate() + 1);
        const dMas1Str = dMas1.toISOString().split('T')[0];
        if (imaginariasSet.has(dMas1Str)) {
          items.push({
            codigo: 'RD-06',
            severidad: 'ERROR',
            fecha: dMas1Str,
            personaId,
            personaNombre: persona?.nombre,
            descripcion: 'Imaginaria el día posterior a su servicio (D+1 saliente).',
            detalleConflicto: `${persona?.nombre || personaId} está de imaginaria en ${dMas1Str} tras realizar servicio el día anterior (${fechaServicio}).`,
          });
        }
      });
    }
  });

  const totalErrores = items.filter((i) => i.severidad === 'ERROR').length;
  const totalAdvertencias = items.filter((i) => i.severidad === 'ADVERTENCIA').length;

  return {
    valido: totalErrores === 0,
    totalErrores,
    totalAdvertencias,
    items,
  };
};

export const MIN_TOTAL_PERSONAS = 21;
export const MIN_CABOS = 6;
export const MIN_SOLDADOS = 6;

export interface CapacidadPlantillaResult {
  viable: boolean;
  totalPersonas: number;
  totalCabos: number;
  totalSoldados: number;
  minimoTotalRequerido: number;
  minimoCabosRequerido: number;
  minimoSoldadosRequerido: number;
  motivoBloqueo?: string;
  detalles: string[];
}

/**
 * Valida de forma independiente la capacidad de personal antes de generar o publicar el cuadrante.
 * Mínimo reglamentario:
 * - 21 personas en total.
 * - Mínimo 6 Cabos (para cubrir 2 titulares + 1 imaginaria diarios respetando descansos D-1/D+1).
 * - Mínimo 6 Soldados (para cubrir 2 titulares + 1 imaginaria diarios).
 */
export const validarCapacidadPlantilla = (personas: Persona[]): CapacidadPlantillaResult => {
  const activas = personas.filter((p) => p.activo);
  const cabos = activas.filter((p) => p.empleo === 'CABO');
  const soldados = activas.filter((p) => p.empleo === 'SOLDADO');

  const totalPersonas = activas.length;
  const totalCabos = cabos.length;
  const totalSoldados = soldados.length;

  const detalles: string[] = [];
  let viable = true;
  let motivoBloqueo: string | undefined = undefined;

  // 1. Validación de Cabos (Mínimo 6)
  if (totalCabos < MIN_CABOS) {
    viable = false;
    detalles.push(
      `Cabos insuficientes: Hay ${totalCabos} Cabos activos, pero se requieren al menos ${MIN_CABOS} Cabos para cubrir 2 Cabos titulares y 1 Cabo imaginaria diarios respetando los descansos obligatorios (D-1/D+1).`
    );
  } else {
    detalles.push(`Cabos activos: ${totalCabos} (Mínimo requerido: ${MIN_CABOS}) - CORRECTO.`);
  }

  // 2. Validación de Soldados (Mínimo 6)
  if (totalSoldados < MIN_SOLDADOS) {
    viable = false;
    detalles.push(
      `Soldados insuficientes: Hay ${totalSoldados} Soldados activos, pero se requieren al menos ${MIN_SOLDADOS} Soldados para cubrir 2 Soldados titulares y 1 Soldado imaginaria diarios.`
    );
  } else {
    detalles.push(`Soldados activos: ${totalSoldados} (Mínimo requerido: ${MIN_SOLDADOS}) - CORRECTO.`);
  }

  // 3. Validación de Total General (Mínimo 21)
  if (totalPersonas < MIN_TOTAL_PERSONAS) {
    viable = false;
    detalles.push(
      `Plantilla total insuficiente: Hay ${totalPersonas} efectivos activos, inferior al mínimo reglamentario de ${MIN_TOTAL_PERSONAS} personas necesario para garantizar la sostenibilidad y los descansos de 24h.`
    );
  } else {
    detalles.push(`Plantilla total: ${totalPersonas} efectivos activos (Mínimo reglamentario: ${MIN_TOTAL_PERSONAS}) - CORRECTO.`);
  }

  if (!viable) {
    motivoBloqueo = `Bloqueo de Capacidad: La plantilla activa (${totalPersonas} efectivos: ${totalCabos} Cabos, ${totalSoldados} Soldados) no cumple los mínimos reglamentarios (${MIN_TOTAL_PERSONAS} en total, mín. ${MIN_CABOS} Cabos) requeridos para el ciclo de guardias.`;
  }

  return {
    viable,
    totalPersonas,
    totalCabos,
    totalSoldados,
    minimoTotalRequerido: MIN_TOTAL_PERSONAS,
    minimoCabosRequerido: MIN_CABOS,
    minimoSoldadosRequerido: MIN_SOLDADOS,
    motivoBloqueo,
    detalles,
  };
};

