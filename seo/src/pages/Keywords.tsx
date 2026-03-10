import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase, SEOKeyword } from '@/lib/supabase';
import {
  Plus, Search, Trash2, X, TrendingUp, TrendingDown, Minus,
  ArrowLeft, Upload, Filter, ChevronDown, ChevronUp, Target, Tag
} from 'lucide-react';

type SortKey = 'keyword' | 'current_rank' | 'search_volume' | 'difficulty_score' | 'tier';
type SortDir = 'asc' | 'desc';

const TIERS = [
  { value: 'primary', label: 'Primary', color: 'badge-blue' },
  { value: 'secondary', label: 'Secondary', color: 'badge-purple' },
  { value: 'long-tail', label: 'Long-tail', color: 'badge-cyan' },
];

export default function KeywordsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [keywords, setKeywords] = useState<SEOKeyword[]>([]);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('keyword');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filterTier, setFilterTier] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Add form
  const [newKeyword, setNewKeyword] = useState('');
  const [newTier, setNewTier] = useState('primary');
  const [newVolume, setNewVolume] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, [projectId]);

  const loadData = async () => {
    if (!projectId) return;

    // Get project name
    const { data: project } = await supabase
      .from('seo_projects')
      .select('name')
      .eq('id', projectId)
      .single();
    if (project) setProjectName(project.name);

    // Get keywords
    const { data } = await supabase
      .from('seo_keywords')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    setKeywords(data || []);
    setLoading(false);
  };

  const addKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !newKeyword.trim()) return;
    setSaving(true);

    const { error } = await supabase.from('seo_keywords').insert({
      project_id: projectId,
      keyword: newKeyword.trim().toLowerCase(),
      tier: newTier,
      search_volume: newVolume ? parseInt(newVolume) : null,
      target_rank: newTarget ? parseInt(newTarget) : null,
      status: 'active'
    });

    if (!error) {
      setNewKeyword('');
      setNewVolume('');
      setNewTarget('');
      setShowAddModal(false);
      loadData();
    }
    setSaving(false);
  };

  const bulkAddKeywords = async () => {
    if (!projectId || !bulkText.trim()) return;
    setSaving(true);

    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    const inserts = lines.map(keyword => ({
      project_id: projectId,
      keyword: keyword.toLowerCase(),
      tier: 'primary',
      status: 'active'
    }));

    const { error } = await supabase.from('seo_keywords').insert(inserts);
    if (!error) {
      setBulkText('');
      setShowBulkModal(false);
      loadData();
    }
    setSaving(false);
  };

  const deleteKeyword = async (id: string) => {
    setDeleting(id);
    await supabase.from('seo_keywords').delete().eq('id', id);
    setKeywords(prev => prev.filter(k => k.id !== id));
    setDeleting(null);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 text-slate-600" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-blue-400" />
      : <ChevronDown className="w-3 h-3 text-blue-400" />;
  };

  // Filtered + sorted keywords
  const filtered = useMemo(() => {
    let list = [...keywords];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(k => k.keyword.toLowerCase().includes(q));
    }
    if (filterTier !== 'all') {
      list = list.filter(k => k.tier === filterTier);
    }

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'keyword': cmp = a.keyword.localeCompare(b.keyword); break;
        case 'current_rank': cmp = (a.current_rank || 999) - (b.current_rank || 999); break;
        case 'search_volume': cmp = (a.search_volume || 0) - (b.search_volume || 0); break;
        case 'difficulty_score': cmp = (a.difficulty_score || 0) - (b.difficulty_score || 0); break;
        case 'tier': cmp = (a.tier || '').localeCompare(b.tier || ''); break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return list;
  }, [keywords, searchQuery, filterTier, sortKey, sortDir]);

  const getRankChange = (kw: SEOKeyword) => {
    if (!kw.current_rank || !kw.previous_rank) return null;
    return kw.previous_rank - kw.current_rank;
  };

  const getDifficultyColor = (score?: number) => {
    if (!score) return 'bg-slate-600';
    if (score <= 30) return 'bg-emerald-500';
    if (score <= 60) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const tierBadge = (tier: string) => {
    const t = TIERS.find(t => t.value === tier);
    return <span className={`badge ${t?.color || 'badge-slate'}`}>{t?.label || tier}</span>;
  };

  const formatNumber = (n?: number) => {
    if (!n) return '—';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  return (
    <Layout
      title={projectName || 'Keywords'}
      subtitle={`${keywords.length} keyword${keywords.length !== 1 ? 's' : ''} tracked`}
      actions={
        <div className="flex items-center gap-2">
          <button onClick={() => setShowBulkModal(true)} className="btn btn-secondary btn-sm">
            <Upload className="w-3.5 h-3.5" /> Bulk Add
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" /> Add Keyword
          </button>
        </div>
      }
    >
      {/* Back link */}
      <Link to="/projects" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 mb-5 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Projects
      </Link>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search keywords…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={filterTier}
            onChange={e => setFilterTier(e.target.value)}
            className="select w-auto"
          >
            <option value="all">All Tiers</option>
            {TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {/* ─── Data table ─── */}
      {loading ? (
        <div className="card overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b border-slate-800/60">
              <div className="skeleton h-4 w-40" />
              <div className="skeleton h-4 w-16 ml-auto" />
              <div className="skeleton h-4 w-12" />
              <div className="skeleton h-4 w-20" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Target className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-slate-300 mb-1">
            {keywords.length === 0 ? 'No keywords yet' : 'No matches found'}
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            {keywords.length === 0
              ? 'Add keywords to start tracking their search rankings.'
              : 'Try adjusting your search or filter criteria.'}
          </p>
          {keywords.length === 0 && (
            <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm mx-auto">
              <Plus className="w-3.5 h-3.5" /> Add Keyword
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="cursor-pointer select-none" onClick={() => handleSort('keyword')}>
                    <span className="flex items-center gap-1">Keyword <SortIcon col="keyword" /></span>
                  </th>
                  <th className="cursor-pointer select-none" onClick={() => handleSort('tier')}>
                    <span className="flex items-center gap-1">Tier <SortIcon col="tier" /></span>
                  </th>
                  <th className="cursor-pointer select-none text-right" onClick={() => handleSort('search_volume')}>
                    <span className="flex items-center gap-1 justify-end">Volume <SortIcon col="search_volume" /></span>
                  </th>
                  <th className="cursor-pointer select-none" onClick={() => handleSort('difficulty_score')}>
                    <span className="flex items-center gap-1">Difficulty <SortIcon col="difficulty_score" /></span>
                  </th>
                  <th className="cursor-pointer select-none text-right" onClick={() => handleSort('current_rank')}>
                    <span className="flex items-center gap-1 justify-end">Position <SortIcon col="current_rank" /></span>
                  </th>
                  <th className="text-right">Change</th>
                  <th className="text-right">Best</th>
                  <th className="text-right">Target</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(kw => {
                  const change = getRankChange(kw);
                  return (
                    <tr key={kw.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{kw.keyword}</span>
                        </div>
                      </td>
                      <td>{tierBadge(kw.tier)}</td>
                      <td className="text-right font-mono text-xs">{formatNumber(kw.search_volume)}</td>
                      <td>
                        {kw.difficulty_score != null ? (
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${getDifficultyColor(kw.difficulty_score)}`}
                                style={{ width: `${kw.difficulty_score}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-400 font-mono">{kw.difficulty_score}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>
                      <td className="text-right">
                        {kw.current_rank ? (
                          <span className={`text-lg font-bold ${
                            kw.current_rank <= 3 ? 'text-emerald-400' :
                            kw.current_rank <= 10 ? 'text-blue-400' :
                            kw.current_rank <= 20 ? 'text-orange-400' : 'text-slate-400'
                          }`}>
                            {kw.current_rank}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>
                      <td className="text-right">
                        {change !== null ? (
                          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                            change > 0 ? 'text-emerald-400' : change < 0 ? 'text-red-400' : 'text-slate-500'
                          }`}>
                            {change > 0 ? <TrendingUp className="w-3 h-3" /> : change < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                            {change > 0 ? `+${change}` : change === 0 ? '0' : change}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>
                      <td className="text-right text-xs font-mono text-slate-400">{kw.best_rank || '—'}</td>
                      <td className="text-right text-xs font-mono text-slate-400">{kw.target_rank || '—'}</td>
                      <td>
                        <button
                          onClick={() => { if (confirm(`Delete "${kw.keyword}"?`)) deleteKeyword(kw.id); }}
                          disabled={deleting === kw.id}
                          className="p-1.5 rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          <div className="px-4 py-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500">
            <span>Showing {filtered.length} of {keywords.length} keywords</span>
            <div className="flex items-center gap-4">
              {keywords.filter(k => k.current_rank && k.current_rank <= 10).length > 0 && (
                <span className="text-emerald-400">
                  {keywords.filter(k => k.current_rank && k.current_rank <= 10).length} in Top 10
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Add keyword modal ─── */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Add Keyword</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={addKeyword} className="space-y-4">
              <div>
                <label className="input-label">Keyword</label>
                <input
                  className="input"
                  placeholder="e.g., best seo tools 2025"
                  value={newKeyword}
                  onChange={e => setNewKeyword(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="input-label">Tier</label>
                  <select className="select" value={newTier} onChange={e => setNewTier(e.target.value)}>
                    {TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Volume</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="1000"
                    value={newVolume}
                    onChange={e => setNewVolume(e.target.value)}
                  />
                </div>
                <div>
                  <label className="input-label">Target Rank</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="10"
                    value={newTarget}
                    onChange={e => setNewTarget(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add Keyword
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Bulk add modal ─── */}
      {showBulkModal && (
        <div className="modal-overlay" onClick={() => setShowBulkModal(false)}>
          <div className="modal-content p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Bulk Add Keywords</h3>
              <button onClick={() => setShowBulkModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="input-label">Enter one keyword per line</label>
                <textarea
                  className="input min-h-[200px] font-mono text-xs"
                  placeholder={"best seo tools\nkeyword rank tracker\nserp monitoring software\nsearch engine optimization"}
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  {bulkText.split('\n').filter(l => l.trim()).length} keywords detected
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowBulkModal(false)} className="btn btn-secondary">Cancel</button>
                <button
                  onClick={bulkAddKeywords}
                  disabled={saving || !bulkText.trim()}
                  className="btn btn-primary"
                >
                  {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
                  Add {bulkText.split('\n').filter(l => l.trim()).length} Keywords
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
