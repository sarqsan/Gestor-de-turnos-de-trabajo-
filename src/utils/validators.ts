import { Empleo, Persona, Unidad, UNIDADES_VALIDAS } from '../types';

export const MIN_PERSONAL_GRUPO = 21;
export const MAX_PERSONAL_GRUPO = 23;

export const normalizeDni = (dni?: string | null): string => {
  if (!dni) return '';
  return dni.toUpperCase().replace(/[\s-]/g, '').trim();
};

export const isValidEmpleo = (empleo: string): empleo is Empleo => {
  const norm = (empleo || '').toUpperCase().trim();
  return norm === 'CABO' || norm === 'SOLDADO';
};

export const normalizeEmpleo = (empleo: string): Empleo | null => {
  const norm = (empleo || '').toUpperCase().trim();
  if (norm === 'CABO' || norm === 'CABOS') return 'CABO';
  if (norm === 'SOLDADO' || norm === 'SOLDADOS') return 'SOLDADO';
  return null;
};

export const isValidUnidad = (unidad: string): unidad is Unidad => {
  const norm = (unidad || '').toUpperCase().trim();
  return UNIDADES_VALIDAS.some((u) => u.toUpperCase() === norm);
};

export const normalizeUnidad = (unidad: string): Unidad | null => {
  if (!unidad) return null;
  const clean = unidad.trim().toUpperCase().replace(/\s+/g, ' ');
  
  if (clean === 'GOE III' || clean === 'GOE 3' || clean === 'GOEIII') return 'GOE III';
  if (clean === 'GOE IV' || clean === 'GOE 4' || clean === 'GOEIV') return 'GOE IV';
  if (clean === 'BOEL XIX' || clean === 'BOEL 19' || clean === 'BOELXIX') return 'BOEL XIX';
  if (clean === 'GCG') return 'GCG';
  if (clean === 'ULOE') return 'ULOE';

  const exact = UNIDADES_VALIDAS.find((u) => u.toUpperCase() === clean);
  return exact || null;
};

export const validatePersonData = (data: {
  nombre?: string;
  empleo?: string;
  unidad?: string;
  dni?: string;
  telefono?: string;
}): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.nombre || data.nombre.trim().length < 2) {
    errors.push('El nombre es obligatorio y debe tener al menos 2 caracteres.');
  }

  if (!data.empleo || !isValidEmpleo(data.empleo)) {
    errors.push('El empleo es obligatorio y debe ser CABO o SOLDADO.');
  }

  if (!data.unidad || !isValidUnidad(data.unidad)) {
    errors.push(
      `La unidad es obligatoria y debe ser una de las cinco permitidas: ${UNIDADES_VALIDAS.join(', ')}.`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Estrategia segura y conservadora de coincidencia de personas para importaciones:
 * 1. Coincidencia por ID interno seguro -> 'ID_EXACTO' (match seguro).
 * 2. Si existe DNI válido y coincide exactamente -> 'DNI_EXACTO' (match seguro).
 * 3. Si ÚNICAMENTE coincide el nombre -> 'NOMBRE_HOMONIMO_REVISION'. NO se actualiza automáticamente
 *    para evitar sobreescribir personas de ciclos anteriores con el mismo nombre y apellidos.
 * 4. Si no coincide ninguno -> 'NINGUNA' (persona nueva).
 */
export const findMatchingPersona = (
  candidate: { id?: string; nombre: string; dni?: string },
  existingPersonas: Persona[]
): {
  match: Persona | null;
  strategy: 'ID_EXACTO' | 'DNI_EXACTO' | 'NOMBRE_HOMONIMO_REVISION' | 'NINGUNA';
  isSafeAutoMatch: boolean;
} => {
  // 1. Coincidencia por ID interno si viene especificado
  if (candidate.id) {
    const idMatch = existingPersonas.find((p) => p.id === candidate.id);
    if (idMatch) {
      return { match: idMatch, strategy: 'ID_EXACTO', isSafeAutoMatch: true };
    }
  }

  const candDni = normalizeDni(candidate.dni);
  const candNombre = candidate.nombre.trim().toLowerCase();

  // 2. Coincidencia por DNI válido (mínimo 6 caracteres alfanuméricos)
  if (candDni && candDni.length >= 6) {
    const dniMatch = existingPersonas.find(
      (p) => normalizeDni(p.dni) === candDni
    );
    if (dniMatch) {
      return { match: dniMatch, strategy: 'DNI_EXACTO', isSafeAutoMatch: true };
    }
  }

  // 3. Coincidencia únicamente por nombre
  const nameMatches = existingPersonas.filter(
    (p) => p.nombre.trim().toLowerCase() === candNombre
  );

  if (nameMatches.length > 0) {
    const existing = nameMatches[0];
    // Si la persona existente tiene DNI y el candidato tiene otro DNI distinto, es otra persona
    const existDni = normalizeDni(existing.dni);
    if (candDni && existDni && candDni !== existDni) {
      return { match: null, strategy: 'NINGUNA', isSafeAutoMatch: false };
    }

    // Coincide solo el nombre: REQUIERE REVISIÓN MANUAL, NO ACTUALIZACIÓN AUTOMÁTICA
    return {
      match: existing,
      strategy: 'NOMBRE_HOMONIMO_REVISION',
      isSafeAutoMatch: false,
    };
  }

  return { match: null, strategy: 'NINGUNA', isSafeAutoMatch: false };
};
