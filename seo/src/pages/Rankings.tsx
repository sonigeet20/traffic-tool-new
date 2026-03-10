import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase, SEOKeyword, RankSnapshot } from '@/lib/supabase';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  ArrowLeft, TrendingUp, TrendingDown, Calendar, Minus,
  BarChart3, Eye, EyeOff, RefreshCw
} from 'lucide-react';
import { format, subDays, parseISO } from 'date-fns';

const CHART_COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#f97316', '#14b8a6', '#a855f7'
];

const DATE_RANGES = [
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

const POS_GROUPS = [
  { label: '#1–3', min: 1, max: 3, color: '#22c55e' },
  { label: '#4–10', min: 4, max: 10, color: '#3b82f6' },
  { label: '#11–20', min: 11, max: 20, color: '#f59e0b' },
  { label: '#21–50', min: 21, max: 50, color: '#f97316' },
  { label: '#51+', min: 51, max: 999, color: '#ef4444' },
];

interface ChartPoint {
  date: string;
  [keyword: string]: number | string;
}

export default function RankingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [keywords, setKeywords] = useState<SEOKeyword[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, RankSnapshot[]>>({});
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(30);
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
  const [crawling, setCrawling] = useState(false);

  useEffect(() => { loadData(); }, [projectId]);

  const loadData = async () => {
    if (!projectId) return;

    const { data: project } = await supabase
      .from('seo_projects')
      .select('name')
      .eq('id', projectId)
      .single();
    if (project) setProjectName(project.name);

    const { data: kws } = await supabase
      .from('seo_keywords')
      .select('*')
      .eq('project_id', projectId)
      .order('keyword');

    const kwList = kws || [];
    setKeywords(kwList);

    // Select first 5 keywords by default
    setSelectedKeywords(new Set(kwList.slice(0, 5).map(k => k.id)));

    // Fetch all snapshots for all keywords in one query
    if (kwList.length > 0) {
      const cutoff = format(subDays(new Date(), 90), 'yyyy-MM-dd');
      const { data: snaps } = await supabase
        .from('seo_rank_snapshots')
        .select('*')
        .in('keyword_id', kwList.map(k => k.id))
        .gte('snapshot_date', cutoff)
        .order('snapshot_date', { ascending: true });

      const grouped: Record<string, RankSnapshot[]> = {};
      (snaps || []).forEach(s => {
        if (!grouped[s.keyword_id]) grouped[s.keyword_id] = [];
        grouped[s.keyword_id].push(s);
      });
      setSnapshots(grouped);
    }

    setLoading(false);
  };

  const triggerCrawl = async () => {
    setCrawling(true);
    try {
      const resp = await fetch('/api/seo/crawl-rankings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      });
      if (resp.ok) {
        setTimeout(loadData, 3000);
      }
    } catch (err) {
      console.error('Crawl error:', err);
    } finally {
      setCrawling(false);
    }
  };

  // Build chart data
  const chartData = useMemo(() => {
    const cutoff = subDays(new Date(), dateRange);
    const dateMap = new Map<string, ChartPoint>();

    selectedKeywords.forEach(kwId => {
      const kw = keywords.find(k => k.id === kwId);
      if (!kw || !snapshots[kwId]) return;

      snapshots[kwId]
        .filter(s => parseISO(s.snapshot_date) >= cutoff)
        .forEach(s => {
          const dateStr = format(parseISO(s.snapshot_date), 'MMM d');
          if (!dateMap.has(dateStr)) dateMap.set(dateStr, { date: dateStr });
          dateMap.get(dateStr)![kw.keyword] = s.rank_position;
        });
    });

    return Array.from(dateMap.values());
  }, [snapshots, selectedKeywords, keywords, dateRange]);

  // Position distribution
  const posDistribution = useMemo(() => {
    return POS_GROUPS.map(g => ({
      ...g,
      count: keywords.filter(k => k.current_rank && k.current_rank >= g.min && k.current_rank <= g.max).length
    }));
  }, [keywords]);

  const toggleKeyword = (id: string) => {
    const next = new Set(selectedKeywords);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedKeywords(next);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl text-xs min-w-[140px]">
        <p className="text-slate-400 mb-2 font-medium">{label}</p>
        {payload.sort((a: any, b: any) => a.value - b.value).map((p: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-4 py-0.5">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
              <span className="text-slate-300 truncate max-w-[120px]">{p.name}</span>
            </span>
            <span className="font-mono font-bold text-white">#{p.value}</span>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <Layout title="Rankings">
        <div className="space-y-4">
          <div className="skeleton h-8 w-48" />
          <div className="card p-5"><div className="skeleton h-64 w-full rounded-lg" /></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title={`${projectName} — Rankings`}
      subtitle={`${keywords.length} keywords tracked`}
      actions={
        <button onClick={triggerCrawl} disabled={crawling} className="btn btn-primary btn-sm">
          <RefreshCw className={`w-3.5 h-3.5 ${crawling ? 'animate-spin' : ''}`} />
          {crawling ? 'Crawling…' : 'Crawl Now'}
        </button>
      }
    >
      <Link to="/projects" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 mb-5 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Projects
      </Link>

      {/* ─── Summary stat cards ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {posDistribution.map(g => (
          <div key={g.label} className="card p-4 text-center">
            <p className="text-2xl font-bold text-white">{g.count}</p>
            <p className="text-xs mt-0.5" style={{ color: g.color }}>Position {g.label}</p>
          </div>
        ))}
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-white">
            {keywords.length > 0
              ? (keywords.reduce((s, k) => s + (k.current_rank || 0), 0) / keywords.filter(k => k.current_rank).length || 0).toFixed(1)
              : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Avg Position</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* ─── Chart ─── */}
        <div className="xl:col-span-3 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Rank History</h3>
            <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5">
              {DATE_RANGES.map(r => (
                <button
                  key={r.days}
                  onClick={() => setDateRange(r.days)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    dateRange === r.days
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                />
                <YAxis
                  reversed
                  domain={[1, 'auto']}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  label={{ value: 'Position', angle: -90, position: 'insideLeft', fill: '#475569', fontSize: 11 }}
                />
                <Tooltip content={<CustomTooltip />} />
                {Array.from(selectedKeywords).map((kwId, i) => {
                  const kw = keywords.find(k => k.id === kwId);
                  if (!kw) return null;
                  return (
                    <Line
                      key={kwId}
                      type="monotone"
                      dataKey={kw.keyword}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3, fill: CHART_COLORS[i % CHART_COLORS.length] }}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: '#0f172a' }}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[360px] flex items-center justify-center text-slate-500 text-sm">
              <div className="text-center">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                <p>No rank history data yet</p>
                <p className="text-xs text-slate-600 mt-1">Run a crawl to collect ranking data</p>
              </div>
            </div>
          )}
        </div>

        {/* ─── Keyword selector ─── */}
        <div className="card p-4 max-h-[500px] overflow-y-auto">
          <h3 className="text-sm font-semibold text-white mb-3">Keywords</h3>
          <div className="space-y-1">
            {keywords.map((kw, i) => {
              const isSelected = selectedKeywords.has(kw.id);
              const change = kw.previous_rank && kw.current_rank
                ? kw.previous_rank - kw.current_rank : null;

              return (
                <button
                  key={kw.id}
                  onClick={() => toggleKeyword(kw.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all text-xs ${
                    isSelected
                      ? 'bg-slate-700/50 ring-1 ring-slate-600'
                      : 'hover:bg-slate-800/50'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 border-2"
                    style={{
                      borderColor: isSelected ? CHART_COLORS[Array.from(selectedKeywords).indexOf(kw.id) % CHART_COLORS.length] : '#475569',
                      backgroundColor: isSelected ? CHART_COLORS[Array.from(selectedKeywords).indexOf(kw.id) % CHART_COLORS.length] : 'transparent'
                    }}
                  />
                  <span className={`truncate flex-1 ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                    {kw.keyword}
                  </span>
                  <span className="flex items-center gap-1 flex-shrink-0">
                    {kw.current_rank ? (
                      <span className="font-mono font-bold text-slate-300">#{kw.current_rank}</span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                    {change !== null && change !== 0 && (
                      <span className={change > 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
}
