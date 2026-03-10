import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
  LayoutDashboard, FolderKanban, Zap, Users, Settings, LogOut,
  ChevronLeft, ChevronRight, TrendingUp, Menu, Bell, Search
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { path: '/projects', icon: FolderKanban, label: 'Projects', end: false },
  { path: '/campaigns', icon: Zap, label: 'Campaigns', end: false },
  { path: '/competitors', icon: Users, label: 'Competitors', end: false },
  { path: '/settings', icon: Settings, label: 'Settings', end: false },
];

export default function Layout({ children, title, subtitle, actions }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-900">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ─── Sidebar ─── */}
      <aside
        className={`
          fixed lg:relative z-50 h-full flex flex-col
          bg-slate-950 border-r border-slate-800/80
          transition-all duration-300 ease-in-out
          ${collapsed ? 'w-[68px]' : 'w-60'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-slate-800/80">
          <NavLink to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/30 transition-shadow">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <h1 className="text-lg font-bold gradient-text leading-tight">SEO+</h1>
                <p className="text-[10px] text-slate-500 leading-tight">Rank Tracker</p>
              </div>
            )}
          </NavLink>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2.5 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium
                transition-all duration-200 group
                ${isActive
                  ? 'bg-blue-500/10 text-blue-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }
              `}
            >
              {({ isActive }) => (
                <>
                  <div className="relative flex-shrink-0">
                    <item.icon className={`w-[18px] h-[18px] ${isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                    {isActive && (
                      <div className="absolute -left-[17px] top-1/2 -translate-y-1/2 w-[3px] h-4 bg-blue-500 rounded-r-full" />
                    )}
                  </div>
                  {!collapsed && <span>{item.label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="p-2.5 border-t border-slate-800/80 space-y-0.5">
          <a
            href="/"
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13px] font-medium text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
          >
            <LayoutDashboard className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && <span>Traffic Tool</span>}
          </a>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13px] font-medium text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center gap-3 w-full px-3 py-2 rounded-lg text-[13px] text-slate-600 hover:text-slate-400 hover:bg-slate-800/50 transition-all"
          >
            {collapsed
              ? <ChevronRight className="w-[18px] h-[18px]" />
              : <ChevronLeft className="w-[18px] h-[18px]" />
            }
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ─── Main content ─── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-slate-800/60 bg-slate-900/80 backdrop-blur-md flex-shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              {title && <h2 className="text-[15px] font-semibold text-white">{title}</h2>}
              {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {actions}
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-[1440px] mx-auto fade-in">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
