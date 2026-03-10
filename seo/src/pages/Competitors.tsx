import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase, SEOCompetitor, SEOProject } from '@/lib/supabase';
import {
  Plus, Users, Globe, Trash2, X, Eye, EyeOff,
  ExternalLink, BarChart3, Target, Search
} from 'lucide-react';

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<SEOCompetitor[]>([]);
  const [projects, setProjects] = useState<SEOProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    project_id: '', competitor_domain: '', competitor_name: ''
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: comps }, { data: prjs }] = await Promise.all([
      supabase
        .from('seo_competitor_tracking')
        .select('*, seo_projects(name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('seo_projects')
        .select('*')
        .eq('user_id', user.id)
        .order('name')
    ]);

    setCompetitors(comps || []);
    setProjects(prjs || []);
    setLoading(false);
  };

  const addCompetitor = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    let domain = form.competitor_domain.trim()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/+$/, '');

    const { error } = await supabase.from('seo_competitor_tracking').insert({
      project_id: form.project_id,
      competitor_domain: domain,
      competitor_name: form.competitor_name.trim() || domain,
      is_tracking: true
    });

    if (!error) {
      setShowModal(false);
      setForm({ project_id: '', competitor_domain: '', competitor_name: '' });
      loadData();
    }
    setSaving(false);
  };

  const toggleTracking = async (comp: SEOCompetitor) => {
    await supabase.from('seo_competitor_tracking')
      .update({ is_tracking: !comp.is_tracking })
      .eq('id', comp.id);
    setCompetitors(prev => prev.map(c => c.id === comp.id ? { ...c, is_tracking: !c.is_tracking } : c));
  };

  const deleteCompetitor = async (id: string) => {
    await supabase.from('seo_competitor_tracking').delete().eq('id', id);
    setCompetitors(prev => prev.filter(c => c.id !== id));
  };

  const getFaviconUrl = (domain: string) =>
    `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

  // Group competitors by project
  const grouped = competitors.reduce((acc, comp) => {
    const projName = comp.seo_projects?.name || 'Unknown Project';
    if (!acc[projName]) acc[projName] = [];
    acc[projName].push(comp);
    return acc;
  }, {} as Record<string, SEOCompetitor[]>);

  if (loading) {
    return (
      <Layout title="Competitors">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-5">
              <div className="skeleton h-5 w-32 mb-3" />
              <div className="skeleton h-3 w-48 mb-4" />
              <div className="skeleton h-8 w-full" />
            </div>
          ))}
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title="Competitors"
      subtitle={`${competitors.length} competitor${competitors.length !== 1 ? 's' : ''} tracked`}
      actions={
        <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm" disabled={projects.length === 0}>
          <Plus className="w-3.5 h-3.5" /> Add Competitor
        </button>
      }
    >
      {/* ─── Empty state ─── */}
      {competitors.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7 text-purple-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Track your competition</h3>
          <p className="text-sm text-slate-400 mb-6 max-w-sm mx-auto">
            Add competitor domains to monitor how they rank for your tracked keywords.
          </p>
          {projects.length > 0 ? (
            <button onClick={() => setShowModal(true)} className="btn btn-primary">
              <Plus className="w-4 h-4" /> Add Competitor
            </button>
          ) : (
            <p className="text-xs text-slate-500">Create a project first to track competitors.</p>
          )}
        </div>
      ) : (
        /* ─── Grouped competitor cards ─── */
        <div className="space-y-8">
          {Object.entries(grouped).map(([projectName, comps]) => (
            <div key={projectName}>
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-300">{projectName}</h3>
                <span className="badge badge-slate">{comps.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {comps.map((comp, i) => (
                  <div key={comp.id} className="card p-5 fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                    {/* Domain header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={getFaviconUrl(comp.competitor_domain)}
                          alt=""
                          className="w-8 h-8 rounded-lg bg-slate-700"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-white truncate">
                            {comp.competitor_name || comp.competitor_domain}
                          </h4>
                          <a
                            href={`https://${comp.competitor_domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-slate-500 hover:text-blue-400 flex items-center gap-1 transition-colors"
                          >
                            {comp.competitor_domain}
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      </div>
                      <span className={`badge ${comp.is_tracking ? 'badge-green' : 'badge-slate'}`}>
                        {comp.is_tracking ? 'Tracking' : 'Paused'}
                      </span>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="p-3 rounded-lg bg-slate-800/50 text-center">
                        <p className="text-lg font-bold text-white">
                          {comp.overlap_score != null ? `${comp.overlap_score}%` : '—'}
                        </p>
                        <p className="text-[10px] text-slate-500 uppercase">Overlap</p>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-800/50 text-center">
                        <p className="text-lg font-bold text-white">—</p>
                        <p className="text-[10px] text-slate-500 uppercase">Shared KWs</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleTracking(comp)}
                        className={`btn btn-sm flex-1 justify-center ${comp.is_tracking ? 'btn-secondary' : 'btn-success'}`}
                      >
                        {comp.is_tracking ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {comp.is_tracking ? 'Pause' : 'Resume'}
                      </button>
                      <button
                        onClick={() => { if (confirm(`Remove ${comp.competitor_domain}?`)) deleteCompetitor(comp.id); }}
                        className="btn btn-danger btn-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Add competitor modal ─── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Add Competitor</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={addCompetitor} className="space-y-4">
              <div>
                <label className="input-label">Project</label>
                <select
                  className="select"
                  value={form.project_id}
                  onChange={e => setForm({ ...form, project_id: e.target.value })}
                  required
                >
                  <option value="">Select project…</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Competitor Domain</label>
                <input
                  className="input"
                  placeholder="competitor.com"
                  value={form.competitor_domain}
                  onChange={e => setForm({ ...form, competitor_domain: e.target.value })}
                  required
                />
                <p className="text-xs text-slate-500 mt-1">Enter without http:// — we'll clean it up automatically</p>
              </div>
              <div>
                <label className="input-label">Display Name (optional)</label>
                <input
                  className="input"
                  placeholder="Competitor Inc."
                  value={form.competitor_name}
                  onChange={e => setForm({ ...form, competitor_name: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add Competitor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
