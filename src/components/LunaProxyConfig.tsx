import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Save, Check, AlertCircle, Loader, Plus, RefreshCw } from 'lucide-react';

interface ProxyProvider {
  id?: string;
  user_id?: string;
  name: string;
  provider_type: string;
  username?: string;
  password?: string;
  host?: string;
  port?: string;
  enabled?: boolean;
}

const emptyForm: ProxyProvider = {
  name: 'luna-default',
  provider_type: 'luna',
  username: '',
  password: '',
  host: 'pr.lunaproxy.com',
  port: '12233',
  enabled: true,
};

export default function LunaProxyConfig() {
  const [providers, setProviders] = useState<ProxyProvider[]>([]);
  const [defaultProvider, setDefaultProvider] = useState<string>('');
  const [form, setForm] = useState<ProxyProvider>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDefault, setSavingDefault] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('No active session');
        return;
      }
      setUserId(user.id);

      const [{ data: settings }, { data: providerRows }] = await Promise.all([
        supabase.from('settings').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('proxy_providers').select('*').eq('user_id', user.id).order('created_at', { ascending: true })
      ]);

      setDefaultProvider(settings?.default_proxy_provider || '');
      setProviders(providerRows || []);

      // Pre-fill form from legacy settings if no providers exist
      if ((providerRows || []).length === 0 && settings?.luna_proxy_username) {
        setForm({
          ...emptyForm,
          name: 'luna-default',
          username: settings.luna_proxy_username,
          password: settings.luna_proxy_password || '',
          host: settings.luna_proxy_host || 'pr.lunaproxy.com',
          port: settings.luna_proxy_port || '12233',
          enabled: settings.luna_proxy_enabled ?? true,
        });
      }
    } catch (err) {
      console.error('Error loading proxy providers:', err);
      setError('Failed to load proxy providers');
    } finally {
      setLoading(false);
    }
  };

  const saveProvider = async () => {
    try {
      setSaving(true);
      setError('');
      if (!userId) {
        setError('No active session');
        return;
      }
      if (!form.name.trim()) {
        setError('Provider name is required');
        return;
      }

      await supabase
        .from('proxy_providers')
        .upsert({
          ...form,
          name: form.name.trim(),
          user_id: userId,
        }, { onConflict: 'user_id,name' });

      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      setForm(emptyForm);
      await loadData();
    } catch (err) {
      console.error('Error saving provider:', err);
      setError('Failed to save provider');
    } finally {
      setSaving(false);
    }
  };

  const setDefault = async (name: string) => {
    try {
      setSavingDefault(true);
      setError('');
      if (!userId) {
        setError('No active session');
        return;
      }
      await supabase
        .from('settings')
        .upsert({ user_id: userId, default_proxy_provider: name }, { onConflict: 'user_id' });
      setDefaultProvider(name);
    } catch (err) {
      console.error('Error setting default provider:', err);
      setError('Failed to set default provider');
    } finally {
      setSavingDefault(false);
    }
  };

  const toggleEnabled = async (provider: ProxyProvider, enabled: boolean) => {
    try {
      if (!provider.id) return;
      await supabase.from('proxy_providers').update({ enabled }).eq('id', provider.id);
      await loadData();
    } catch (err) {
      console.error('Error toggling provider:', err);
      setError('Failed to update provider');
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg">
            <RefreshCw className="w-5 h-5 text-white animate-spin" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Loading proxy providers...</h3>
            <p className="text-sm text-slate-400">Fetching defaults and overrides</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg">
          <AlertCircle className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Proxy Providers</h3>
          <p className="text-sm text-slate-400">Defaults live in the settings table; campaigns override only when enabled</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-3">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="bg-slate-900 rounded-lg border border-slate-700 p-4 space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Plus className="w-4 h-4" /> Add / Update Provider
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="luna-default"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Provider Type</label>
                <select
                  value={form.provider_type}
                  onChange={(e) => setForm({ ...form, provider_type: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="luna">Luna</option>
                  <option value="brightdata">Bright Data</option>
                  <option value="smartproxy">SmartProxy</option>
                  <option value="oxylabs">Oxylabs</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
                <input
                  value={form.username || ''}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="lum-customer-..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  value={form.password || ''}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Host</label>
                <input
                  value={form.host || ''}
                  onChange={(e) => setForm({ ...form, host: e.target.value })}
                  placeholder="pr.lunaproxy.com"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Port</label>
                <input
                  value={form.port || ''}
                  onChange={(e) => setForm({ ...form, port: e.target.value })}
                  placeholder="12233"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={!!form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                className="w-5 h-5 bg-slate-800 border-slate-600 rounded focus:ring-cyan-500"
              />
              Enabled
            </label>

            <button
              onClick={saveProvider}
              disabled={saving}
              className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 disabled:from-slate-600 disabled:to-slate-700 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2"
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved
                </>
              ) : saving ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Provider
                </>
              )}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white font-semibold">Saved Providers</div>
              <p className="text-sm text-slate-400">Defaults come from this list; campaigns only override when enabled</p>
            </div>
            <button
              onClick={loadData}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 hover:border-cyan-500 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>

          {providers.length === 0 && (
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-slate-400 text-sm">
              No providers yet. Add one above to make it the default.
            </div>
          )}

          <div className="space-y-3">
            {providers.map((p) => (
              <div key={p.id} className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-white font-semibold">{p.name}</div>
                    <div className="text-xs text-slate-400">{p.provider_type} · {p.host || 'host?'}:{p.port || 'port?'}</div>
                    <div className="text-xs text-slate-500">{p.username ? 'Username set' : 'Username missing'}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                      <input
                        type="radio"
                        name="default-provider"
                        checked={defaultProvider === p.name}
                        onChange={() => setDefault(p.name)}
                        disabled={savingDefault}
                        className="w-5 h-5 bg-slate-800 border-slate-600 rounded-full focus:ring-cyan-500"
                      />
                      Default
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={!!p.enabled}
                        onChange={(e) => toggleEnabled(p, e.target.checked)}
                        className="w-5 h-5 bg-slate-800 border-slate-600 rounded focus:ring-cyan-500"
                      />
                      Enabled
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4">
        <p className="text-xs text-blue-300 font-medium mb-2">How it works</p>
        <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
          <li>Save providers in the settings table; choose one as the default.</li>
          <li>Campaigns use the default provider unless a campaign override is enabled.</li>
          <li>You can add other providers (Bright Data, SmartProxy, Oxylabs, Custom) and select them per campaign.</li>
          <li>Campaign overrides send their own credentials; otherwise the scheduler pulls from this list.</li>
        </ul>
      </div>
    </div>
  );
}
