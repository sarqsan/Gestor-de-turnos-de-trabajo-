import * as XLSX from 'xlsx';
import {
  ExcelValidationResult,
  ExcelRowParsed,
  ImportSimulationSummary,
  ImportSimulationRow,
  Persona,
  Empleo,
  Unidad,
  UNIDADES_VALIDAS,
} from '../types';
import {
  MIN_PERSONAL_GRUPO,
  MAX_PERSONAL_GRUPO,
  normalizeEmpleo,
  normalizeUnidad,
  normalizeDni,
  findMatchingPersona,
} from '../utils/validators';
import {
  collection,
  doc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { registrarAuditLog } from './auditService';

export const parseExcelFile = async (
  file: File,
  existingPersonas: Persona[]
): Promise<ExcelValidationResult> => {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];

        if (!firstSheetName) {
          return resolve({
            isValid: false,
            totalCount: 0,
            cabosCount: 0,
            soldadosCount: 0,
            unidadesCount: {
              'GOE III': 0,
              'GOE IV': 0,
              'BOEL XIX': 0,
              'GCG': 0,
              'ULOE': 0,
              'US_SEGURIDAD': 0,
            },
            validRows: [],
            invalidRows: [],
            generalErrors: ['El archivo Excel está vacío o no contiene hojas de cálculo.'],
          });
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (!rawJson || rawJson.length < 2) {
          return resolve({
            isValid: false,
            totalCount: 0,
            cabosCount: 0,
            soldadosCount: 0,
            unidadesCount: {
              'GOE III': 0,
              'GOE IV': 0,
              'BOEL XIX': 0,
              'GCG': 0,
              'ULOE': 0,
              'US_SEGURIDAD': 0,
            },
            validRows: [],
            invalidRows: [],
            generalErrors: [
              'El archivo no contiene suficientes filas. Debe incluir una fila de cabecera y entre 21 y 23 registros de personal.',
            ],
          });
        }

        // Buscar índices de columnas en la cabecera (fila 0)
        const headerRow = (rawJson[0] || []).map((h: any) =>
          String(h || '').toLowerCase().trim()
        );

        let nombreIdx = headerRow.findIndex((h: string) =>
          h.includes('nombre') || h.includes('apellidos') || h.includes('persona')
        );
        let empleoIdx = headerRow.findIndex((h: string) =>
          h.includes('empleo') || h.includes('rango') || h.includes('cargo')
        );
        let unidadIdx = headerRow.findIndex((h: string) =>
          h.includes('unidad') || h.includes('destino') || h.includes('cia') || h.includes('u.')
        );
        let dniIdx = headerRow.findIndex((h: string) =>
          h.includes('dni') || h.includes('identificacion') || h.includes('nif')
        );
        let telIdx = headerRow.findIndex((h: string) =>
          h.includes('tel') || h.includes('movil') || h.includes('telefono')
        );

        // Fallback a columnas posicionales estándar: Nombre | Empleo | Unidad | DNI | Teléfono
        if (nombreIdx === -1) nombreIdx = 0;
        if (empleoIdx === -1) empleoIdx = 1;
        if (unidadIdx === -1) unidadIdx = 2;
        if (dniIdx === -1) dniIdx = 3;
        if (telIdx === -1) telIdx = 4;

        const validRows: ExcelRowParsed[] = [];
        const invalidRows: ExcelRowParsed[] = [];
        const seenDnis = new Set<string>();
        const seenNombres = new Set<string>();

        // Iterar desde la fila 1 (datos)
        for (let i = 1; i < rawJson.length; i++) {
          const row = rawJson[i];
          if (!row || row.length === 0 || row.every((c: any) => c === undefined || c === null || String(c).trim() === '')) {
            continue; // Saltar filas completamente vacías
          }

          const rawNombre = String(row[nombreIdx] || '').trim();
          const rawEmpleo = String(row[empleoIdx] || '').trim();
          const rawUnidad = String(row[unidadIdx] || '').trim();
          const rawDni = String(row[dniIdx] || '').trim();
          const rawTel = String(row[telIdx] || '').trim();

          const errors: string[] = [];

          if (!rawNombre) {
            errors.push('Falta el nombre de la persona.');
          }

          const normEmpleo = normalizeEmpleo(rawEmpleo);
          if (!normEmpleo) {
            errors.push(
              `Empleo no válido ("${rawEmpleo}"). Debe ser estrictamente CABO o SOLDADO.`
            );
          }

          const normUnidad = normalizeUnidad(rawUnidad);
          if (!normUnidad) {
            errors.push(
              `Unidad no válida ("${rawUnidad}"). Debe ser una de las cinco unidades permitidas: ${UNIDADES_VALIDAS.join(', ')}.`
            );
          }

          const normDni = normalizeDni(rawDni);
          if (normDni) {
            if (seenDnis.has(normDni)) {
              errors.push(`DNI duplicado en el mismo archivo: "${normDni}".`);
            } else {
              seenDnis.add(normDni);
            }
          }

          if (rawNombre) {
            const lowName = rawNombre.toLowerCase();
            if (seenNombres.has(lowName)) {
              errors.push(`Nombre duplicado en el mismo archivo: "${rawNombre}".`);
            } else {
              seenNombres.add(lowName);
            }
          }

          const parsedRow: ExcelRowParsed = {
            rowNumber: i + 1,
            nombre: rawNombre,
            empleo: normEmpleo || rawEmpleo,
            unidad: normUnidad || rawUnidad,
            dni: normDni || rawDni,
            telefono: rawTel,
            valid: errors.length === 0,
            errors,
          };

          if (parsedRow.valid) {
            validRows.push(parsedRow);
          } else {
            invalidRows.push(parsedRow);
          }
        }

        const totalCount = validRows.length;
        const cabosCount = validRows.filter((r) => r.empleo === 'CABO').length;
        const soldadosCount = validRows.filter((r) => r.empleo === 'SOLDADO').length;
        
        const unidadesCount: Record<Unidad, number> = {
          'GOE III': 0,
          'GOE IV': 0,
          'BOEL XIX': 0,
          'GCG': 0,
          'ULOE': 0,
          'US_SEGURIDAD': 0,
        };

        validRows.forEach((r) => {
          if (r.unidad && unidadesCount[r.unidad as Unidad] !== undefined) {
            unidadesCount[r.unidad as Unidad]++;
          }
        });

        const generalErrors: string[] = [];

        if (invalidRows.length > 0) {
          generalErrors.push(
            `Se han detectado ${invalidRows.length} fila(s) con errores de formato, datos incompletos o unidades no válidas.`
          );
        }

        if (totalCount < MIN_PERSONAL_GRUPO) {
          generalErrors.push(
            `IMPORTACIÓN NO VÁLIDA: Se encontraron ${totalCount} personas válidas. El mínimo requerido es ${MIN_PERSONAL_GRUPO}.`
          );
        } else if (totalCount > MAX_PERSONAL_GRUPO) {
          generalErrors.push(
            `IMPORTACIÓN NO VÁLIDA: Se encontraron ${totalCount} personas válidas. El máximo permitido es ${MAX_PERSONAL_GRUPO}.`
          );
        }

        const isValid = generalErrors.length === 0 && invalidRows.length === 0;

        // Calcular simulación comparando con personas existentes
        const simulation = calcularSimulacionImportacion(validRows, existingPersonas);

        resolve({
          isValid,
          totalCount,
          cabosCount,
          soldadosCount,
          unidadesCount,
          validRows,
          invalidRows,
          generalErrors,
          simulation,
        });
      } catch (err: any) {
        resolve({
          isValid: false,
          totalCount: 0,
          cabosCount: 0,
          soldadosCount: 0,
          unidadesCount: {
            'GOE III': 0,
            'GOE IV': 0,
            'BOEL XIX': 0,
            'GCG': 0,
            'ULOE': 0,
            'US_SEGURIDAD': 0,
          },
          validRows: [],
          invalidRows: [],
          generalErrors: [
            `Error al leer el archivo Excel: ${err.message || 'Formato de archivo inválido.'}`,
          ],
        });
      }
    };

    reader.onerror = () => {
      resolve({
        isValid: false,
        totalCount: 0,
        cabosCount: 0,
        soldadosCount: 0,
        unidadesCount: {
          'GOE III': 0,
          'GOE IV': 0,
          'BOEL XIX': 0,
          'GCG': 0,
          'ULOE': 0,
          'US_SEGURIDAD': 0,
        },
        validRows: [],
        invalidRows: [],
        generalErrors: ['Error de lectura del archivo en el navegador.'],
      });
    };

    reader.readAsArrayBuffer(file);
  });
};

