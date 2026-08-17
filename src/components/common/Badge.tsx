import React from 'react';
import { Empleo, RolUsuario, EstadoAcceso, Unidad } from '../../types';
import { formatEstadoAcceso } from '../../utils/formatters';

interface BadgeProps {
  tipo?: 'empleo' | 'rol' | 'estado' | 'acceso' | 'unidad' | 'custom';
  valor?: string | Empleo | RolUsuario | EstadoAcceso | Unidad;
  children?: React.ReactNode;
  variant?: 'default' | 'outline' | 'dot';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  tipo = 'custom',
  valor,
  children,
  size = 'md',
  className = '',
}) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs font-medium' : 'px-2.5 py-1 text-xs font-medium';

  if (tipo === 'unidad') {
    const val = String(valor || '');
    let colorClasses = 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700';
    let dotColor = 'bg-slate-500';

    if (val === 'GOE III') {
      colorClasses = 'bg-blue-50 text-blue-900 border-blue-300 dark:bg-blue-950/50 dark:text-blue-200 dark:border-blue-800';
      dotColor = 'bg-blue-600';
    } else if (val === 'GOE IV') {
      colorClasses = 'bg-indigo-50 text-indigo-900 border-indigo-300 dark:bg-indigo-950/50 dark:text-indigo-200 dark:border-indigo-800';
      dotColor = 'bg-indigo-600';
    } else if (val === 'BOEL XIX') {
      colorClasses = 'bg-purple-50 text-purple-900 border-purple-300 dark:bg-purple-950/50 dark:text-purple-200 dark:border-purple-800';
      dotColor = 'bg-purple-600';
    } else if (val === 'GCG') {
      colorClasses = 'bg-cyan-50 text-cyan-900 border-cyan-300 dark:bg-cyan-950/50 dark:text-cyan-200 dark:border-cyan-800';
      dotColor = 'bg-cyan-600';
    } else if (val === 'ULOE') {
      colorClasses = 'bg-teal-50 text-teal-900 border-teal-300 dark:bg-teal-950/50 dark:text-teal-200 dark:border-teal-800';
      dotColor = 'bg-teal-600';
    }

    return (
      <span
        id={`badge-unidad-${val.toLowerCase().replace(/\s+/g, '-')}`}
        className={`inline-flex items-center gap-1 rounded-full border font-semibold ${colorClasses} ${sizeClasses} ${className}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        {val || 'Sin Unidad'}
      </span>
    );
  }

  if (tipo === 'empleo') {
    const isCabo = valor === 'CABO';
    return (
      <span
        id={`badge-empleo-${String(valor).toLowerCase()}`}
        className={`inline-flex items-center gap-1 rounded-full ${sizeClasses} ${
          isCabo
            ? 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700'
            : 'bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700'
        } ${className}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isCabo ? 'bg-amber-600 dark:bg-amber-400' : 'bg-emerald-600 dark:bg-emerald-400'}`} />
        {valor === 'CABO' ? 'CABO' : 'SOLDADO'}
      </span>
    );
  }

  if (tipo === 'rol') {
    const isAdmin = valor === 'ADMIN';
    return (
      <span
        id={`badge-rol-${String(valor).toLowerCase()}`}
        className={`inline-flex items-center gap-1 rounded-full ${sizeClasses} ${
          isAdmin
            ? 'bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-700'
            : 'bg-slate-100 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
        } ${className}`}
      >
        {isAdmin ? 'ADMINISTRADOR' : 'USUARIO'}
      </span>
    );
  }

  if (tipo === 'estado') {
    const isActivo = valor === true || valor === 'ACTIVO' || valor === 'true';
    return (
      <span
        id={`badge-estado-${isActivo ? 'activo' : 'inactivo'}`}
        className={`inline-flex items-center gap-1 rounded-full ${sizeClasses} ${
          isActivo
            ? 'bg-teal-100 text-teal-900 border border-teal-300 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-700'
            : 'bg-stone-100 text-stone-600 border border-stone-300 dark:bg-stone-800 dark:text-stone-400 dark:border-stone-700'
        } ${className}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isActivo ? 'bg-teal-600 dark:bg-teal-400' : 'bg-stone-400'}`} />
        {isActivo ? 'ACTIVO' : 'INACTIVO'}
      </span>
    );
  }

  if (tipo === 'acceso' && valor) {
    const info = formatEstadoAcceso(valor as EstadoAcceso);
    return (
      <span
        id={`badge-acceso-${String(valor).toLowerCase()}`}
        className={`inline-flex items-center gap-1 rounded-full border ${info.bg} ${info.color} ${info.border} ${sizeClasses} ${className}`}
      >
        {info.text}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full bg-slate-100 text-slate-800 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 ${sizeClasses} ${className}`}
    >
      {children || valor}
    </span>
  );
};
