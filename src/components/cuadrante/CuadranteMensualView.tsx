import React, { useState, useMemo } from 'react';
import { CuadranteMaestro, ServicioDia, Persona } from '../../types';
import {
  MESES_OFICIALES,
  getEstadoPersonaEnServicio,
  descargarCuadranteExcel,
} from '../../services/excelCuadranteExport';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Search,
  Shield,
  Clock,
  CheckCircle2,
  Users,
  Sparkles,
  Info,
} from 'lucide-react';

interface CuadranteMensualViewProps {
  cuadrante: CuadranteMaestro;
  servicios: ServicioDia[];
  personas: Persona[];
  currentPersonaId?: string | null;
  isAdmin?: boolean;
}

const DIAS_SEMANA_CORTO = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const DIAS_SEMANA_NOMBRE = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export const CuadranteMensualView: React.FC<CuadranteMensualViewProps> = ({
  cuadrante,
  servicios,
  personas,
  currentPersonaId,
  isAdmin = false,
}) => {
  // Mes seleccionado (por defecto Septiembre 2026)
  const [selectedMesKey, setSelectedMesKey] = useState<string>('2026-09');
  const [modoVista, setModoVista] = useState<'PERSONAL' | 'GENERAL'>(
    !isAdmin && currentPersonaId ? 'PERSONAL' : 'GENERAL'
  );
  const [filtroEmpleo, setFiltroEmpleo] = useState<'TODOS' | 'CABO' | 'SOLDADO'>('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const [hoveredCell, setHoveredCell] = useState<{
    fecha: string;
    personaNombre: string;
    empleo: string;
    estado: 'S' | 'I' | 'L';
  } | null>(null);

  const currentPersonaObj = useMemo(() => {
    return personas.find((p) => p.id === currentPersonaId);
  }, [personas, currentPersonaId]);

  const mesActualInfo = useMemo(() => {
    return (
      MESES_OFICIALES.find((m) => m.key === selectedMesKey) ||
      MESES_OFICIALES[0]
    );
  }, [selectedMesKey]);

  // Mapa de servicios por fecha
  const serviciosPorFecha = useMemo(() => {
    const map = new Map<string, ServicioDia>();
    servicios.forEach((s) => map.set(s.fecha, s));
    return map;
  }, [servicios]);

  // Filtrar y ordenar personas activas (Cabos primero, luego Soldados)
  const personasFiltradas = useMemo(() => {
    const activas = personas.filter((p) => p.activo);
    const cabos = activas
      .filter((p) => p.empleo === 'CABO')
      .sort(
        (a, b) =>
          (a.ordenRotacion ?? 999) - (b.ordenRotacion ?? 999) ||
          a.nombre.localeCompare(b.nombre)
      );
    const soldados = activas
      .filter((p) => p.empleo === 'SOLDADO')
      .sort(
        (a, b) =>
          (a.ordenRotacion ?? 999) - (b.ordenRotacion ?? 999) ||
          a.nombre.localeCompare(b.nombre)
      );

    let lista = [...cabos, ...soldados];

    if (filtroEmpleo !== 'TODOS') {
      lista = lista.filter((p) => p.empleo === filtroEmpleo);
    }

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      lista = lista.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          p.unidad.toLowerCase().includes(q) ||
          p.empleo.toLowerCase().includes(q)
      );
    }

    return lista;
  }, [personas, filtroEmpleo, busqueda]);

  // Generar lista de días del mes actual
  const diasDelMes = useMemo(() => {
    const lista: {
      diaNumero: number;
      fechaStr: string;
      diaSemanaLetra: string;
      diaSemanaNombre: string;
      esFinDeSemana: boolean;
      servicio?: ServicioDia;
    }[] = [];

    for (let d = 1; d <= mesActualInfo.dias; d++) {
      const fechaStr = `${mesActualInfo.key}-${d.toString().padStart(2, '0')}`;
      const dateObj = new Date(fechaStr);
      const diaSemanaIndex = dateObj.getDay(); // 0 = Domingo, 6 = Sábado
      const esFinDeSemana = diaSemanaIndex === 0 || diaSemanaIndex === 6;

      lista.push({
        diaNumero: d,
        fechaStr,
        diaSemanaLetra: DIAS_SEMANA_CORTO[diaSemanaIndex],
        diaSemanaNombre: DIAS_SEMANA_NOMBRE[diaSemanaIndex],
        esFinDeSemana,
        servicio: serviciosPorFecha.get(fechaStr),
      });
    }

    return lista;
  }, [mesActualInfo, serviciosPorFecha]);

  // Estadísticas del mes actual
  const statsMes = useMemo(() => {
    let guardiasEnMes = 0;
    let finesDeSemanaEnMes = 0;

    diasDelMes.forEach((d) => {
      if (d.servicio) guardiasEnMes++;
      if (d.esFinDeSemana) finesDeSemanaEnMes++;
    });

    return {
      diasTotales: mesActualInfo.dias,
      guardias: guardiasEnMes,
      finesDeSemana: finesDeSemanaEnMes,
      efectivos: personasFiltradas.length,
    };
  }, [diasDelMes, mesActualInfo, personasFiltradas]);

  const handleDescargarExcel = () => {
    descargarCuadranteExcel(cuadrante, servicios, personas);
  };

  const handleMesAnterior = () => {
    const currentIndex = MESES_OFICIALES.findIndex((m) => m.key === selectedMesKey);
    if (currentIndex > 0) {
      setSelectedMesKey(MESES_OFICIALES[currentIndex - 1].key);
    }
  };

  const handleMesSiguiente = () => {
    const currentIndex = MESES_OFICIALES.findIndex((m) => m.key === selectedMesKey);
    if (currentIndex < MESES_OFICIALES.length - 1) {
      setSelectedMesKey(MESES_OFICIALES[currentIndex + 1].key);
    }
  };

  return (
    <div id="section-cuadrante-mensual-grid" className="space-y-4">
      {/* 1. Header de Controles de Mes y Exportación */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Selector de Mes con Botones Rápidos */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <button
                onClick={handleMesAnterior}
                disabled={selectedMesKey === MESES_OFICIALES[0].key}
                className="rounded-xl border border-slate-200 p-2 hover:bg-slate-100 disabled:opacity-30 dark:border-slate-700 dark:hover:bg-slate-800 transition"
                title="Mes anterior"
              >
                <ChevronLeft className="h-4 w-4 text-slate-700 dark:text-slate-300" />
              </button>

              <select
                value={selectedMesKey}
                onChange={(e) => setSelectedMesKey(e.target.value)}
                className="rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-black text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {MESES_OFICIALES.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.nombre} ({m.dias} días)
                  </option>
                ))}
              </select>

              <button
                onClick={handleMesSiguiente}
                disabled={
                  selectedMesKey === MESES_OFICIALES[MESES_OFICIALES.length - 1].key
                }
                className="rounded-xl border border-slate-200 p-2 hover:bg-slate-100 disabled:opacity-30 dark:border-slate-700 dark:hover:bg-slate-800 transition"
                title="Mes siguiente"
              >
                <ChevronRight className="h-4 w-4 text-slate-700 dark:text-slate-300" />
              </button>
            </div>

            {/* Píldoras de Meses para Acceso Rápido */}
            <div className="hidden xl:flex items-center gap-1">
              {MESES_OFICIALES.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setSelectedMesKey(m.key)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition ${
                    selectedMesKey === m.key
                      ? 'bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  {m.nombre.split(' ')[0].substring(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {/* Acciones y Botón Descargar Excel */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Selector de Modo de Vista (Personal vs General) */}
            {currentPersonaId && (
              <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-800">
                <button
                  onClick={() => setModoVista('PERSONAL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    modoVista === 'PERSONAL'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Mi Vista Personal</span>
                </button>
                <button
                  onClick={() => setModoVista('GENERAL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    modoVista === 'GENERAL'
                      ? 'bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Matriz General</span>
                </button>
              </div>
            )}

            {/* Buscador Rápido (solo en modo general) */}
            {modoVista === 'GENERAL' && (
              <div className="relative min-w-[180px] flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            )}

            {/* Filtro Empleo (solo en modo general) */}
            {modoVista === 'GENERAL' && (
              <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-800">
                <button
                  onClick={() => setFiltroEmpleo('TODOS')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                    filtroEmpleo === 'TODOS'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Todos ({personas.filter((p) => p.activo).length})
                </button>
                <button
                  onClick={() => setFiltroEmpleo('CABO')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                    filtroEmpleo === 'CABO'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Cabos
                </button>
                <button
                  onClick={() => setFiltroEmpleo('SOLDADO')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                    filtroEmpleo === 'SOLDADO'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Soldados
                </button>
              </div>
            )}

            {/* BOTÓN EXCEL OFICIAL */}
            <button
              onClick={handleDescargarExcel}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
              title="Descargar Cuadrante Completo en formato Excel (.xlsx)"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Descargar cuadrante Excel</span>
            </button>
          </div>
        </div>

        {/* 2. Barra de Leyenda y Estadísticas del Mes */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800 text-xs">
          {/* LEYENDA CLARA */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[11px] font-bold uppercase text-slate-400">
              Leyenda:
            </span>

            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-900 font-mono text-[10px] font-black text-white dark:bg-white dark:text-slate-900">
                S
              </span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Servicio Titular (24h)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500 font-mono text-[10px] font-black text-slate-950">
                I
              </span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Imaginaria Retén (24h)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 font-mono text-[10px] font-bold text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                -
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                Libre / Descanso
              </span>
            </div>

            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-700">
              <span className="h-3 w-3 rounded-sm bg-red-100 border border-red-300 dark:bg-red-950/60 dark:border-red-800" />
              <span className="text-slate-600 dark:text-slate-400">
                Fin de Semana (Sáb/Dom)
              </span>
            </div>
          </div>

          {/* Estadísticas */}
          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
            <span>
              Mes: <strong className="text-slate-900 dark:text-white">{mesActualInfo.nombre}</strong>
            </span>
            <span>•</span>
            <span>
              <strong className="text-slate-900 dark:text-white">{statsMes.guardias}</strong> guardias programadas
            </span>
          </div>
        </div>
      </div>

      {/* 3. VISTA PERSONAL MENSUAL O MATRIZ GENERAL */}
      {modoVista === 'PERSONAL' && currentPersonaObj ? (
        <div className="space-y-4">
          {/* Tarjeta Resumen Personal del Mes */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-black uppercase">
                  {currentPersonaObj.empleo}
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Calendario de {currentPersonaObj.nombre} — {mesActualInfo.nombre}
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                Visualización de tus servicios de guardia e imaginarias programados para este mes (08:00 a 08:00).
              </p>
            </div>

            {/* Conteo de servicios del usuario */}
            <div className="flex items-center gap-3">
              <div className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-xs">
                <div className="text-base font-black text-slate-900 dark:text-white">
                  {
                    diasDelMes.filter(
                      (d) => getEstadoPersonaEnServicio(d.servicio, currentPersonaObj.id) === 'S'
                    ).length
                  }
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Guardias
                </div>
              </div>

              <div className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-xs">
                <div className="text-base font-black text-amber-600 dark:text-amber-400">
                  {
                    diasDelMes.filter(
                      (d) => getEstadoPersonaEnServicio(d.servicio, currentPersonaObj.id) === 'I'
                    ).length
                  }
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-500">
                  Imaginarias
                </div>
              </div>
            </div>
          </div>

          {/* Calendario Personal Grid de Días (7 columnas: Lun a Dom) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5">
            {diasDelMes.map((d) => {
              const estado = getEstadoPersonaEnServicio(d.servicio, currentPersonaObj.id);
              const esServicio = estado === 'S';
              const esImaginaria = estado === 'I';

              return (
                <div
                  key={d.fechaStr}
                  className={`p-3 rounded-2xl border transition-all flex flex-col justify-between min-h-[110px] ${
                    esServicio
                      ? 'bg-slate-900 text-white border-slate-900 shadow-md dark:bg-blue-950 dark:border-blue-700'
                      : esImaginaria
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/80 shadow-xs'
                      : d.esFinDeSemana
                      ? 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60 opacity-80'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-base font-black ${
                          esServicio
                            ? 'text-white'
                            : esImaginaria
                            ? 'text-amber-900 dark:text-amber-200'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {d.diaNumero}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase ${
                          esServicio
                            ? 'text-slate-300'
                            : d.esFinDeSemana
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {d.diaSemanaNombre.substring(0, 3)}
                      </span>
                    </div>

                    {d.esFinDeSemana && (
                      <span
                        className={`px-1.5 py-0.5 text-[9px] font-black rounded-md ${
                          esServicio
                            ? 'bg-red-500/30 text-red-200 border border-red-400/40'
                            : 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                        }`}
                      >
                        FDS
                      </span>
                    )}
                  </div>

                  <div className="mt-2">
                    {esServicio ? (
                      <div className="space-y-1">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-blue-500 text-white font-mono text-[10px] font-black tracking-wider">
                          GUARDIA 24H
                        </span>
                        <p className="text-[10px] text-slate-300">08:00 a 08:00 (+1)</p>
                      </div>
                    ) : esImaginaria ? (
                      <div className="space-y-1">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-mono text-[10px] font-black tracking-wider">
                          IMAGINARIA 24H
                        </span>
                        <p className="text-[10px] text-amber-800 dark:text-amber-300">
                          Retén localizable
                        </p>
                      </div>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                        Libre
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* MATRIZ GENERAL COMPLETA */
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-center text-xs">
              {/* CABECERA DE DÍAS */}
              <thead>
                {/* Fila 1: Días del mes (1..N) */}
                <tr className="bg-slate-100/90 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  {/* Columna Fija: Persona */}
                  <th className="sticky left-0 z-20 min-w-[220px] max-w-[260px] bg-slate-100 dark:bg-slate-950 px-3.5 py-2.5 text-left font-black uppercase text-[11px] tracking-wider border-r border-slate-200 dark:border-slate-800">
                    Personal ({personasFiltradas.length})
                  </th>

                  {/* Columnas de Días */}
                  {diasDelMes.map((d) => (
                    <th
                      key={d.fechaStr}
                      className={`min-w-[34px] px-1 py-1.5 font-bold border-r border-slate-200/70 dark:border-slate-800/80 ${
                        d.esFinDeSemana
                          ? 'bg-red-50/80 text-red-900 dark:bg-red-950/40 dark:text-red-300'
                          : ''
                      }`}
                    >
                      <div className="text-xs font-black">{d.diaNumero}</div>
                      <div
                        className={`text-[9px] uppercase font-extrabold ${
                          d.esFinDeSemana
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {d.diaSemanaLetra}
                      </div>
                    </th>
                  ))}

                  {/* Resumen del mes */}
                  <th className="min-w-[48px] px-2 py-2 text-[10px] font-black uppercase tracking-wider bg-slate-200/70 dark:bg-slate-900 border-l border-slate-300 dark:border-slate-700">
                    Serv.
                  </th>
                  <th className="min-w-[48px] px-2 py-2 text-[10px] font-black uppercase tracking-wider bg-amber-100/60 dark:bg-amber-950/40 text-amber-950 dark:text-amber-300">
                    Imag.
                  </th>
                </tr>
              </thead>

              {/* CUERPO DE FILAS: 1 FILA POR PERSONA */}
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {personasFiltradas.map((persona, pIndex) => {
                  const esUsuarioActual = currentPersonaId === persona.id;
                  const esCabo = persona.empleo === 'CABO';

                  let totalServPersonaMes = 0;
                  let totalImagPersonaMes = 0;

                  return (
                    <tr
                      key={persona.id}
                      className={`transition-colors ${
                        esUsuarioActual
                          ? 'bg-blue-50/70 dark:bg-blue-950/30'
                          : pIndex % 2 === 0
                          ? 'bg-white dark:bg-slate-900'
                          : 'bg-slate-50/40 dark:bg-slate-850/40'
                      } hover:bg-blue-50/50 dark:hover:bg-slate-800/60`}
                    >
                      {/* COLUMNA FIJA: EFECTIVO (EMPLEO + NOMBRE + UNIDAD) */}
                      <td
                        className={`sticky left-0 z-10 px-3.5 py-2 text-left border-r border-slate-200 dark:border-slate-800 ${
                          esUsuarioActual
                            ? 'bg-blue-100/90 dark:bg-blue-950 text-blue-950 dark:text-blue-100 font-bold'
                            : pIndex % 2 === 0
                            ? 'bg-white dark:bg-slate-900'
                            : 'bg-slate-50 dark:bg-slate-850'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-black ${
                              esCabo
                                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}
                          >
                            {esCabo ? 'C' : 'S'}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1 truncate">
                              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {persona.nombre}
                              </span>
                              {esUsuarioActual && (
                                <span className="rounded bg-blue-600 px-1 py-0.2 text-[9px] font-black text-white shrink-0">
                                  TÚ
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate block">
                              {persona.unidad || 'GOE III'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* CELDAS DE DÍAS (1..N) */}
                      {diasDelMes.map((d) => {
                        const estado = getEstadoPersonaEnServicio(d.servicio, persona.id);

                        if (estado === 'S') totalServPersonaMes++;
                        if (estado === 'I') totalImagPersonaMes++;

                        return (
                          <td
                            key={d.fechaStr}
                            onMouseEnter={() =>
                              setHoveredCell({
                                fecha: d.fechaStr,
                                personaNombre: persona.nombre,
                                empleo: persona.empleo,
                                estado,
                              })
                            }
                            onMouseLeave={() => setHoveredCell(null)}
                            className={`p-1 text-center border-r border-slate-100 dark:border-slate-800/50 ${
                              d.esFinDeSemana
                                ? 'bg-red-50/30 dark:bg-red-950/20'
                                : ''
                            }`}
                          >
                            {estado === 'S' ? (
                              <span
                                title={`${d.diaSemanaNombre} ${d.diaNumero} ${mesActualInfo.nombre}: SERVICIO TITULAR 24h (08:00 a 08:00)`}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 font-mono text-[11px] font-black text-white shadow-xs dark:bg-white dark:text-slate-950"
                              >
                                S
                              </span>
                            ) : estado === 'I' ? (
                              <span
                                title={`${d.diaSemanaNombre} ${d.diaNumero} ${mesActualInfo.nombre}: IMAGINARIA DE RETÉN (08:00 a 08:00)`}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-amber-400 font-mono text-[11px] font-black text-slate-950 shadow-xs dark:bg-amber-500"
                              >
                                I
                              </span>
                            ) : (
                              <span
                                title={`${d.diaSemanaNombre} ${d.diaNumero} ${mesActualInfo.nombre}: LIBRE / DESCANSO`}
                                className="inline-flex h-5 w-5 items-center justify-center font-mono text-[10px] font-semibold text-slate-400 dark:text-slate-500 select-none"
                              >
                                L
                              </span>
                            )}
                          </td>
                        );
                      })}

                      {/* RESUMEN TOTAL DEL MES */}
                      <td className="px-2 py-2 font-mono text-xs font-black text-slate-900 dark:text-white bg-slate-100/50 dark:bg-slate-900/50 border-l border-slate-200 dark:border-slate-800">
                        {totalServPersonaMes}
                      </td>
                      <td className="px-2 py-2 font-mono text-xs font-black text-amber-800 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20">
                        {totalImagPersonaMes}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Pie Informativo y Garantía de Privacidad */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>
            <strong>Privacidad operativa garantizada:</strong> Esta vista no expone DNI, teléfonos, partes médicos ni notas personales.
          </span>
        </div>

        <div className="flex items-center gap-1 font-mono text-[11px]">
          <span>Horario guardias: <strong>08:00 a 08:00</strong> (24h)</span>
        </div>
      </div>
    </div>
  );
};