/**
 * Calcula la simulación de importación detallada con política conservadora de homónimos
 */
export const calcularSimulacionImportacion = (
  newRows: ExcelRowParsed[],
  existingPersonas: Persona[]
): ImportSimulationSummary => {
  let nuevas = 0;
  let modificadas = 0;
  let sinCambios = 0;
  let cambiosEmpleo = 0;
  let revisionManual = 0;
  const detalles: ImportSimulationRow[] = [];
  const matchedExistingIds = new Set<string>();

  newRows.forEach((row) => {
    const { match, strategy, isSafeAutoMatch } = findMatchingPersona(
      { nombre: row.nombre, dni: row.dni },
      existingPersonas
    );

    const empleoNorm = (row.empleo as Empleo) || 'SOLDADO';
    const unidadNorm = (row.unidad as Unidad) || 'GOE III';

    if (strategy === 'NOMBRE_HOMONIMO_REVISION' && match) {
      // Coincidencia únicamente por nombre -> No actualizar automáticamente
      revisionManual++;
      detalles.push({
        nombre: row.nombre,
        empleo: empleoNorm,
        unidad: unidadNorm,
        dni: row.dni,
        telefono: row.telefono,
        tipoAccion: 'REVISION_MANUAL',
        personaExistenteId: match.id,
        motivo: `Posible homónimo (${match.nombre} - ${match.empleo} - ${match.unidad}). No coincide DNI; no se sobreescribe automáticamente y se tratará como alta separada salvo confirmación.`,
      });
    } else if (!match || !isSafeAutoMatch) {
      nuevas++;
      detalles.push({
        nombre: row.nombre,
        empleo: empleoNorm,
        unidad: unidadNorm,
        dni: row.dni,
        telefono: row.telefono,
        tipoAccion: 'NUEVA',
        motivo: 'Persona nueva en el grupo',
      });
    } else {
      matchedExistingIds.add(match.id);
      const empleoCambio = match.empleo !== empleoNorm;
      const unidadCambio = match.unidad !== unidadNorm;
      const datosCambio =
        (row.dni && match.dni !== row.dni) ||
        (row.telefono && match.telefono !== row.telefono) ||
        unidadCambio ||
        !match.activo;

      if (empleoCambio) {
        cambiosEmpleo++;
        detalles.push({
          nombre: row.nombre,
          empleo: empleoNorm,
          unidad: unidadNorm,
          dni: row.dni,
          telefono: row.telefono,
          tipoAccion: 'CAMBIO_EMPLEO',
          personaExistenteId: match.id,
          motivo: `Coincidencia por DNI. Cambio de empleo: ${match.empleo} -> ${empleoNorm}${unidadCambio ? ` (unidad ${match.unidad} -> ${unidadNorm})` : ''}`,
        });
      } else if (datosCambio) {
        modificadas++;
        let motivoDesc = 'Actualización de datos (coincidencia por DNI/ID)';
        if (!match.activo) {
          motivoDesc = 'Reactivación de persona histórica (mismo DNI)';
        } else if (unidadCambio) {
          motivoDesc = `Cambio de unidad: ${match.unidad} -> ${unidadNorm}`;
        } else {
          motivoDesc = 'Actualización de DNI / Teléfono';
        }

        detalles.push({
          nombre: row.nombre,
          empleo: empleoNorm,
          unidad: unidadNorm,
          dni: row.dni,
          telefono: row.telefono,
          tipoAccion: 'MODIFICADA',
          personaExistenteId: match.id,
          motivo: motivoDesc,
        });
      } else {
        sinCambios++;
        detalles.push({
          nombre: row.nombre,
          empleo: empleoNorm,
          unidad: unidadNorm,
          dni: row.dni,
          telefono: row.telefono,
          tipoAccion: 'SIN_CAMBIOS',
          personaExistenteId: match.id,
          motivo: 'Datos idénticos sin alteraciones (mismo DNI/ID)',
        });
      }
    }
  });

  // Personas que actualmente estaban activas pero no figuran en el nuevo Excel
  // Pasarían a INACTIVAS (histórico preservado)
  let desactivadas = 0;
  existingPersonas
    .filter((p) => p.activo && !matchedExistingIds.has(p.id))
    .forEach((p) => {
      desactivadas++;
      detalles.push({
        nombre: p.nombre,
        empleo: p.empleo,
        unidad: p.unidad || 'GOE III',
        dni: p.dni,
        telefono: p.telefono,
        tipoAccion: 'DESACTIVAR',
        personaExistenteId: p.id,
        motivo: 'Pasa a estado INACTIVO (se conserva en el historial)',
      });
    });

  return {
    nuevas,
    modificadas,
    desactivadas,
    sinCambios,
    cambiosEmpleo,
    revisionManual,
    detalles,
  };
};

