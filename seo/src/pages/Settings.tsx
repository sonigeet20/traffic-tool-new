import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import {
  Settings, Key, RefreshCw, Bell, Shield, Check, X,
  Globe, Clock, AlertTriangle, Zap, Save, ExternalLink
} from 'lucide-react';

interface SettingsState {
  browser_api_key: string;
  browser_api_customer_id: string;
  default_crawl_frequency: string;
  default_search_engine: string;
  default_device_type: string;
  alert_rank_drop: number;
  alert_rank_improve: number;
  alert_email: boolean;
}

const DEFAULTS: SettingsState = {
  browser_api_key: '',
  browser_api_customer_id: '',
  default_crawl_frequency: 'daily',
  default_search_engine: 'google',
  default_device_type: 'desktop',
  alert_rank_drop: 5,
  alert_rank_improve: 3,
  alert_email: true,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState>(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('seo_settings');
    if (stored) {
      try { setSettings({ ...DEFAULTS, ...JSON.parse(stored) }); } catch {}
    }
  }, []);

  const save = () => {
    localStorage.setItem('seo_settings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const resp = await fetch('/api/seo/health');
      const data = await resp.json();
      setTestResult({
        ok: data.status === 'ok',
        msg: data.status === 'ok' ? 'Backend connected successfully' : `Backend returned: ${data.status}`
      });
    } catch (err: any) {
      setTestResult({ ok: false, msg: `Connection failed: ${err.message}` });
    } finally {
      setTesting(false);
    }
  };

  const update = (key: keyof SettingsState, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <Layout title="Settings" subtitle="Configure your SEO+ dashboard">
      <div className="max-w-2xl space-y-6">

        {/* ─── API Credentials ─── */}
        <section className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Key className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Bright Data Browser API</h3>
              <p className="text-xs text-slate-500">Credentials for the rank crawling engine</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="input-label">Customer ID</label>
              <input
                type="text"
                className="input font-mono text-xs"
                placeholder="brd-customer-xxxxxxx"
                value={settings.browser_api_customer_id}
                onChange={e => update('browser_api_customer_id', e.target.value)}
              />
            </div>
            <div>
              <label className="input-label">API Key / Zone Password</label>
              <input
                type="password"
                className="input font-mono text-xs"
                placeholder="••••••••••••••••"
                value={settings.browser_api_key}
                onChange={e => update('browser_api_key', e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={testConnection}
                disabled={testing}
                className="btn btn-secondary btn-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                {testing ? 'Testing…' : 'Test Connection'}
              </button>
              {testResult && (
                <span className={`text-xs flex items-center gap-1.5 ${testResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                  {testResult.ok ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  {testResult.msg}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* ─── Crawl Defaults ─── */}
        <section className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Globe className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Crawl Defaults</h3>
              <p className="text-xs text-slate-500">Default settings for new rank crawls</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="input-label">Frequency</label>
              <select
                className="select"
                value={settings.default_crawl_frequency}
                onChange={e => update('default_crawl_frequency', e.target.value)}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="input-label">Search Engine</label>
              <select
                className="select"
                value={settings.default_search_engine}
                onChange={e => update('default_search_engine', e.target.value)}
              >
                <option value="google">Google</option>
                <option value="bing">Bing</option>
                <option value="yahoo">Yahoo</option>
              </select>
            </div>
            <div>
              <label className="input-label">Device Type</label>
              <select
                className="select"
                value={settings.default_device_type}
                onChange={e => update('default_device_type', e.target.value)}
              >
                <option value="desktop">Desktop</option>
                <option value="mobile">Mobile</option>
              </select>
            </div>
          </div>
        </section>

        {/* ─── Alert Settings ─── */}
        <section className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Rank Alerts</h3>
              <p className="text-xs text-slate-500">Get notified about significant rank changes</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Alert on rank drop ≥</label>
                <div className="relative">
                  <input
                    type="number"
                    className="input"
                    value={settings.alert_rank_drop}
                    onChange={e => update('alert_rank_drop', parseInt(e.target.value) || 0)}
                    min="1"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">positions</span>
                </div>
              </div>
              <div>
                <label className="input-label">Alert on rank improve ≥</label>
                <div className="relative">
                  <input
                    type="number"
                    className="input"
                    value={settings.alert_rank_improve}
                    onChange={e => update('alert_rank_improve', parseInt(e.target.value) || 0)}
                    min="1"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">positions</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-300">Email notifications</span>
              </div>
              <button
                onClick={() => update('alert_email', !settings.alert_email)}
                className={`w-10 h-5 rounded-full transition-all relative ${settings.alert_email ? 'bg-blue-500' : 'bg-slate-600'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${settings.alert_email ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>
          </div>
        </section>

        {/* ─── Account ─── */}
        <section className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg bg-slate-500/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Account</h3>
              <p className="text-xs text-slate-500">Manage your session</p>
            </div>
          </div>
          <button onClick={handleLogout} className="btn btn-danger">
            Sign out
          </button>
        </section>

        {/* ─── Save bar ─── */}
        <div className="sticky bottom-6 flex justify-end">
          <button onClick={save} className={`btn ${saved ? 'btn-success' : 'btn-primary'} shadow-xl`}>
            {saved ? (
              <><Check className="w-4 h-4" /> Saved!</>
            ) : (
              <><Save className="w-4 h-4" /> Save Settings</>
            )}
          </button>
        </div>
      </div>
    </Layout>
  );
}
