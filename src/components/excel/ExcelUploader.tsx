import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Download, AlertCircle } from 'lucide-react';
import { descargarPlantillaExcelEjemplo } from '../../services/excelService';

interface ExcelUploaderProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export const ExcelUploader: React.FC<ExcelUploaderProps> = ({
  onFileSelected,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (
        file.name.endsWith('.xlsx') ||
        file.name.endsWith('.xls') ||
        file.type.includes('sheet')
      ) {
        onFileSelected(file);
      } else {
        alert('Por favor selecciona un archivo con formato .xlsx');
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelected(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        id="excel-dropzone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
          isDragging
            ? 'border-blue-500 bg-blue-50/50 dark:border-blue-400 dark:bg-blue-950/20'
            : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx, .xls"
          className="hidden"
          onChange={handleInputChange}
          disabled={disabled}
        />

        <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 shadow-xs">
          <FileSpreadsheet className="h-10 w-10" />
        </div>

        <h3 className="mt-4 text-sm font-bold text-slate-900 dark:text-white">
          Arrastra tu archivo .xlsx o haz clic para seleccionarlo
        </h3>
        <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
          El archivo debe contener las columnas <strong>Nombre</strong>, <strong>Empleo</strong> (CABO o SOLDADO), <strong>DNI</strong> y <strong>Teléfono</strong>, con un total de entre 21 y 23 personas.
        </p>

        <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
          <Upload className="h-4 w-4" />
          <span>Examinar archivo local</span>
        </div>
      </div>

      {/* Helper Bar: Download Sample Template */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-900/60 text-xs">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <AlertCircle className="h-4 w-4 text-slate-400 shrink-0" />
          <span>¿No tienes la plantilla? Descarga un modelo oficial de prueba preconfigurado.</span>
        </div>
        <button
          id="btn-descargar-plantilla-excel"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            descargarPlantillaExcelEjemplo(11, 11);
          }}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-bold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Descargar Plantilla .xlsx (22 personas)</span>
        </button>
      </div>
    </div>
  );
};
