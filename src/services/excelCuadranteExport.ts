import * as XLSX from 'xlsx';
import { CuadranteMaestro, ServicioDia, Persona } from '../types';

export const MESES_OFICIALES = [
  { key: '2026-09', nombre: 'Septiembre 2026', dias: 30, anio: 2026, mes: 9 },
  { key: '2026-10', nombre: 'Octubre 2026', dias: 31, anio: 2026, mes: 10 },
  { key: '2026-11', nombre: 'Noviembre 2026', dias: 30, anio: 2026, mes: 11 },
  { key: '2026-12', nombre: 'Diciembre 2026', dias: 31, anio: 2026, mes: 12 },
  { key: '2027-01', nombre: 'Enero 2027', dias: 31, anio: 2027, mes: 1 },
  { key: '2027-02', nombre: 'Febrero 2027', dias: 28, anio: 2027, mes: 2 },
];

const DIAS_SEMANA_CORTO = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

/**
 * Obtiene el rol/estado de una persona en un día concreto de servicio:
 * 'S' = Servicio Titular (24h)
 * 'I' = Imaginaria de Retén (24h)
 * 'L' = Libre / Descanso
 */
export const getEstadoPersonaEnServicio = (
  servicio: ServicioDia | undefined,
  personaId: string
): 'S' | 'I' | 'L' => {
  if (!servicio) return 'L';

  // Comprobar si es titular (Cabos o Soldados)
  const esTitular = [
    ...servicio.titulares.cabos,
    ...servicio.titulares.soldados,
  ].some((t) => t?.personaIdReal === personaId);

  if (esTitular) return 'S';

  // Comprobar si es imaginaria
  const esImaginaria =
    servicio.imaginarias.cabo?.personaIdReal === personaId ||
    servicio.imaginarias.soldado?.personaIdReal === personaId;

  if (esImaginaria) return 'I';

  return 'L';
};

/**
 * Genera y descarga el archivo Excel (.xlsx) oficial del cuadrante.
 * - Una hoja por mes (Septiembre 2026 a Febrero 2027).
 * - Hoja de resumen general de reparto.
 * - Filas: Personas (Cabos primero, luego Soldados).
 * - Columnas: Días del mes (1..N).
 * - Celdas: S (Servicio), I (Imaginaria), L (Libre).
 * - Privacidad estricta: NO DNI, NO teléfono, NO datos médicos ni notas privadas.
 */
