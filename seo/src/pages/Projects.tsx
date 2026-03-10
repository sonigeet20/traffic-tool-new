import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase, SEOProject } from '@/lib/supabase';
import {
  Plus, Globe, BarChart3, Target, Trash2, X,
  ExternalLink, MoreVertical, Calendar, MapPin, RefreshCw, Edit
} from 'lucide-react';
import { format } from 'date-fns';

const COUNTRIES = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
];

interface KwCount { [projectId: string]: number; }

export default function ProjectsPage() {
  const [projects, setProjects] = useState<SEOProject[]>([]);
  const [kwCounts, setKwCounts] = useState<KwCount>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<SEOProject | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: '', website_url: '', target_country: 'US', crawl_frequency: 'daily'
  });

  useEffect(() => { loadProjects(); }, []);

  const loadProjects = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('seo_projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const prjs = data || [];
    setProjects(prjs);

    // Fetch keyword counts for each project
    if (prjs.length > 0) {
      const counts: KwCount = {};
      const { data: kws } = await supabase
        .from('seo_keywords')
        .select('project_id')
        .in('project_id', prjs.map(p => p.id));

      (kws || []).forEach(k => {
        counts[k.project_id] = (counts[k.project_id] || 0) + 1;
      });
      setKwCounts(counts);
    }
    setLoading(false);
  };

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let url = form.website_url.trim();
    if (url && !url.startsWith('http')) url = 'https://' + url;

    const { error } = await supabase.from('seo_projects').insert({
      user_id: user.id,
      name: form.name.trim(),
      website_url: url,
      target_country: form.target_country,
      crawl_frequency: form.crawl_frequency,
      status: 'active'
    });

    if (!error) {
      setShowModal(false);
      setForm({ name: '', website_url: '', target_country: 'US', crawl_frequency: 'daily' });
      loadProjects();
    }
    setSaving(false);
  };

  const deleteProject = async (id: string) => {
    setDeleting(id);
    await supabase.from('seo_projects').delete().eq('id', id);
    setProjects(prev => prev.filter(p => p.id !== id));
    setDeleting(null);
  };

  const openEditModal = (project: SEOProject) => {
    setEditingProject(project);
    setForm({
      name: project.name,
      website_url: project.website_url,
      target_country: project.target_country,
      crawl_frequency: project.crawl_frequency || 'daily'
    });
    setShowModal(true);
  };

  const updateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;
    
    setSaving(true);
    let url = form.website_url.trim();
    if (url && !url.startsWith('http')) url = 'https://' + url;

    const { error } = await supabase
      .from('seo_projects')
      .update({
        name: form.name.trim(),
        website_url: url,
        target_country: form.target_country,
        crawl_frequency: form.crawl_frequency
      })
      .eq('id', editingProject.id);

    if (!error) {
      setShowModal(false);
      setEditingProject(null);
      setForm({ name: '', website_url: '', target_country: 'US', crawl_frequency: 'daily' });
      loadProjects();
    }
    setSaving(false);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProject(null);
    setForm({ name: '', website_url: '', target_country: 'US', crawl_frequency: 'daily' });
  };

  const getDomain = (url: string) => {
    try { return new URL(url).hostname.replace('www.', ''); }
    catch { return url; }
  };

  const countryInfo = (code: string) => COUNTRIES.find(c => c.code === code) || { flag: '🌐', name: code };

  /* ─── Empty state ─── */
  if (!loading && projects.length === 0) {
    return (
      <Layout title="Projects" subtitle="Manage your tracked websites">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-5">
              <FolderIcon className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No projects yet</h3>
            <p className="text-sm text-slate-400 mb-6">Create a project to start tracking keyword rankings for your website.</p>
            <button onClick={() => setShowModal(true)} className="btn btn-primary">
              <Plus className="w-4 h-4" /> New Project
            </button>
          </div>
        </div>
        {showModal && <ProjectModal />}
      </Layout>
    );
  }

  function FolderIcon(props: any) {
    return <Globe {...props} />;
  }

  function ProjectModal() {
    return (
      <div className="modal-overlay" onClick={closeModal}>
        <div className="modal-content p-6" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">
              {editingProject ? 'Edit Project' : 'New Project'}
            </h3>
            <button onClick={closeModal} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={editingProject ? updateProject : createProject} className="space-y-4">
            <div>
              <label className="input-label">Project Name</label>
              <input
                className="input"
                placeholder="My Website SEO"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="input-label">Website URL</label>
              <input
                className="input"
                placeholder="https://example.com"
                value={form.website_url}
                onChange={e => setForm({ ...form, website_url: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Target Country</label>
                <select
                  className="select"
                  value={form.target_country}
                  onChange={e => setForm({ ...form, target_country: e.target.value })}
                >
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="input-label">Crawl Frequency</label>
                <select
                  className="select"
                  value={form.crawl_frequency}
                  onChange={e => setForm({ ...form, crawl_frequency: e.target.value })}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeModal} className="btn btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
                {editingProject ? 'Save Changes' : 'Create Project'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <Layout
      title="Projects"
      subtitle={`${projects.length} project${projects.length !== 1 ? 's' : ''}`}
      actions={
        <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm">
          <Plus className="w-3.5 h-3.5" /> New Project
        </button>
      }
    >
      {/* Loading */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-5">
              <div className="skeleton h-5 w-32 mb-3" />
              <div className="skeleton h-3 w-48 mb-4" />
              <div className="skeleton h-8 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : (
        /* ─── Project cards ─── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((project, i) => {
            const ci = countryInfo(project.target_country);
            const kwCount = kwCounts[project.id] || 0;
            return (
              <div key={project.id} className="card p-5 fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center flex-shrink-0 border border-slate-600/40">
                      <Globe className="w-5 h-5 text-slate-300" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-white truncate">{project.name}</h3>
                      <p className="text-xs text-slate-500 truncate">{getDomain(project.website_url)}</p>
                    </div>
                  </div>
                  <span className={`badge ${project.status === 'active' ? 'badge-green' : 'badge-slate'} flex-shrink-0`}>
                    {project.status}
                  </span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-2 rounded-lg bg-slate-800/50">
                    <p className="text-lg font-bold text-white">{kwCount}</p>
                    <p className="text-[10px] text-slate-500 uppercase">Keywords</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-slate-800/50">
                    <p className="text-lg font-bold text-white">{ci.flag}</p>
                    <p className="text-[10px] text-slate-500 uppercase">{project.target_country}</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-slate-800/50">
                    <p className="text-lg font-bold text-white capitalize">{project.crawl_frequency?.charAt(0)}</p>
                    <p className="text-[10px] text-slate-500 uppercase">Crawl</p>
                  </div>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-3 text-xs text-slate-500 mb-4">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(project.created_at), 'MMM d, yyyy')}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Link
                    to={`/projects/${project.id}/keywords`}
                    className="btn btn-secondary btn-sm flex-1 justify-center"
                  >
                    <Target className="w-3.5 h-3.5" /> Keywords
                  </Link>
                  <Link
                    to={`/projects/${project.id}/rankings`}
                    className="btn btn-secondary btn-sm flex-1 justify-center"
                  >
                    <BarChart3 className="w-3.5 h-3.5" /> Rankings
                  </Link>
                  <button
                    onClick={() => openEditModal(project)}
                    className="btn btn-secondary btn-sm"
                    title="Edit project"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => { if (confirm('Delete this project? All keywords and data will be lost.')) deleteProject(project.id); }}
                    disabled={deleting === project.id}
                    className="btn btn-danger btn-sm"
                  >
                    {deleting === project.id
                      ? <div className="w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />
                    }
                  </button>
                </div>
              </div>
            );
          })}

          {/* Add new project card */}
          <button
            onClick={() => setShowModal(true)}
            className="card p-5 flex flex-col items-center justify-center min-h-[240px] border-dashed hover:border-blue-500/40 group"
          >
            <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mb-3 group-hover:bg-blue-500/10 transition-colors">
              <Plus className="w-6 h-6 text-slate-500 group-hover:text-blue-400 transition-colors" />
            </div>
            <p className="text-sm text-slate-500 group-hover:text-slate-300 transition-colors">Add Project</p>
          </button>
        </div>
      )}

      {showModal && <ProjectModal />}
    </Layout>
  );
}
