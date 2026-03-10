import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase, SEOCampaign, SEOProject, SEOKeyword } from '@/lib/supabase';
import {
  Plus, Zap, Play, Pause, CheckCircle, Trash2, X, Target,
  MousePointerClick, Globe, Smartphone, Monitor, TrendingUp, Tablet,
  Clock, BarChart3, AlertCircle, Settings as SettingsIcon, Eye, Search,
  Navigation, ScrollText, Activity
} from 'lucide-react';
import { format } from 'date-fns';

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  draft:     { color: 'badge-slate',  icon: <AlertCircle className="w-3 h-3" />, label: 'Draft' },
  running:   { color: 'badge-green',  icon: <Play className="w-3 h-3" />, label: 'Running' },
  paused:    { color: 'badge-orange', icon: <Pause className="w-3 h-3" />, label: 'Paused' },
  completed: { color: 'badge-blue',   icon: <CheckCircle className="w-3 h-3" />, label: 'Completed' },
};

const GEO_OPTIONS = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
];

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<SEOCampaign[]>([]);
  const [projects, setProjects] = useState<SEOProject[]>([]);
  const [keywords, setKeywords] = useState<SEOKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    // Basic
    project_id: '',
    keyword_id: '',
    name: '',
    search_keyword: '',
    
    // Goals
    total_clicks_goal: '100',
    daily_click_budget: '10',
    
    // Device Mix
    device_desktop: '60',
    device_mobile: '30',
    device_tablet: '10',
    
    // Behavior
    impression_ratio: '30',
    max_serp_pages: '3',
    click_delay_min: '15',
    click_delay_max: '45',
    
    // Session Quality
    session_duration_min: '45',
    session_duration_max: '180',
    bounce_rate_target: '25',
    pages_per_session_min: '1',
    pages_per_session_max: '5',
    scroll_depth_target: '75',
    engagement_level: 'medium',
    
    // Geography
    geo_targets: ['US'] as string[],
    
    // Advanced
    behavior_pattern: 'natural',
    time_distribution: { business_hours: 70, evening: 20, night: 10 },
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: camps }, { data: prjs }] = await Promise.all([
      supabase
        .from('seo_campaigns')
        .select('*, seo_projects(name, website_url), seo_keywords(keyword)')
        .order('created_at', { ascending: false }),
      supabase
        .from('seo_projects')
        .select('*')
        .eq('user_id', user.id)
        .order('name')
    ]);

    setCampaigns(camps || []);
    setProjects(prjs || []);
    setLoading(false);
  };

  const loadKeywordsForProject = async (projectId: string) => {
    const { data } = await supabase
      .from('seo_keywords')
      .select('*')
      .eq('project_id', projectId)
      .order('keyword');
    setKeywords(data || []);
  };

  const createCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const deviceMix = {
      desktop: parseInt(form.device_desktop),
      mobile: parseInt(form.device_mobile),
      tablet: parseInt(form.device_tablet),
    };

    const { error } = await supabase.from('seo_campaigns').insert({
      user_id: user.id,
      project_id: form.project_id,
      keyword_id: form.keyword_id || null,
      name: form.name.trim(),
      search_keyword: form.search_keyword.trim(),
      total_clicks_goal: parseInt(form.total_clicks_goal),
      total_clicks_delivered: 0,
      daily_click_budget: parseInt(form.daily_click_budget),
      status: 'draft',
      
      // Device mix
      device_mix: deviceMix,
      
      // Behavior
      impression_ratio: parseInt(form.impression_ratio),
      max_serp_pages: parseInt(form.max_serp_pages),
      click_delay_min: parseInt(form.click_delay_min),
      click_delay_max: parseInt(form.click_delay_max),
      
      // Session quality
      session_duration_min: parseInt(form.session_duration_min),
      session_duration_max: parseInt(form.session_duration_max),
      bounce_rate_target: parseInt(form.bounce_rate_target),
      pages_per_session_min: parseInt(form.pages_per_session_min),
      pages_per_session_max: parseInt(form.pages_per_session_max),
      scroll_depth_target: parseInt(form.scroll_depth_target),
      engagement_level: form.engagement_level,
      
      // Geography
      geo_targets: form.geo_targets,
      
      // Advanced
      behavior_pattern: form.behavior_pattern,
      time_distribution: form.time_distribution,
    });

    if (!error) {
      setShowModal(false);
      resetForm();
      loadData();
    }
    setSaving(false);
  };

  const resetForm = () => {
    setForm({
      project_id: '', keyword_id: '', name: '', search_keyword: '',
      total_clicks_goal: '100', daily_click_budget: '10',
      device_desktop: '60', device_mobile: '30', device_tablet: '10',
      impression_ratio: '30', max_serp_pages: '3',
      click_delay_min: '15', click_delay_max: '45',
      session_duration_min: '45', session_duration_max: '180',
      bounce_rate_target: '25', pages_per_session_min: '1', pages_per_session_max: '5',
      scroll_depth_target: '75', engagement_level: 'medium',
      geo_targets: ['US'],
      behavior_pattern: 'natural',
      time_distribution: { business_hours: 70, evening: 20, night: 10 },
    });
    setShowAdvanced(false);
  };

  const toggleStatus = async (campaign: SEOCampaign) => {
    const newStatus = campaign.status === 'running' ? 'paused' : 'running';
    await supabase.from('seo_campaigns').update({ status: newStatus }).eq('id', campaign.id);
    setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, status: newStatus } : c));
  };

  const deleteCampaign = async (id: string) => {
    await supabase.from('seo_campaigns').delete().eq('id', id);
    setCampaigns(prev => prev.filter(c => c.id !== id));
  };

  const toggleGeoTarget = (code: string) => {
    setForm(prev => ({
      ...prev,
      geo_targets: prev.geo_targets.includes(code)
        ? prev.geo_targets.filter(g => g !== code)
        : [...prev.geo_targets, code]
    }));
  };

  const stats = {
    total: campaigns.length,
    running: campaigns.filter(c => c.status === 'running').length,
    completed: campaigns.filter(c => c.status === 'completed').length,
    totalClicks: campaigns.reduce((sum, c) => sum + (c.total_clicks_delivered || 0), 0),
  };

  const getProgress = (c: SEOCampaign) =>
    c.total_clicks_goal > 0 ? Math.min(100, Math.round((c.total_clicks_delivered / c.total_clicks_goal) * 100)) : 0;

  if (loading) {
    return (
      <Layout title="Campaigns">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => <div key={i} className="card p-4"><div className="skeleton h-12 w-full" /></div>)}
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title="Campaigns"
      subtitle="Professional SEO ranking boost campaigns"
      actions={
        <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm" disabled={projects.length === 0}>
          <Plus className="w-3.5 h-3.5" /> New Campaign
        </button>
      }
    >
      {/* ─── Stats ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="card stat-blue p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Total</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="card stat-green p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Running</p>
          <p className="text-2xl font-bold text-emerald-400">{stats.running}</p>
        </div>
        <div className="card stat-purple p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Completed</p>
          <p className="text-2xl font-bold text-purple-400">{stats.completed}</p>
        </div>
        <div className="card stat-cyan p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Total Clicks</p>
          <p className="text-2xl font-bold text-cyan-400">{stats.totalClicks.toLocaleString()}</p>
        </div>
      </div>

      {/* ─── Campaign list ─── */}
      {campaigns.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-7 h-7 text-orange-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No campaigns yet</h3>
          <p className="text-sm text-slate-400 mb-6 max-w-sm mx-auto">
            Create sophisticated click campaigns with device mix, impression generation, and multi-page SERP navigation.
          </p>
          {projects.length > 0 ? (
            <button onClick={() => setShowModal(true)} className="btn btn-primary">
              <Plus className="w-4 h-4" /> Create Campaign
            </button>
          ) : (
            <p className="text-xs text-slate-500">Create a project first to start a campaign.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign, i) => {
            const progress = getProgress(campaign);
            const statusCfg = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.draft;
            const deviceMix = campaign.device_mix || { desktop: 60, mobile: 35, tablet: 5 };
            const impressionRatio = campaign.impression_ratio || 0;
            const maxPages = campaign.max_serp_pages || 1;

            return (
              <div key={campaign.id} className="card p-5 fade-in" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                  {/* Campaign info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="text-sm font-semibold text-white truncate">{campaign.name}</h3>
                      <span className={`badge ${statusCfg.color} flex items-center gap-1`}>
                        {statusCfg.icon} {statusCfg.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {campaign.seo_projects?.name || '—'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        {campaign.search_keyword}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {campaign.daily_click_budget}/day
                      </span>
                    </div>
                    
                    {/* Advanced features indicator */}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {impressionRatio > 0 && (
                        <span className="badge badge-slate flex items-center gap-1" title="Impression-only searches (no click)">
                          <Eye className="w-2.5 h-2.5" /> {impressionRatio}% impressions
                        </span>
                      )}
                      {maxPages > 1 && (
                        <span className="badge badge-slate flex items-center gap-1" title="Max SERP pages to search">
                          <ScrollText className="w-2.5 h-2.5" /> Up to page {maxPages}
                        </span>
                      )}
                      {campaign.engagement_level && (
                        <span className="badge badge-slate capitalize" title="Engagement level">
                          <Activity className="w-2.5 h-2.5" /> {campaign.engagement_level} engagement
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="w-full lg:w-48 flex-shrink-0">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-400">{campaign.total_clicks_delivered} / {campaign.total_clicks_goal}</span>
                      <span className="text-slate-500">{progress}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Device mix */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="flex items-center gap-1 text-xs text-slate-500" title="Desktop">
                      <Monitor className="w-3 h-3" /> {deviceMix.desktop || 0}%
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500" title="Mobile">
                      <Smartphone className="w-3 h-3" /> {deviceMix.mobile || 0}%
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500" title="Tablet">
                      <Tablet className="w-3 h-3" /> {deviceMix.tablet || 0}%
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => toggleStatus(campaign)}
                      disabled={campaign.status === 'completed'}
                      className={`btn btn-sm ${campaign.status === 'running' ? 'btn-secondary' : 'btn-success'}`}
                    >
                      {campaign.status === 'running' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete "${campaign.name}"?`)) deleteCampaign(campaign.id); }}
                      className="btn btn-danger btn-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Create campaign modal ─── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="modal-content p-6 max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-slate-800 -mx-6 -mt-6 px-6 py-4 border-b border-slate-700 z-10">
              <div>
                <h3 className="text-lg font-semibold text-white">New Professional Campaign</h3>
                <p className="text-xs text-slate-400 mt-0.5">Configure advanced ranking boost with device mix, impressions, and multi-page SERP</p>
              </div>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={createCampaign} className="space-y-6">
              {/* ─── Basic Info ─── */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Target className="w-4 h-4 text-blue-400" /> Basic Information
                </h4>
                
                <div>
                  <label className="input-label">Campaign Name</label>
                  <input
                    className="input"
                    placeholder="Q1 2026 Rank Boost Campaign"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Project</label>
                    <select
                      className="select"
                      value={form.project_id}
                      onChange={e => { setForm({ ...form, project_id: e.target.value, keyword_id: '' }); loadKeywordsForProject(e.target.value); }}
                      required
                    >
                      <option value="">Select project…</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Target Keyword (optional)</label>
                    <select
                      className="select"
                      value={form.keyword_id}
                      onChange={e => {
                        const kw = keywords.find(k => k.id === e.target.value);
                        setForm({ ...form, keyword_id: e.target.value, search_keyword: kw?.keyword || form.search_keyword });
                      }}
                    >
                      <option value="">Select keyword…</option>
                      {keywords.map(k => <option key={k.id} value={k.id}>{k.keyword}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="input-label">Search Query</label>
                  <input
                    className="input"
                    placeholder="The exact Google search query to execute"
                    value={form.search_keyword}
                    onChange={e => setForm({ ...form, search_keyword: e.target.value })}
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">This is what will be searched on Google to find and click your site</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Total Click Goal</label>
                    <input
                      type="number"
                      className="input"
                      value={form.total_clicks_goal}
                      onChange={e => setForm({ ...form, total_clicks_goal: e.target.value })}
                      min="1"
                      required
                    />
                  </div>
                  <div>
                    <label className="input-label">Daily Budget</label>
                    <input
                      type="number"
                      className="input"
                      value={form.daily_click_budget}
                      onChange={e => setForm({ ...form, daily_click_budget: e.target.value })}
                      min="1"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* ─── Device Mix ─── */}
              <div className="space-y-4 pt-6 border-t border-slate-700">
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-blue-400" /> Device Distribution
                </h4>
                <p className="text-xs text-slate-400">Mix of devices to simulate realistic traffic patterns (must total 100%)</p>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="input-label flex items-center gap-2">
                      <Monitor className="w-3 h-3" /> Desktop %
                    </label>
                    <input
                      type="number"
                      className="input"
                      value={form.device_desktop}
                      onChange={e => setForm({ ...form, device_desktop: e.target.value })}
                      min="0"
                      max="100"
                    />
                  </div>
                  <div>
                    <label className="input-label flex items-center gap-2">
                      <Smartphone className="w-3 h-3" /> Mobile %
                    </label>
                    <input
                      type="number"
                      className="input"
                      value={form.device_mobile}
                      onChange={e => setForm({ ...form, device_mobile: e.target.value })}
                      min="0"
                      max="100"
                    />
                  </div>
                  <div>
                    <label className="input-label flex items-center gap-2">
                      <Tablet className="w-3 h-3" /> Tablet %
                    </label>
                    <input
                      type="number"
                      className="input"
                      value={form.device_tablet}
                      onChange={e => setForm({ ...form, device_tablet: e.target.value })}
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Current total: {parseInt(form.device_desktop) + parseInt(form.device_mobile) + parseInt(form.device_tablet)}%
                </p>
              </div>

              {/* ─── Geographic Targeting ─── */}
              <div className="space-y-4 pt-6 border-t border-slate-700">
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-blue-400" /> Geographic Targeting
                </h4>
                <p className="text-xs text-slate-400">Select one or more countries to distribute traffic from</p>
                
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {GEO_OPTIONS.map(geo => (
                    <button
                      key={geo.code}
                      type="button"
                      onClick={() => toggleGeoTarget(geo.code)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        form.geo_targets.includes(geo.code)
                          ? 'bg-blue-500/20 border-2 border-blue-500 text-blue-300'
                          : 'bg-slate-700/50 border border-slate-600 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      <span className="text-base">{geo.flag}</span>
                      <span className="block mt-1">{geo.code}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ─── Advanced Settings Toggle ─── */}
              <div className="pt-6 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <SettingsIcon className="w-4 h-4" />
                  {showAdvanced ? 'Hide' : 'Show'} Advanced Settings (SERP Pages, Impressions, Timing)
                </button>
              </div>

              {showAdvanced && (
                <>
                  {/* ─── Search Behavior ─── */}
                  <div className="space-y-4 pt-6 border-t border-slate-700">
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Search className="w-4 h-4 text-blue-400" /> Search & Click Behavior
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="input-label flex items-center gap-2">
                          <Eye className="w-3 h-3" /> Impression-Only Ratio %
                        </label>
                        <input
                          type="number"
                          className="input"
                          value={form.impression_ratio}
                          onChange={e => setForm({ ...form, impression_ratio: e.target.value })}
                          min="0"
                          max="100"
                        />
                        <p className="text-xs text-slate-500 mt-1">% of searches that DON'T click (just impression)</p>
                      </div>
                      <div>
                        <label className="input-label flex items-center gap-2">
                          <ScrollText className="w-3 h-3" /> Max SERP Pages
                        </label>
                        <input
                          type="number"
                          className="input"
                          value={form.max_serp_pages}
                          onChange={e => setForm({ ...form, max_serp_pages: e.target.value })}
                          min="1"
                          max="10"
                        />
                        <p className="text-xs text-slate-500 mt-1">Search pages 2, 3, etc. if not found on page 1</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="input-label">Min Click Delay (seconds)</label>
                        <input
                          type="number"
                          className="input"
                          value={form.click_delay_min}
                          onChange={e => setForm({ ...form, click_delay_min: e.target.value })}
                          min="5"
                        />
                      </div>
                      <div>
                        <label className="input-label">Max Click Delay (seconds)</label>
                        <input
                          type="number"
                          className="input"
                          value={form.click_delay_max}
                          onChange={e => setForm({ ...form, click_delay_max: e.target.value })}
                          min={form.click_delay_min}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">Random delay between seeing search results and clicking (anti-detection)</p>
                  </div>

                  {/* ─── Session Quality ─── */}
                  <div className="space-y-4 pt-6 border-t border-slate-700">
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-400" /> Session Quality & Engagement
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="input-label">Min Session Duration (sec)</label>
                        <input
                          type="number"
                          className="input"
                          value={form.session_duration_min}
                          onChange={e => setForm({ ...form, session_duration_min: e.target.value })}
                          min="10"
                        />
                      </div>
                      <div>
                        <label className="input-label">Max Session Duration (sec)</label>
                        <input
                          type="number"
                          className="input"
                          value={form.session_duration_max}
                          onChange={e => setForm({ ...form, session_duration_max: e.target.value })}
                          min={form.session_duration_min}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="input-label">Bounce Rate Target %</label>
                        <input
                          type="number"
                          className="input"
                          value={form.bounce_rate_target}
                          onChange={e => setForm({ ...form, bounce_rate_target: e.target.value })}
                          min="0"
                          max="100"
                        />
                      </div>
                      <div>
                        <label className="input-label">Min Pages/Session</label>
                        <input
                          type="number"
                          className="input"
                          value={form.pages_per_session_min}
                          onChange={e => setForm({ ...form, pages_per_session_min: e.target.value })}
                          min="1"
                        />
                      </div>
                      <div>
                        <label className="input-label">Max Pages/Session</label>
                        <input
                          type="number"
                          className="input"
                          value={form.pages_per_session_max}
                          onChange={e => setForm({ ...form, pages_per_session_max: e.target.value })}
                          min={form.pages_per_session_min}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="input-label">Scroll Depth Target %</label>
                        <input
                          type="number"
                          className="input"
                          value={form.scroll_depth_target}
                          onChange={e => setForm({ ...form, scroll_depth_target: e.target.value })}
                          min="0"
                          max="100"
                        />
                        <p className="text-xs text-slate-500 mt-1">How far down the page to scroll</p>
                      </div>
                      <div>
                        <label className="input-label">Engagement Level</label>
                        <select
                          className="select"
                          value={form.engagement_level}
                          onChange={e => setForm({ ...form, engagement_level: e.target.value })}
                        >
                          <option value="low">Low (minimal interaction)</option>
                          <option value="medium">Medium (normal browsing)</option>
                          <option value="high">High (active engagement)</option>
                        </select>
                        <p className="text-xs text-slate-500 mt-1">Mouse movements, clicks, keyboard events</p>
                      </div>
                    </div>
                  </div>

                  {/* ─── Behavior Pattern ─── */}
                  <div className="space-y-4 pt-6 border-t border-slate-700">
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-400" /> Behavior Pattern
                    </h4>
                    
                    <div>
                      <label className="input-label">Traffic Pattern</label>
                      <select
                        className="select"
                        value={form.behavior_pattern}
                        onChange={e => setForm({ ...form, behavior_pattern: e.target.value })}
                      >
                        <option value="natural">Natural (recommended)</option>
                        <option value="aggressive">Aggressive (faster clicks)</option>
                        <option value="conservative">Conservative (slower, safer)</option>
                      </select>
                      <p className="text-xs text-slate-500 mt-1">Affects timing randomization and detection avoidance</p>
                    </div>
                  </div>
                </>
              )}

              {/* ─── Submit ─── */}
              <div className="flex justify-end gap-3 pt-6 border-t border-slate-700 sticky bottom-0 bg-slate-800 -mx-6 -mb-6 px-6 py-4">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
