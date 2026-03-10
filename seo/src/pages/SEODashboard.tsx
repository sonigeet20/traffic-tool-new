import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase, SEOProject, SEOKeyword } from '@/lib/supabase';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import {
  FolderKanban, Target, TrendingUp, TrendingDown, Minus,
  ArrowUpRight, Zap, Plus, Search, Trophy, Eye, BarChart3,
  ArrowRight, Globe, Rocket
} from 'lucide-react';
import { format, subDays } from 'date-fns';

interface DashboardStats {
  totalProjects: number;
  totalKeywords: number;
  avgPosition: number;
  topTenPct: number;
  improved: number;
  declined: number;
  unchanged: number;
}

const POSITION_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#f97316', '#ef4444'];
const POSITION_LABELS = ['#1–3', '#4–10', '#11–20', '#21–50', '#51–100'];

export default function SEODashboard() {
  const [projects, setProjects] = useState<SEOProject[]>([]);
  const [keywords, setKeywords] = useState<SEOKeyword[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0, totalKeywords: 0, avgPosition: 0,
    topTenPct: 0, improved: 0, declined: 0, unchanged: 0
  });
  const [posDistribution, setPosDistribution] = useState<any[]>([]);
  const [recentChanges, setRecentChanges] = useState<SEOKeyword[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch projects
      const { data: prjs } = await supabase
        .from('seo_projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const projectList = prjs || [];
      setProjects(projectList);

      if (projectList.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch all keywords for user's projects
      const projectIds = projectList.map(p => p.id);
      const { data: kws } = await supabase
        .from('seo_keywords')
        .select('*')
        .in('project_id', projectIds);

      const kwList = kws || [];
      setKeywords(kwList);

      // Compute stats
      const ranked = kwList.filter(k => k.current_rank && k.current_rank > 0);
      const avgPos = ranked.length > 0
        ? ranked.reduce((sum, k) => sum + (k.current_rank || 0), 0) / ranked.length
        : 0;
      const topTen = ranked.filter(k => (k.current_rank || 999) <= 10).length;
      const topTenPct = ranked.length > 0 ? (topTen / ranked.length) * 100 : 0;

      let improved = 0, declined = 0, unchanged = 0;
      kwList.forEach(k => {
        if (k.previous_rank && k.current_rank) {
          if (k.current_rank < k.previous_rank) improved++;
          else if (k.current_rank > k.previous_rank) declined++;
          else unchanged++;
        } else {
          unchanged++;
        }
      });

      setStats({
        totalProjects: projectList.length,
        totalKeywords: kwList.length,
        avgPosition: Math.round(avgPos * 10) / 10,
        topTenPct: Math.round(topTenPct),
        improved, declined, unchanged
      });

      // Position distribution
      const dist = [
        { range: '#1–3', count: ranked.filter(k => (k.current_rank!) <= 3).length, color: POSITION_COLORS[0] },
        { range: '#4–10', count: ranked.filter(k => (k.current_rank!) >= 4 && (k.current_rank!) <= 10).length, color: POSITION_COLORS[1] },
        { range: '#11–20', count: ranked.filter(k => (k.current_rank!) >= 11 && (k.current_rank!) <= 20).length, color: POSITION_COLORS[2] },
        { range: '#21–50', count: ranked.filter(k => (k.current_rank!) >= 21 && (k.current_rank!) <= 50).length, color: POSITION_COLORS[3] },
        { range: '#51–100', count: ranked.filter(k => (k.current_rank!) >= 51).length, color: POSITION_COLORS[4] },
      ];
      setPosDistribution(dist);

      // Recent changes: keywords with rank movement
      const changes = kwList
        .filter(k => k.previous_rank && k.current_rank && k.previous_rank !== k.current_rank)
        .sort((a, b) => Math.abs((b.previous_rank! - b.current_rank!)) - Math.abs((a.previous_rank! - a.current_rank!)))
        .slice(0, 8);
      setRecentChanges(changes);

    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl text-xs">
        <p className="text-slate-400 mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-white font-medium">{p.name}: {p.value}</p>
        ))}
      </div>
    );
  };

  /* ─── Empty state ─── */
  if (!loading && projects.length === 0) {
    return (
      <Layout title="Dashboard">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-6 border border-blue-500/20">
              <Rocket className="w-10 h-10 text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Welcome to SEO+</h3>
            <p className="text-slate-400 mb-8 leading-relaxed">
              Track your search rankings, monitor competitors, and run click campaigns — all in one place.
              Start by creating your first project.
            </p>
            <Link to="/projects" className="btn btn-primary">
              <Plus className="w-4 h-4" />
              Create your first project
            </Link>
            <div className="mt-12 grid grid-cols-3 gap-4 text-center">
              <div className="p-4 card">
                <Search className="w-5 h-5 text-blue-400 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Track Rankings</p>
              </div>
              <div className="p-4 card">
                <Eye className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Monitor SERPs</p>
              </div>
              <div className="p-4 card">
                <Zap className="w-5 h-5 text-orange-400 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Click Campaigns</p>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  /* ─── Loading state ─── */
  if (loading) {
    return (
      <Layout title="Dashboard">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5">
              <div className="skeleton h-3 w-20 mb-3" />
              <div className="skeleton h-8 w-16 mb-2" />
              <div className="skeleton h-2 w-24" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <div className="lg:col-span-2 card p-5"><div className="skeleton h-48 w-full rounded-lg" /></div>
          <div className="card p-5"><div className="skeleton h-48 w-full rounded-lg" /></div>
        </div>
      </Layout>
    );
  }

  /* ─── Main dashboard ─── */
  return (
    <Layout title="Dashboard" subtitle={`${stats.totalProjects} project${stats.totalProjects !== 1 ? 's' : ''} · ${stats.totalKeywords} keyword${stats.totalKeywords !== 1 ? 's' : ''} tracked`}>

      {/* ─── Stat cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card stat-blue p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Projects</span>
            <FolderKanban className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-white">{stats.totalProjects}</p>
          <p className="text-xs text-slate-500 mt-1">{projects.filter(p => p.status === 'active').length} active</p>
        </div>

        <div className="card stat-cyan p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Keywords</span>
            <Target className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-3xl font-bold text-white">{stats.totalKeywords}</p>
          <p className="text-xs text-slate-500 mt-1">{keywords.filter(k => k.current_rank).length} with rank data</p>
        </div>

        <div className="card stat-green p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Avg Position</span>
            <BarChart3 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-3xl font-bold text-white">
            {stats.avgPosition > 0 ? stats.avgPosition : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-1">Across all keywords</p>
        </div>

        <div className="card stat-purple p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Top 10</span>
            <Trophy className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-3xl font-bold text-white">{stats.topTenPct}%</p>
          <p className="text-xs text-slate-500 mt-1">Keywords in top 10</p>
        </div>
      </div>

      {/* ─── Charts row ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {/* Position distribution */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold text-white">Position Distribution</h3>
              <p className="text-xs text-slate-500 mt-0.5">Keywords grouped by SERP position</p>
            </div>
          </div>
          {posDistribution.some(d => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={posDistribution} barSize={40}>
                <XAxis dataKey="range" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.05)' }} />
                <Bar dataKey="count" name="Keywords" radius={[6, 6, 0, 0]}>
                  {posDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-slate-500 text-sm">
              No rank data yet — add keywords and run a crawl
            </div>
          )}
        </div>

        {/* Rank changes summary */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-5">Rank Changes</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.improved}</p>
                <p className="text-xs text-slate-400">Improved</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
              <div className="w-10 h-10 rounded-lg bg-red-500/15 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.declined}</p>
                <p className="text-xs text-slate-400">Declined</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-500/5 border border-slate-500/10">
              <div className="w-10 h-10 rounded-lg bg-slate-500/15 flex items-center justify-center">
                <Minus className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.unchanged}</p>
                <p className="text-xs text-slate-400">Unchanged</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Projects + Recent changes ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active projects */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Active Projects</h3>
            <Link to="/projects" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {projects.slice(0, 5).map(project => (
              <Link
                key={project.id}
                to={`/projects/${project.id}/keywords`}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-700/30 transition-all group"
              >
                <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <Globe className="w-4 h-4 text-slate-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-200 truncate group-hover:text-white">{project.name}</p>
                  <p className="text-xs text-slate-500 truncate">{project.website_url}</p>
                </div>
                <span className={`badge ${project.status === 'active' ? 'badge-green' : 'badge-slate'}`}>
                  {project.status}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent rank changes */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Recent Rank Changes</h3>
          </div>
          {recentChanges.length > 0 ? (
            <div className="space-y-2">
              {recentChanges.map(kw => {
                const change = (kw.previous_rank || 0) - (kw.current_rank || 0);
                const isUp = change > 0;
                return (
                  <div key={kw.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-200 truncate">{kw.keyword}</p>
                      <p className="text-xs text-slate-500">
                        {kw.previous_rank} → {kw.current_rank}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1 text-sm font-semibold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      {isUp ? '+' : ''}{change}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-slate-500 text-sm">
              Rank changes will appear after crawls
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
