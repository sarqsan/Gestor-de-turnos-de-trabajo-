import React, { useState, useMemo } from 'react';
import { Persona, Cuenta, Empleo, EstadoAcceso, Unidad } from '../types';
import { PersonaFilters } from '../components/personal/PersonaFilters';
import { PersonaTable } from '../components/personal/PersonaTable';
import { PersonaFormModal } from '../components/personal/PersonaFormModal';
import { WhatsAppModal } from '../components/personal/WhatsAppModal';
import { determinarEstadoAcceso } from '../services/cuentasService';
import { Plus, Users, Download, Shield } from 'lucide-react';

interface PersonalPageProps {
  personas: Persona[];
  cuentas: Cuenta[];
  onSavePersona: (data: {
    nombre: string;
    empleo: Empleo;
    unidad: Unidad;
    dni: string;
    telefono: string;
    activo: boolean;
    notas?: string;
  }) => Promise<void>;
  onUpdatePersona: (
    id: string,
    data: Partial<Persona>
  ) => Promise<void>;
  onTogglePersonaActive: (persona: Persona) => Promise<void>;
  onOpenDetail: (persona: Persona) => void;
  onImpersonatePersona?: (persona: Persona) => void;
}

export const PersonalPage: React.FC<PersonalPageProps> = ({
  personas,
  cuentas,
  onSavePersona,
  onUpdatePersona,
  onTogglePersonaActive,
  onOpenDetail,
  onImpersonatePersona,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filtroEmpleo, setFiltroEmpleo] = useState<'TODOS' | Empleo>('TODOS');
  const [filtroUnidad, setFiltroUnidad] = useState<'TODAS' | Unidad>('TODAS');
  const [filtroEstado, setFiltroEstado] = useState<'TODOS' | 'ACTIVOS' | 'INACTIVOS'>('TODOS');
  const [filtroAcceso, setFiltroAcceso] = useState<'TODOS' | EstadoAcceso>('TODOS');

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [waModalPersona, setWaModalPersona] = useState<Persona | null>(null);

  const handleOpenCreateModal = () => {
    setEditingPersona(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (persona: Persona) => {
    setEditingPersona(persona);
    setIsFormModalOpen(true);
  };

  const handleSaveModal = async (data: any) => {
    if (editingPersona) {
      await onUpdatePersona(editingPersona.id, data);
    } else {
      await onSavePersona(data);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setFiltroEmpleo('TODOS');
    setFiltroUnidad('TODAS');
    setFiltroEstado('TODOS');
    setFiltroAcceso('TODOS');
  };

  // Filtrado reactivo en memoria
  const personasFiltradas = useMemo(() => {
    return (personas || []).filter((p) => {
      // 1. Search Query (Nombre, DNI, Teléfono)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNombre = p.nombre.toLowerCase().includes(q);
        const matchDni = p.dni ? p.dni.toLowerCase().includes(q) : false;
        const matchTel = p.telefono ? p.telefono.includes(q) : false;
        if (!matchNombre && !matchDni && !matchTel) return false;
      }

      // 2. Empleo
      if (filtroEmpleo !== 'TODOS' && p.empleo !== filtroEmpleo) {
        return false;
      }

      // 3. Unidad
      if (filtroUnidad !== 'TODAS' && p.unidad !== filtroUnidad) {
        return false;
      }

      // 4. Estado Operativo
      if (filtroEstado === 'ACTIVOS' && !p.activo) return false;
      if (filtroEstado === 'INACTIVOS' && p.activo) return false;

      // 5. Estado de Acceso
      if (filtroAcceso !== 'TODOS') {
        const acc = determinarEstadoAcceso(p.id, cuentas);
        if (acc !== filtroAcceso) return false;
      }

      return true;
    });
  }, [personas, cuentas, searchQuery, filtroEmpleo, filtroUnidad, filtroEstado, filtroAcceso]);

  const activeCount = personasFiltradas.filter((p) => p.activo).length;
  const cabosCount = personasFiltradas.filter((p) => p.activo && p.empleo === 'CABO').length;
  const soldadosCount = personasFiltradas.filter((p) => p.activo && p.empleo === 'SOLDADO').length;

  return (
    <div id="personal-page" className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            Gestión de Personal
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Mostrando {personasFiltradas.length} de {personas.length} registros ({activeCount} activos: {cabosCount} Cabos, {soldadosCount} Soldados)
          </p>
        </div>

        <button
          id="btn-alta-manual-personal"
          type="button"
          onClick={handleOpenCreateModal}
          className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-slate-800 transition-all dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Nueva Persona</span>
        </button>
      </div>

      {/* Filter Component */}
      <PersonaFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filtroEmpleo={filtroEmpleo}
        onFiltroEmpleoChange={setFiltroEmpleo}
        filtroUnidad={filtroUnidad}
        onFiltroUnidadChange={setFiltroUnidad}
        filtroEstado={filtroEstado}
        onFiltroEstadoChange={setFiltroEstado}
        filtroAcceso={filtroAcceso}
        onFiltroAccesoChange={setFiltroAcceso}
        onResetFilters={handleResetFilters}
      />

      {/* Main Table / Mobile Cards */}
      <PersonaTable
        personas={personasFiltradas}
        cuentas={cuentas}
        onOpenDetail={onOpenDetail}
        onEdit={handleOpenEditModal}
        onToggleActive={onTogglePersonaActive}
        onOpenWhatsApp={(p) => setWaModalPersona(p)}
        onImpersonate={onImpersonatePersona}
      />

      {/* Form Modal for Create / Edit */}
      <PersonaFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSave={handleSaveModal}
        personaEditar={editingPersona}
      />

      {/* WhatsApp Invite Modal */}
      <WhatsAppModal
        isOpen={!!waModalPersona}
        onClose={() => setWaModalPersona(null)}
        persona={waModalPersona}
        cuenta={waModalPersona ? cuentas.find((c) => c.personaId === waModalPersona.id) : null}
      />
    </div>
  );
};
