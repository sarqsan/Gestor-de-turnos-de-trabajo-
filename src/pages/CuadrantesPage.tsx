import React, { useState, useEffect } from 'react';
import {
  Persona,
  CuadranteMaestro,
  ServicioDia,
  CuadranteSimulacionResult,
} from '../types';
import {
  getCuadrantes,
  getServiciosByCuadranteId,
  confirmarCuadrante,
  modificarServicioManual,
} from '../services/cuadranteService';
import { generarSimulacionCuadrante } from '../services/cuadranteGeneratorService';
import { CuadranteTableView } from '../components/cuadrante/CuadranteTableView';
import { CuadranteMensualView } from '../components/cuadrante/CuadranteMensualView';
import { CuadranteMetricasPanel } from '../components/cuadrante/CuadranteMetricasPanel';
import { descargarCuadranteExcel } from '../services/excelCuadranteExport';
import { CuadranteValidacionPanel } from '../components/cuadrante/CuadranteValidacionPanel';
import { CuadranteSimulacionView } from '../components/cuadrante/CuadranteSimulacionView';
import { CuadranteEdicionManualModal } from '../components/cuadrante/CuadranteEdicionManualModal';
import { OrdenRotacionModal } from '../components/rotacion/OrdenRotacionModal';
import { NuevoCicloModal } from '../components/ciclos/NuevoCicloModal';
import { useAuth } from '../firebase/context';
import {
  CalendarDays,
  Plus,
  Sparkles,
  Award,
  Users,
  ShieldCheck,
  UserCheck,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Calendar,
  Layers,
  FileSpreadsheet,
  AlertCircle,
  ListOrdered,
  CalendarPlus,
} from 'lucide-react';

interface CuadrantesPageProps {
  personas: Persona[];
  onRefreshPersonal?: () => Promise<void>;
}