/**
 * Ejecuta la importación confirmada en Firestore aplicando preservación histórica.
 */
export const ejecutarImportacionConfirmada = async (
  validRows: ExcelRowParsed[],
  existingPersonas: Persona[],
  adminInfo: { uid: string; nombre: string },
  nombreCiclo: string = 'Ciclo Importado'
): Promise<{ success: boolean; message: string; count: number }> => {
  try {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    const matchedExistingIds = new Set<string>();

    for (const row of validRows) {
      const { match, isSafeAutoMatch } = findMatchingPersona(
        { nombre: row.nombre, dni: row.dni },
        existingPersonas
      );

      const empleoNorm = (row.empleo as Empleo) || 'SOLDADO';
      const unidadNorm = (row.unidad as Unidad) || 'GOE III';

      if (!match || !isSafeAutoMatch) {
        // Nueva persona (o homónimo sin DNI que debe conservarse como ficha independiente)
        const newRef = doc(collection(db, 'personas'));
        const newPersona: Persona = {
          id: newRef.id,
          nombre: row.nombre,
          empleo: empleoNorm,
          unidad: unidadNorm,
          dni: row.dni,
          telefono: row.telefono,
          activo: true,
          cicloId: nombreCiclo,
          fechaCreacion: now,
          fechaActualizacion: now,
        };
        batch.set(newRef, newPersona);
      } else {
        // Actualizar persona existente con coincidencia segura por DNI o ID y marcarla como activa
        matchedExistingIds.add(match.id);
        const docRef = doc(db, 'personas', match.id);
        batch.update(docRef, {
          nombre: row.nombre,
          empleo: empleoNorm,
          unidad: unidadNorm,
          dni: row.dni || match.dni,
          telefono: row.telefono || match.telefono,
          activo: true,
          cicloId: nombreCiclo,
          fechaActualizacion: now,
        });
      }
    }

    // Personas activas que no están en el nuevo Excel pasan a activo = false
    const aDesactivar = existingPersonas.filter(
      (p) => p.activo && !matchedExistingIds.has(p.id)
    );

    for (const p of aDesactivar) {
      const docRef = doc(db, 'personas', p.id);
      batch.update(docRef, {
        activo: false,
        fechaActualizacion: now,
      });
    }

    await batch.commit();

    await registrarAuditLog({
      adminUid: adminInfo.uid,
      adminNombre: adminInfo.nombre,
      accion: 'IMPORTAR_PERSONAL',
      detalles: `Importación masiva completada: ${validRows.length} personas procesadas (${validRows.filter((r) => r.empleo === 'CABO').length} Cabos, ${validRows.filter((r) => r.empleo === 'SOLDADO').length} Soldados). ${aDesactivar.length} personas archivadas en histórico.`,
    });

    return {
      success: true,
      message: `Importación exitosa. Se procesaron ${validRows.length} personas (${aDesactivar.length} pasaron a estado inactivo histórico).`,
      count: validRows.length,
    };
  } catch (error: any) {
    console.error('Error al ejecutar importación en Firestore:', error);
    return {
      success: false,
      message: `Error al guardar en base de datos: ${error.message || 'Error desconocido'}`,
      count: 0,
    };
  }
};

