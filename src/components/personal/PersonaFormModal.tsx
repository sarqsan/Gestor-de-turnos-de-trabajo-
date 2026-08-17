import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Empleo, Persona, Unidad, UNIDADES_VALIDAS } from '../../types';
import { validatePersonData } from '../../utils/validators';

interface PersonaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    nombre: string;
    empleo: Empleo;
    unidad: Unidad;
    dni: string;
    telefono: string;
    activo: boolean;
    notas?: string;
  }) => Promise<void>;
  personaEditar?: Persona | null;
}

export const PersonaFormModal: React.FC<PersonaFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  personaEditar,
}) => {
  const [nombre, setNombre] = useState('');
  const [empleo, setEmpleo] = useState<Empleo>('SOLDADO');
  const [unidad, setUnidad] = useState<Unidad>('GOE III');
  const [dni, setDni] = useState('');
  const [telefono, setTelefono] = useState('');
  const [activo, setActivo] = useState(true);
  const [notas, setNotas] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (personaEditar) {
      setNombre(personaEditar.nombre || '');
      setEmpleo(personaEditar.empleo || 'SOLDADO');
      setUnidad(personaEditar.unidad || 'GOE III');
      setDni(personaEditar.dni || '');
      setTelefono(personaEditar.telefono || '');
      setActivo(personaEditar.activo !== undefined ? personaEditar.activo : true);
      setNotas(personaEditar.notas || '');
    } else {
      setNombre('');
      setEmpleo('SOLDADO');
      setUnidad('GOE III');
      setDni('');
      setTelefono('');
      setActivo(true);
      setNotas('');
    }
    setErrors([]);
  }, [personaEditar, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validatePersonData({ nombre, empleo, unidad, dni, telefono });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setSaving(true);
    try {
      await onSave({
        nombre: nombre.trim(),
        empleo,
        unidad,
        dni: dni.trim().toUpperCase(),
        telefono: telefono.trim(),
        activo,
        notas: notas.trim(),
      });
      onClose();
    } catch (err: any) {
      setErrors([err.message || 'Error al guardar la persona']);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      id="modal-persona-form"
      isOpen={isOpen}
      onClose={onClose}
      title={personaEditar ? `Editar Ficha: ${personaEditar.nombre}` : 'Nueva Persona en el Grupo'}
      subtitle="El ID interno del sistema es único y permanente."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.length > 0 && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            <p className="font-semibold">Corrige los siguientes errores:</p>
            <ul className="mt-1 list-disc pl-4 space-y-0.5">
              {errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Nombre */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Nombre y Apellidos <span className="text-rose-500">*</span>
          </label>
          <input
            id="input-persona-nombre"
            type="text"
            required
            placeholder="Ej: Juan Pérez Gómez"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-slate-400 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-white"
          />
        </div>

        {/* Empleo */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Empleo <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              id="btn-empleo-cabo"
              onClick={() => setEmpleo('CABO')}
              className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold transition-all ${
                empleo === 'CABO'
                  ? 'border-amber-400 bg-amber-50 text-amber-900 shadow-xs dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-200'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              CABO
            </button>

            <button
              type="button"
              id="btn-empleo-soldado"
              onClick={() => setEmpleo('SOLDADO')}
              className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold transition-all ${
                empleo === 'SOLDADO'
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-900 shadow-xs dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-200'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              SOLDADO
            </button>
          </div>
        </div>

        {/* Unidad (Lista de opciones controlada) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Unidad de Pertenencia <span className="text-rose-500">*</span>
          </label>
          <select
            id="select-persona-unidad"
            value={unidad}
            onChange={(e) => setUnidad(e.target.value as Unidad)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:border-slate-400 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-white"
          >
            {UNIDADES_VALIDAS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Unidades autorizadas: GOE III, GOE IV, BOEL XIX, GCG, ULOE.
          </p>
        </div>

        {/* DNI & Teléfono */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              DNI / NIE <span className="text-slate-400 font-normal">(Opcional en dev)</span>
            </label>
            <input
              id="input-persona-dni"
              type="text"
              placeholder="Ej: 12345678Z"
              value={dni}
              onChange={(e) => setDni(e.target.value.toUpperCase())}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-medium text-slate-900 uppercase focus:border-slate-400 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Teléfono <span className="text-slate-400 font-normal">(Opcional en dev)</span>
            </label>
            <input
              id="input-persona-telefono"
              type="tel"
              placeholder="Ej: 600112233"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-medium text-slate-900 focus:border-slate-400 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>

        {/* Estado Activo en el grupo */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
          <div>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Estado en el grupo
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Las personas inactivas se conservan siempre en el histórico.
            </p>
          </div>
          <button
            type="button"
            id="btn-toggle-persona-activo"
            onClick={() => setActivo(!activo)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              activo ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                activo ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Notas */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Notas internas / Observaciones
          </label>
          <textarea
            id="textarea-persona-notas"
            rows={2}
            placeholder="Información adicional sobre el ciclo, observaciones..."
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs font-medium text-slate-900 focus:border-slate-400 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-white"
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            id="btn-cancel-persona-form"
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            id="btn-submit-persona-form"
            type="submit"
            disabled={saving}
            className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            {saving ? 'Guardando...' : personaEditar ? 'Guardar Cambios' : 'Crear Persona'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