export const descargarCuadranteExcel = (
  cuadrante: CuadranteMaestro,
  servicios: ServicioDia[],
  personas: Persona[]
) => {
  const wb = XLSX.utils.book_new();

  // Filtrar y ordenar personas activas (Cabos primero por orden/nombre, luego Soldados)
  const personasActivas = personas.filter((p) => p.activo);
  const cabos = personasActivas
    .filter((p) => p.empleo === 'CABO')
    .sort((a, b) => (a.ordenRotacion ?? 999) - (b.ordenRotacion ?? 999) || a.nombre.localeCompare(b.nombre));
  const soldados = personasActivas
    .filter((p) => p.empleo === 'SOLDADO')
    .sort((a, b) => (a.ordenRotacion ?? 999) - (b.ordenRotacion ?? 999) || a.nombre.localeCompare(b.nombre));

  const plantillaOrdenada = [...cabos, ...soldados];

  // Mapa rápido de servicios por fecha (YYYY-MM-DD)
  const serviciosPorFecha = new Map<string, ServicioDia>();
  servicios.forEach((s) => serviciosPorFecha.set(s.fecha, s));

  // Generar cada hoja mensual
  MESES_OFICIALES.forEach((mesInfo) => {
    const sheetData: any[][] = [];

    // Fila 1: Título principal
    sheetData.push([
      `CUADRANTE MENSUAL DE GUARDIAS DE 24 HORAS — ${mesInfo.nombre.toUpperCase()} (08:00 A 08:00)`,
    ]);
    sheetData.push([
      `Ciclo: ${cuadrante.nombre} | Periodo Oficial: ${cuadrante.fechaInicio} a ${cuadrante.fechaFin} | Plantilla: ${plantillaOrdenada.length} Efectivos`,
    ]);
    sheetData.push([]); // Espacio

    // Fila 4: Cabecera de días (Fila 1 de cabecera)
    const cabeceraDias: any[] = ['Nº', 'EMPLEO', 'NOMBRE Y APELLIDOS'];
    for (let d = 1; d <= mesInfo.dias; d++) {
      cabeceraDias.push(d);
    }
    cabeceraDias.push('TOTAL SERV.', 'TOTAL IMAG.', 'TOTAL FDS');
    sheetData.push(cabeceraDias);

    // Fila 5: Días de la semana (L, M, X, J, V, S, D)
    const cabeceraDiasSemana: any[] = ['', '', ''];
    for (let d = 1; d <= mesInfo.dias; d++) {
      const fechaStr = `${mesInfo.key}-${d.toString().padStart(2, '0')}`;
      const dateObj = new Date(fechaStr);
      const diaSemanaIndex = dateObj.getDay();
      const diaSemanaLetra = DIAS_SEMANA_CORTO[diaSemanaIndex];
      cabeceraDiasSemana.push(diaSemanaLetra);
    }
    cabeceraDiasSemana.push('', '', '');
    sheetData.push(cabeceraDiasSemana);

    // Filas de Efectivos
    plantillaOrdenada.forEach((persona, index) => {
      const fila: any[] = [
        index + 1,
        persona.empleo,
        persona.nombre,
      ];

      let totalServMes = 0;
      let totalImagMes = 0;
      let totalFdsMes = 0;

      for (let d = 1; d <= mesInfo.dias; d++) {
        const fechaStr = `${mesInfo.key}-${d.toString().padStart(2, '0')}`;
        const srv = serviciosPorFecha.get(fechaStr);
        const estado = getEstadoPersonaEnServicio(srv, persona.id);

        fila.push(estado);

        if (estado === 'S') {
          totalServMes++;
          if (srv?.esFinDeSemana) totalFdsMes++;
        } else if (estado === 'I') {
          totalImagMes++;
        }
      }

      fila.push(totalServMes, totalImagMes, totalFdsMes);
      sheetData.push(fila);
    });

    // Fila de leyenda al final
    sheetData.push([]);
    sheetData.push(['LEYENDA:', 'S = Servicio Titular 24h (08:00 a 08:00)', 'I = Imaginaria de Retén (24h)', 'L = Libre / Descanso']);

    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Configurar anchos de columna optimizados para A4 horizontal
    const cols = [
      { wch: 4 },  // Nº
      { wch: 11 }, // Empleo
      { wch: 30 }, // Nombre
    ];
    for (let d = 1; d <= mesInfo.dias; d++) {
      cols.push({ wch: 3.8 }); // Cada día
    }
    cols.push({ wch: 11 }, { wch: 11 }, { wch: 11 }); // Totales
    ws['!cols'] = cols;

    // Configuración de impresión A4 Horizontal
    ws['!pageSetup'] = {
      orientation: 'landscape',
      paperSize: 9, // A4
      fitToWidth: 1,
      fitToHeight: 1,
      scale: 85,
    };
    ws['!margins'] = {
      left: 0.25,
      right: 0.25,
      top: 0.35,
      bottom: 0.35,
      header: 0.2,
      footer: 0.2,
    };

    XLSX.utils.book_append_sheet(wb, ws, mesInfo.nombre.split(' ')[0]);
  });

  // Hoja adicional: Resumen General del Semestre
  const resumenData: any[][] = [
    [`RESUMEN GENERAL SEMESTRAL — ${cuadrante.nombre}`],
    [`Periodo: ${cuadrante.fechaInicio} al ${cuadrante.fechaFin} | Total Días: ${cuadrante.totalDias}`],
    [],
    ['Nº', 'EMPLEO', 'NOMBRE Y APELLIDOS', 'SERVICIOS TOTALES', 'IMAGINARIAS TOTALES', 'FINES DE SEMANA', 'DESVIACIÓN'],
  ];

  plantillaOrdenada.forEach((persona, idx) => {
    let totServ = 0;
    let totImag = 0;
    let totFds = 0;

    servicios.forEach((s) => {
      const estado = getEstadoPersonaEnServicio(s, persona.id);
      if (estado === 'S') {
        totServ++;
        if (s.esFinDeSemana) totFds++;
      } else if (estado === 'I') {
        totImag++;
      }
    });

    resumenData.push([
      idx + 1,
      persona.empleo,
      persona.nombre,
      totServ,
      totImag,
      totFds,
      totServ >= 14 && totServ <= 17 ? 'ÓPTIMO' : 'AJUSTADO',
    ]);
  });

  resumenData.push([]);
  resumenData.push(['CONFIDENCIAL OPERATIVO — Documento oficial emitido conforme a la directiva de guardias 24h.']);

  const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
  wsResumen['!cols'] = [
    { wch: 4 },
    { wch: 11 },
    { wch: 30 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
  ];
  wsResumen['!pageSetup'] = {
    orientation: 'portrait',
    paperSize: 9, // A4
    fitToWidth: 1,
    fitToHeight: 1,
    scale: 90,
  };
  wsResumen['!margins'] = {
    left: 0.3,
    right: 0.3,
    top: 0.4,
    bottom: 0.4,
    header: 0.2,
    footer: 0.2,
  };
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen Semestral');

  // Descargar archivo Excel
  const safeName = cuadrante.nombre.replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `${safeName}_Cuadrante_2026_2027.xlsx`);
};