/**
 * Genera y descarga una plantilla Excel de ejemplo (.xlsx) con las columnas requeridas: Nombre | Empleo | Unidad | DNI | Teléfono
 */
export const descargarPlantillaExcelEjemplo = (cabosCount = 11, soldadosCount = 11) => {
  const data: any[] = [
    ['Nombre', 'Empleo', 'Unidad', 'DNI', 'Teléfono'],
  ];

  const unidadesDistribuidas: Unidad[] = ['GOE III', 'GOE IV', 'BOEL XIX', 'GCG', 'ULOE'];

  for (let i = 1; i <= cabosCount; i++) {
    const unidad = unidadesDistribuidas[(i - 1) % unidadesDistribuidas.length];
    data.push([
      `Cabo ${i}`,
      'CABO',
      unidad,
      `1000000${i.toString().padStart(2, '0')}A`,
      `6001112${i.toString().padStart(2, '0')}`,
    ]);
  }

  for (let i = 1; i <= soldadosCount; i++) {
    const unidad = unidadesDistribuidas[(i + 1) % unidadesDistribuidas.length];
    data.push([
      `Soldado ${i}`,
      'SOLDADO',
      unidad,
      `2000000${i.toString().padStart(2, '0')}B`,
      `6002222${i.toString().padStart(2, '0')}`,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Personal');
  XLSX.writeFile(wb, 'plantilla_personal_grupo.xlsx');
};
