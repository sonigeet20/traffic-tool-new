import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Terminal, X, Maximize2, Minimize2 } from 'lucide-react';

interface SessionLog {
  id: string;
  session_id: string;
  log_timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata: any;
}

interface RealtimeLogsProps {
  campaignId: string;
}

export default function RealtimeLogs({ campaignId }: RealtimeLogsProps) {
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    // Load initial logs
    loadLogs();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('session_logs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'session_logs',
        },
        (payload) => {
          const newLog = payload.new as SessionLog;
          // Check if this log belongs to a session in our campaign
          checkAndAddLog(newLog);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId]);

  useEffect(() => {
    if (autoScroll && logs.length > 0) {
      const container = document.getElementById('logs-container');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [logs, autoScroll]);

  async function loadLogs() {
    // Get all session IDs for this campaign
    const { data: sessions } = await supabase
      .from('bot_sessions')
      .select('id')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });

    if (!sessions || sessions.length === 0) {
      setLogs([]);
      return;
    }

    const sessionIds = sessions.map(s => s.id);

    // Load logs for these sessions (most recent first, then reverse for display)
    const { data: logsData } = await supabase
      .from('session_logs')
      .select('*')
      .in('session_id', sessionIds)
      .order('log_timestamp', { ascending: false })
      .limit(500);

    if (logsData) {
      // Reverse to show oldest first, newest last (for auto-scroll)
      setLogs(logsData.reverse());
    } else {
      setLogs([]);
    }
  }

  async function checkAndAddLog(log: SessionLog) {
    // Check if this session belongs to our campaign
    const { data: session } = await supabase
      .from('bot_sessions')
      .select('campaign_id')
      .eq('id', log.session_id)
      .single();

    if (session && session.campaign_id === campaignId) {
      setLogs(prev => [...prev, log]);
    }
  }

  function clearLogs() {
    setLogs([]);
  }

  function getLevelColor(level: string) {
    switch (level) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      case 'info': return 'text-cyan-400';
      case 'debug': return 'text-slate-400';
      default: return 'text-slate-300';
    }
  }

  function getLevelBg(level: string) {
    switch (level) {
      case 'error': return 'bg-red-500/10 border-red-500/20';
      case 'warn': return 'bg-yellow-500/10 border-yellow-500/20';
      case 'info': return 'bg-cyan-500/10 border-cyan-500/20';
      case 'debug': return 'bg-slate-500/10 border-slate-500/20';
      default: return 'bg-slate-500/10 border-slate-500/20';
    }
  }

  return (
    <div
      className={`fixed bottom-4 right-4 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl transition-all duration-300 ${
        isExpanded ? 'w-[800px] h-[600px]' : 'w-[400px] h-[300px]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-cyan-400" />
          <h3 className="text-white font-semibold">Real-time Logs</h3>
          <span className="text-xs text-slate-400">({logs.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded"
            />
            Auto-scroll
          </label>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-slate-800 rounded transition-colors"
          >
            {isExpanded ? (
              <Minimize2 className="w-4 h-4 text-slate-400" />
            ) : (
              <Maximize2 className="w-4 h-4 text-slate-400" />
            )}
          </button>
          <button
            onClick={clearLogs}
            className="p-1 hover:bg-slate-800 rounded transition-colors text-xs text-slate-400"
          >
            Clear
          </button>
          <button
            onClick={() => setLogs([])}
            className="p-1 hover:bg-slate-800 rounded transition-colors"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Logs Container */}
      <div
        id="logs-container"
        className="overflow-y-auto p-4 space-y-2 font-mono text-xs"
        style={{ height: 'calc(100% - 60px)' }}
      >
        {logs.length === 0 ? (
          <div className="text-center text-slate-500 py-8">
            No logs yet. Logs will appear here in real-time as sessions run.
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={`p-2 rounded border ${getLevelBg(log.level)}`}
            >
              <div className="flex items-start gap-2">
                <span className="text-slate-500 text-[10px] whitespace-nowrap">
                  {new Date(log.log_timestamp).toLocaleTimeString()}
                </span>
                <span className={`uppercase text-[10px] font-bold ${getLevelColor(log.level)}`}>
                  [{log.level}]
                </span>
                <span className="text-slate-200 flex-1 break-all">
                  {log.message}
                </span>
              </div>
              {log.metadata && Object.keys(log.metadata).length > 0 && (
                <div className="mt-1 pl-24 text-slate-400 text-[10px]">
                  {JSON.stringify(log.metadata, null, 2)}
                </div>
              )}
              <div className="mt-1 text-slate-600 text-[10px]">
                Session: {log.session_id.slice(0, 8)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
