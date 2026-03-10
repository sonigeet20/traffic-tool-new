import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

import SEOAuth from './pages/Auth';
import SEODashboard from './pages/SEODashboard';
import ProjectsPage from './pages/Projects';
import KeywordsPage from './pages/Keywords';
import RankingsPage from './pages/Rankings';
import CampaignsPage from './pages/Campaigns';
import CompetitorsPage from './pages/Competitors';
import SettingsPage from './pages/Settings';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription?.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-2 border-slate-700" />
            <div className="absolute inset-0 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          </div>
          <p className="text-sm text-slate-400">Loading SEO+ Dashboard…</p>
        </div>
      </div>
    );
  }

  if (!user) return <SEOAuth />;

  return (
    <Router basename="/seo">
      <Routes>
        <Route path="/" element={<SEODashboard />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId/keywords" element={<KeywordsPage />} />
        <Route path="/projects/:projectId/rankings" element={<RankingsPage />} />
        <Route path="/campaigns" element={<CampaignsPage />} />
        <Route path="/competitors" element={<CompetitorsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
