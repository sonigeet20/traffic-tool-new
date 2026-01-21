import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Save, Check, AlertCircle, Loader } from 'lucide-react';

interface LunaProxyCredentials {
  id?: string;
  user_id?: string;
  proxy_username: string;
  proxy_password: string;
  proxy_host: string;
  proxy_port: string;
  enabled: boolean;
}

export default function LunaProxyConfig() {
  const [credentials, setCredentials] = useState<LunaProxyCredentials>({
    proxy_username: '',
    proxy_password: '',
    proxy_host: 'pr.lunaproxy.com',
    proxy_port: '12233',
    enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // For now, store in browser localStorage or fetch from a settings table
      // We'll use localStorage for quick implementation
      const stored = localStorage.getItem('lunaProxyConfig');
      if (stored) {
        setCredentials(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Error loading credentials:', err);
      setError('Failed to load credentials');
    } finally {
      setLoading(false);
    }
  };

  const saveCredentials = async () => {
    try {
      setSaving(true);
      setError('');

      // Validate
      if (!credentials.proxy_username || !credentials.proxy_password) {
        setError('Please enter both username and password');
        return;
      }

      // Save to localStorage
      localStorage.setItem('lunaProxyConfig', JSON.stringify(credentials));

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Error saving credentials:', err);
      setError('Failed to save credentials');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-slate-700 rounded w-1/4"></div>
          <div className="h-10 bg-slate-700 rounded"></div>
          <div className="h-10 bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg">
          <AlertCircle className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Luna Proxy Credentials</h3>
          <p className="text-sm text-slate-400">Configure proxy settings for traffic generation</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Username */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Luna Username
          </label>
          <input
            type="text"
            value={credentials.proxy_username}
            onChange={(e) =>
              setCredentials({ ...credentials, proxy_username: e.target.value })
            }
            placeholder="lum-customer-xxxxx"
            className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
          />
          <p className="text-xs text-slate-500 mt-1">
            Format: lum-customer-xxxxx (found in Luna dashboard)
          </p>
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Luna Password
          </label>
          <input
            type="password"
            value={credentials.proxy_password}
            onChange={(e) =>
              setCredentials({ ...credentials, proxy_password: e.target.value })
            }
            placeholder="••••••••••"
            className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
          />
          <p className="text-xs text-slate-500 mt-1">Your Luna proxy password</p>
        </div>

        {/* Host and Port */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Proxy Host
            </label>
            <input
              type="text"
              value={credentials.proxy_host}
              onChange={(e) =>
                setCredentials({ ...credentials, proxy_host: e.target.value })
              }
              placeholder="pr.lunaproxy.com"
              className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
            />
            <p className="text-xs text-slate-500 mt-1">Default: pr.lunaproxy.com</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Proxy Port
            </label>
            <input
              type="text"
              value={credentials.proxy_port}
              onChange={(e) =>
                setCredentials({ ...credentials, proxy_port: e.target.value })
              }
              placeholder="12233"
              className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
            />
            <p className="text-xs text-slate-500 mt-1">Default: 12233</p>
          </div>
        </div>

        {/* Enable Checkbox */}
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 mt-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={credentials.enabled}
              onChange={(e) =>
                setCredentials({ ...credentials, enabled: e.target.checked })
              }
              className="w-5 h-5 bg-slate-800 border-slate-600 rounded focus:ring-cyan-500"
            />
            <span className="text-sm font-medium text-orange-300">
              Enable Luna Proxy for campaigns
            </span>
          </label>
          <p className="mt-2 text-sm text-orange-300">
            When enabled, campaigns will use these Luna proxy credentials for traffic generation
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-3">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={saveCredentials}
          disabled={saving}
          className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 disabled:from-slate-600 disabled:to-slate-700 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2 mt-4"
        >
          {saved ? (
            <>
              <Check className="w-4 h-4" />
              Saved!
            </>
          ) : saving ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Luna Proxy Credentials
            </>
          )}
        </button>

        {/* Info Box */}
        <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4 mt-4">
          <p className="text-xs text-blue-300 font-medium mb-2">How it works:</p>
          <ol className="text-xs text-slate-400 space-y-1.5 list-decimal list-inside">
            <li>
              Get Luna proxy credentials from{' '}
              <a
                href="https://lunaproxy.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300"
              >
                Luna dashboard
              </a>
            </li>
            <li>Enter your Luna username (format: lum-customer-xxxxx) and password</li>
            <li>Enable the proxy by checking the checkbox above</li>
            <li>Save your credentials</li>
            <li>When creating campaigns, these credentials will be used automatically</li>
            <li>Each campaign can override these defaults if needed</li>
          </ol>
          <div className="mt-3 pt-3 border-t border-blue-700/30">
            <p className="text-xs text-slate-400">
              💡 Tip: Luna Proxy provides residential IPs with automatic rotation for traffic generation
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