export const CuadrantesPage: React.FC<CuadrantesPageProps> = ({
  personas,
  onRefreshPersonal,
}) => {
  const { currentCuenta, isAdmin } = useAuth();

  // Estados principales
  const [cuadrantes, setCuadrantes] = useState<CuadranteMaestro[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'lista' | 'crear' | 'simulacion' | 'detalle'>('lista');

  // Estado de generación
  const [nombreCuadrante, setNombreCuadrante] = useState('Cuadrante Guardias 2026 - 2027');
  const [cicloId, setCicloId] = useState('Ciclo 2026 - 2027');
  const [fechaInicio, setFechaInicio] = useState('2026-09-01');
  const [fechaFin, setFechaFin] = useState('2027-02-28'); // Periodo oficial 2026-2027 (6 meses)

  // Estado de simulación activa en memoria
  const [simulacionActiva, setSimulacionActiva] = useState<CuadranteSimulacionResult | null>(null);

  // Estado de cuadrante seleccionado para visualización
  const [selectedCuadrante, setSelectedCuadrante] = useState<CuadranteMaestro | null>(null);
  const [selectedServicios, setSelectedServicios] = useState<ServicioDia[]>([]);
  const [detalleTab, setDetalleTab] = useState<'mensual' | 'tabla' | 'metricas'>('mensual');
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);

  // Estado de edición manual
  const [editingServicio, setEditingServicio] = useState<ServicioDia | null>(null);
  const [editingSlot, setEditingSlot] = useState<'cabo_1' | 'cabo_2' | 'soldado_1' | 'soldado_2' | 'cabo_imag' | 'soldado_imag'>('cabo_1');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Cargar lista de cuadrantes
  const cargarCuadrantes = async () => {
    setLoading(true);
    try {
      const data = await getCuadrantes();
      setCuadrantes(data);
    } catch (err) {
      console.error('Error cargando cuadrantes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCuadrantes();
  }, []);

  const personasActivas = (personas || []).filter((p) => p.activo);
  const cabosActivos = personasActivas
    .filter((p) => p.empleo === 'CABO')
    .sort((a, b) => (a.ordenRotacion ?? 999) - (b.ordenRotacion ?? 999));
  const soldadosActivos = personasActivas
    .filter((p) => p.empleo === 'SOLDADO')
    .sort((a, b) => (a.ordenRotacion ?? 999) - (b.ordenRotacion ?? 999));

  // Calcular días entre fechas
  const calcularTotalDias = () => {
    const d1 = new Date(fechaInicio);
    const d2 = new Date(fechaFin);
    const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return isNaN(diff) || diff < 1 ? 0 : diff;
  };

  const adminInfo = {
    uid: currentCuenta?.uid || 'admin-system',
    nombre: currentCuenta?.nombre || 'Administrador',
  };

  // Manejar Generación en Memoria
  const handleGenerarSimulacion = () => {
    if (cabosActivos.length < 2 || soldadosActivos.length < 2) {
      alert('Se requieren al menos 2 Cabos y 2 Soldados activos para generar un cuadrante.');
      return;
    }
    if (calcularTotalDias() <= 0) {
      alert('La fecha final debe ser posterior a la fecha inicial.');
      return;
    }

    const resultado = generarSimulacionCuadrante({
      nombre: nombreCuadrante.trim() || 'Cuadrante Generado',
      cicloId,
      fechaInicio,
      fechaFin,
      personasActivas,
      creadoPorUid: adminInfo.uid,
      creadoPorNombre: adminInfo.nombre,
    });

    setSimulacionActiva(resultado);
    setActiveView('simulacion');
  };

  // Manejar Confirmación de Simulación
  const handleConfirmarSimulacion = async (sim: CuadranteSimulacionResult) => {
    const res = await confirmarCuadrante(sim, adminInfo);
    if (res.success) {
      await cargarCuadrantes();
      const cuadranteGuardado = cuadrantes.find((c) => c.id === sim.cuadrante.id) || sim.cuadrante;
      setSelectedCuadrante(cuadranteGuardado);
      setSelectedServicios(sim.servicios);
      setActiveView('detalle');
    } else {
      throw new Error(res.message);
    }
  };

  // Ver cuadrante existente
  const handleVerCuadrante = async (cuadrante: CuadranteMaestro) => {
    setLoading(true);
    try {
      const srvs = await getServiciosByCuadranteId(cuadrante.id);
      setSelectedCuadrante(cuadrante);
      setSelectedServicios(srvs);
      setActiveView('detalle');
    } catch (err) {
      console.error('Error cargando servicios:', err);
    } finally {
      setLoading(false);
    }
  };

  // Abrir modal de edición manual
  const handleAbrirEdicionManual = (
    servicio: ServicioDia,
    slotTipo: 'cabo_1' | 'cabo_2' | 'soldado_1' | 'soldado_2' | 'cabo_imag' | 'soldado_imag'
  ) => {
    setEditingServicio(servicio);
    setEditingSlot(slotTipo);
    setIsEditModalOpen(true);
  };

  // Guardar edición manual
  const handleGuardarEdicionManual = async (params: {
    slotTipo: 'cabo_1' | 'cabo_2' | 'soldado_1' | 'soldado_2' | 'cabo_imag' | 'soldado_imag';
    nuevaPersonaId: string;
    motivo: string;
  }) => {
    if (!selectedCuadrante || !editingServicio) return;

    const res = await modificarServicioManual({
      cuadranteId: selectedCuadrante.id,
      servicioId: editingServicio.id,
      slotTipo: params.slotTipo,
      nuevaPersonaId: params.nuevaPersonaId,
      motivo: params.motivo,
      personas,
      adminInfo,
    });

    if (!res.success) {
      throw new Error(res.message);
    }

    // Refrescar servicios
    const srvsActualizados = await getServiciosByCuadranteId(selectedCuadrante.id);
    setSelectedServicios(srvsActualizados);
    const cActualizado = (await getCuadrantes()).find((c) => c.id === selectedCuadrante.id);
    if (cActualizado) setSelectedCuadrante(cActualizado);
  };

  return (
    <div className="space-y-6">
      {/* VISTA 1: SIMULACIÓN EN MEMORIA */}
      {activeView === 'simulacion' && simulacionActiva && (
        <CuadranteSimulacionView
          simulacion={simulacionActiva}
          personas={personas}
          onBack={() => setActiveView('crear')}
          onConfirmar={handleConfirmarSimulacion}
        />
      )}

      {/* VISTA 2: FORMULARIO DE CONFIGURACIÓN Y GENERACIÓN */}
      {activeView === 'crear' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveView('lista')}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-slate-100">
                  Configuración y Generación de Cuadrante
                </h2>
                <p className="text-xs text-slate-500">
                  Generación circular provisional desacoplada por empleo con rotación en memoria
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Parámetros Generales */}
            <div className="lg:col-span-2 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Parámetros del Periodo
              </h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Nombre del Cuadrante
                  </label>
                  <input
                    type="text"
                    value={nombreCuadrante}
                    onChange={(e) => setNombreCuadrante(e.target.value)}
                    placeholder="Ej: Cuadrante Guardias 2026"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Ciclo / Promoción
                  </label>
                  <input
                    type="text"
                    value={cicloId}
                    onChange={(e) => setCicloId(e.target.value)}
                    placeholder="Ej: Ciclo Inicial 2026"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Fecha Inicial
                  </label>
                  <input
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Fecha Final
                  </label>
                  <input
                    type="date"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Estadísticas en vivo */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-center">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-500">Duración Total</div>
                    <div className="text-lg font-black text-slate-900 dark:text-slate-100">
                      {calcularTotalDias()} <span className="text-xs font-normal">días</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-500">Personal Activo</div>
                    <div className="text-lg font-black text-slate-900 dark:text-slate-100">
                      {personasActivas.length} <span className="text-xs font-normal">efectivos</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400">Cabos Activos</div>
                    <div className="text-lg font-black text-indigo-700 dark:text-indigo-300">
                      {cabosActivos.length}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Soldados Activos</div>
                    <div className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                      {soldadosActivos.length}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveView('lista')}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleGenerarSimulacion}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-all"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Generar Simulación en Memoria</span>
                </button>
              </div>
            </div>

            {/* Orden de Rotación de la Plantilla */}
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Orden de Rotación ({personasActivas.length})
              </h3>
              <p className="text-[11px] text-slate-500">
                El generador rota independientemente Cabos y Soldados según su posición.
              </p>

              <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1 text-xs">
                {/* Cabos */}
                <div>
                  <div className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400 mb-1.5 flex justify-between">
                    <span>Cabos ({cabosActivos.length})</span>
                    <span>Orden</span>
                  </div>
                  <div className="space-y-1">
                    {cabosActivos.map((c, idx) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-800/60"
                      >
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{c.nombre}</span>
                        <span className="font-mono text-[10px] font-bold text-slate-500">
                          #{c.ordenRotacion ?? idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Soldados */}
                <div>
                  <div className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 mb-1.5 flex justify-between">
                    <span>Soldados ({soldadosActivos.length})</span>
                    <span>Orden</span>
                  </div>
                  <div className="space-y-1">
                    {soldadosActivos.map((s, idx) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-800/60"
                      >
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{s.nombre}</span>
                        <span className="font-mono text-[10px] font-bold text-slate-500">
                          #{s.ordenRotacion ?? idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VISTA 3: DETALLE DE CUADRANTE CONFIRMADO */}
      {activeView === 'detalle' && selectedCuadrante && (
        <div className="space-y-6">
          {/* Header del Cuadrante Confirmado */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveView('lista')}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    CUADRANTE CONFIRMADO
                  </span>
                  <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
                    {selectedCuadrante.nombre}
                  </h2>
                </div>

                <p className="mt-1 text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>
                    Periodo: <strong className="text-slate-800 dark:text-slate-200">{selectedCuadrante.fechaInicio}</strong> al <strong className="text-slate-800 dark:text-slate-200">{selectedCuadrante.fechaFin}</strong> ({selectedCuadrante.totalDias} días)
                  </span>
                  <span>•</span>
                  <span>
                    Plantilla: <strong className="text-slate-800 dark:text-slate-200">{selectedCuadrante.totalCabos} Cabos</strong> + <strong className="text-slate-800 dark:text-slate-200">{selectedCuadrante.totalSoldados} Soldados</strong> ({selectedCuadrante.totalPersonas} total)
                  </span>
                  <span>•</span>
                  <span>
                    Creado por: <strong className="text-slate-800 dark:text-slate-200">{selectedCuadrante.creadoPorNombre || 'Admin'}</strong>
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-800 dark:bg-slate-950 text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Score Equilibrio</div>
                  <div className="text-base font-black text-slate-900 dark:text-slate-100">
                    {selectedCuadrante.metricasEquilibrio.scoreEquilibrio}<span className="text-xs font-normal opacity-70">/100</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Selector de Pestañas */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto">
            <button
              onClick={() => setDetalleTab('mensual')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all whitespace-nowrap ${
                detalleTab === 'mensual'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Calendar className="h-4 w-4" />
              <span>Matriz Mensual & Excel Oficial</span>
            </button>

            <button
              onClick={() => setDetalleTab('tabla')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all whitespace-nowrap ${
                detalleTab === 'tabla'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Layers className="h-4 w-4" />
              <span>Vista Tarjetas & Diarios ({selectedServicios.length} días)</span>
            </button>

            <button
              onClick={() => setDetalleTab('metricas')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all whitespace-nowrap ${
                detalleTab === 'metricas'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Award className="h-4 w-4" />
              <span>Estadísticas de Reparto y Descansos</span>
            </button>
          </div>

          {/* Contenido Pestaña */}
          <div>
            {detalleTab === 'mensual' && (
              <CuadranteMensualView
                cuadrante={selectedCuadrante}
                servicios={selectedServicios}
                personas={personas}
                isAdmin={isAdmin}
              />
            )}

            {detalleTab === 'tabla' && (
              <CuadranteTableView
                servicios={selectedServicios}
                personas={personas}
                isAdmin={isAdmin}
                onEditSlot={handleAbrirEdicionManual}
                selectedPersonaId={selectedPersonaId}
                onSelectPersona={setSelectedPersonaId}
              />
            )}

            {detalleTab === 'metricas' && (
              <CuadranteMetricasPanel
                metricas={selectedCuadrante.metricasEquilibrio}
                selectedPersonaId={selectedPersonaId}
                onSelectPersona={(id) => {
                  setSelectedPersonaId(id);
                  setDetalleTab('mensual');
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* VISTA 4: LISTADO GENERAL DE CUADRANTES */}
      {activeView === 'lista' && (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Gestión de Cuadrantes (24h)
              </h2>
              <p className="text-xs text-slate-500">
                Rotaciones de guardias (2 Cabos + 2 Soldados) y coberturas de imaginaria (1 Cabo + 1 Soldado)
              </p>
            </div>

            {isAdmin && (
              <button
                onClick={() => setActiveView('crear')}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>Nuevo Cuadrante</span>
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex h-48 items-center justify-center rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
            </div>
          ) : cuadrantes.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
              <div className="rounded-full bg-blue-50 p-3 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                <CalendarDays className="h-8 w-8" />
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-slate-100">
                No hay cuadrantes confirmados
              </h3>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                Genera tu primer cuadrante con el motor de simulación matemática para el ciclo actual.
              </p>
              {isAdmin && (
                <button
                  onClick={() => setActiveView('crear')}
                  className="mt-4 flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Generar Simulación Inicial</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {cuadrantes.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all dark:border-slate-800 dark:bg-slate-900"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                        {c.estado}
                      </span>
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Score:</span>{' '}
                        <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                          {c.metricasEquilibrio?.scoreEquilibrio ?? 100}/100
                        </span>
                      </div>
                    </div>

                    <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-slate-100">
                      {c.nombre}
                    </h3>
                    <div className="mt-1 text-xs text-slate-500 space-y-1">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{c.fechaInicio} al {c.fechaFin} ({c.totalDias} días)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        <span>{c.totalCabos} Cabos + {c.totalSoldados} Soldados ({c.totalPersonas} total)</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <button
                      onClick={() => handleVerCuadrante(c)}
                      className="w-full rounded-xl bg-slate-100 py-2 text-xs font-bold text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-all"
                    >
                      Consultar Cuadrante Completo
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de Edición Manual Administrativa */}
      {isEditModalOpen && editingServicio && (
        <CuadranteEdicionManualModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          servicio={editingServicio}
          slotTipo={editingSlot}
          personas={personas}
          onSave={handleGuardarEdicionManual}
        />
      )}
    </div>
  );
};
