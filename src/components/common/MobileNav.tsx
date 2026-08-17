import React from 'react';
import { LayoutDashboard, CalendarDays, Users, MessageSquare, KeyRound, History, Settings } from 'lucide-react';
import { AdminTab } from './Sidebar';

interface MobileNavProps {
  activeTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ activeTab, onSelectTab }) => {
  const items = [
    { id: 'inicio', label: 'Inicio', icon: LayoutDashboard },
    { id: 'cuadrantes', label: 'Cuadrante', icon: CalendarDays },
    { id: 'personal', label: 'Personal', icon: Users },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'cuentas', label: 'Cuentas', icon: KeyRound },
    { id: 'historial', label: 'Auditoría', icon: History },
    { id: 'config', label: 'Ajustes', icon: Settings },
  ];

  return (
    <nav
      id="app-mobile-nav"
      className="fixed bottom-0 left-0 z-40 flex h-16 w-full items-center justify-around border-t border-slate-200 bg-white/95 px-2 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 md:hidden"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            id={`mobile-nav-btn-${item.id}`}
            onClick={() => onSelectTab(item.id as AdminTab)}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-all ${
              isActive
                ? 'text-slate-950 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full transition-all ${
                isActive
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-transparent text-slate-500'
              }`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
