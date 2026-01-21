import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import JourneyBuilder from './JourneyBuilder';
import PluginConfig from './PluginConfig';
import IntelligentTrafficConfig from './IntelligentTrafficConfig';
import { Save, X, Loader2 } from 'lucide-react';

type Campaign = Database['public']['Tables']['campaigns']['Row'];
type UserJourney = Database['public']['Tables']['user_journeys']['Row'];
type BrowserPlugin = Database['public']['Tables']['browser_plugins']['Row'];

interface ProxyProvider {
  name: string;
  provider_type: string;
}

interface CampaignFormProps {
  campaign: Campaign | null;
  onSave: () => void;
  onCancel: () => void;
}

export default function CampaignForm({ campaign, onSave, onCancel }: CampaignFormProps) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [totalSessions, setTotalSessions] = useState(10);
  const [concurrentBots, setConcurrentBots] = useState(2);
  const [sessionDurationMin, setSessionDurationMin] = useState(30);
  const [sessionDurationMax, setSessionDurationMax] = useState(240);
  const [targetGeoLocations, setTargetGeoLocations] = useState<string[]>(['US']);
  const [useResidentialProxies, setUseResidentialProxies] = useState(true);
  const [proxyProvider, setProxyProvider] = useState('luna-default');
  const [proxyUsername, setProxyUsername] = useState('');
  const [proxyPassword, setProxyPassword] = useState('');
  const [proxyHost, setProxyHost] = useState('pr.lunaproxy.com');
  const [proxyPort, setProxyPort] = useState('12233');
  const [providers, setProviders] = useState<ProxyProvider[]>([]);
  const [defaultProviderName, setDefaultProviderName] = useState('');
  const [lastCampaignId, setLastCampaignId] = useState<string | null>(null);
  const [totalUsers, setTotalUsers] = useState(100);
  const [distributionPeriodHours, setDistributionPeriodHours] = useState(24);
  const [distributionPattern, setDistributionPattern] = useState<'uniform' | 'spike' | 'gradual_increase' | 'random'>('uniform');
  const [trafficSourceDistribution, setTrafficSourceDistribution] = useState({ direct: 50, search: 50 });
  const [searchKeywords, setSearchKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [journeys, setJourneys] = useState<Partial<UserJourney>[]>([]);
  const [plugins, setPlugins] = useState<Partial<BrowserPlugin>[]>([]);
  const [extensionId, setExtensionId] = useState<string>('');
  const [bounceRate, setBounceRate] = useState(30);
  const [minPagesPerSession, setMinPagesPerSession] = useState(1);
  const [maxPagesPerSession, setMaxPagesPerSession] = useState(3);
  const [debugMode, setDebugMode] = useState(false);
  const [customReferrer, setCustomReferrer] = useState('');
  const [maxBandwidthMB, setMaxBandwidthMB] = useState<number>(1);
  const [useSerpApi, setUseSerpApi] = useState(false);
  const [serpApiProvider, setSerpApiProvider] = useState('bright_data');
  const [useBrowserAutomation, setUseBrowserAutomation] = useState(false);
  const [useLunaProxySearch, setUseLunaProxySearch] = useState(false);
  const [campaignType, setCampaignType] = useState<'direct' | 'search'>('direct');
  const [useLunaHeadfulDirect, setUseLunaHeadfulDirect] = useState(false);
  const [searchMode, setSearchMode] = useState<'browser_api' | 'luna_headful_direct'>('browser_api');
  const [currentTab, setCurrentTab] = useState<'basic' | 'geo' | 'journey' | 'plugins'>('basic');
  const [siteStructure, setSiteStructure] = useState<any>(null);
  const [overrideProxySettings, setOverrideProxySettings] = useState(false);
  const [headlessMode, setHeadlessMode] = useState<'true' | 'false' | 'new'>('true');

  useEffect(() => {
    loadProvidersFromSettings();
  }, []);

  async function loadProvidersFromSettings() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: settings }, { data: providerRows }] = await Promise.all([
      supabase.from('settings').select('default_proxy_provider').eq('user_id', user.id).maybeSingle(),
      supabase.from('proxy_providers').select('name, provider_type').eq('user_id', user.id).eq('enabled', true)
    ]);

    const providerList = providerRows || [];
    setProviders(providerList);
    const fallback = settings?.default_proxy_provider || providerList[0]?.name || 'luna-default';
    setDefaultProviderName(fallback);

    if (!campaign) {
      setProxyProvider(fallback);
    }
  }

  useEffect(() => {
    if (campaign) {
      console.log('[LOAD DEBUG] Loading campaign:', {
        id: campaign.id,
        name: campaign.name,
        traffic_source_distribution: campaign.traffic_source_distribution
      });
      setName(campaign.name);
      setTargetUrl(campaign.target_url);
      setTotalSessions(campaign.total_sessions);
      setConcurrentBots(campaign.concurrent_bots);
      setSessionDurationMin(campaign.session_duration_min ?? 30);
      setSessionDurationMax(campaign.session_duration_max ?? 240);
      setTargetGeoLocations(campaign.target_geo_locations || ['US']);
      setUseResidentialProxies(campaign.use_residential_proxies);
      setProxyProvider(campaign.proxy_provider || defaultProviderName || 'luna-default');
      setProxyUsername(campaign.proxy_username || '');
      setProxyPassword(campaign.proxy_password || '');
      setProxyHost(campaign.proxy_host || 'pr.lunaproxy.com');
      setProxyPort(campaign.proxy_port || '12233');
      setTotalUsers(campaign.total_users);
      setDistributionPeriodHours(campaign.distribution_period_hours);
      setDistributionPattern(campaign.distribution_pattern);
      
      const trafficDist = campaign.traffic_source_distribution || { direct: 50, search: 50 };
      console.log('[LOAD DEBUG] Setting traffic distribution to:', trafficDist);
      setTrafficSourceDistribution(trafficDist);
      
      setSearchKeywords(campaign.search_keywords || []);
      setExtensionId(campaign.extension_crx_url || '');
      setBounceRate(campaign.bounce_rate || 30);
      setMinPagesPerSession(campaign.min_pages_per_session || 1);
      setMaxPagesPerSession(campaign.max_pages_per_session || 3);
      setSiteStructure(campaign.site_structure || null);
      setDebugMode(campaign.debug_mode || false);
      setCustomReferrer(campaign.custom_referrer || '');
      setMaxBandwidthMB(Math.round(Number(campaign.max_bandwidth_mb ?? 1)) || 1);
      setUseSerpApi(campaign.use_serp_api || false);
      setSerpApiProvider(campaign.serp_api_provider || 'bright_data');
      setUseBrowserAutomation(campaign.use_browser_automation || false);
      setUseLunaProxySearch(campaign.use_luna_proxy_search || false);
      setCampaignType(campaign.campaign_type || 'direct');
      setUseLunaHeadfulDirect(campaign.use_luna_headful_direct || false);
      
      // Set searchMode based on campaign type
      if (campaign.campaign_type === 'search') {
        setSearchMode('browser_api');
      } else if (campaign.use_luna_headful_direct) {
        setSearchMode('luna_headful_direct');
      }
      
      // If campaign has custom proxy credentials, show override
      setOverrideProxySettings(!!campaign.proxy_override_enabled);
      setHeadlessMode((campaign as any).headless_mode || 'true');
      setLastCampaignId(campaign.id);
      
      loadJourneys(campaign.id);
      loadPlugins(campaign.id);
    }
  }, [campaign]);

  async function loadJourneys(campaignId: string) {
    const { data } = await supabase
      .from('user_journeys')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('step_order');
    if (data) setJourneys(data);
  }

  async function loadPlugins(campaignId: string) {
    const { data } = await supabase
      .from('browser_plugins')
      .select('*')
      .eq('campaign_id', campaignId);
    if (data) setPlugins(data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const sanitizedMaxBandwidth = Number.isFinite(maxBandwidthMB)
        ? Math.max(0, Math.round(maxBandwidthMB))
        : null;

      let campaignId = campaign?.id;

      const sessionsPerHour = Math.max(1, Math.ceil(totalUsers / distributionPeriodHours));

      console.log('[SAVE DEBUG] Saving campaign with traffic distribution:', trafficSourceDistribution);

      const providerToUse = proxyProvider || defaultProviderName || 'luna-default';
      const overrideEnabled = !!(overrideProxySettings && proxyUsername && proxyPassword);
      const proxyPayload = overrideEnabled ? {
        proxy_username: proxyUsername,
        proxy_password: proxyPassword,
        proxy_host: proxyHost,
        proxy_port: proxyPort
      } : {
        proxy_username: null,
        proxy_password: null,
        proxy_host: null,
        proxy_port: null
      };

      if (campaign) {
        const updateData = {
          name,
          target_url: targetUrl,
          total_sessions: totalSessions,
          concurrent_bots: concurrentBots,
          session_duration_min: sessionDurationMin,
          session_duration_max: sessionDurationMax,
          target_geo_locations: targetGeoLocations,
          use_residential_proxies: useResidentialProxies,
          proxy_provider: providerToUse,
          proxy_override_enabled: overrideEnabled,
          ...proxyPayload,
          total_users: totalUsers,
          distribution_period_hours: distributionPeriodHours,
          distribution_pattern: distributionPattern,
          sessions_per_hour: sessionsPerHour,
          bounce_rate: bounceRate,
          min_pages_per_session: minPagesPerSession,
          max_pages_per_session: maxPagesPerSession,
          debug_mode: debugMode,
          traffic_source_distribution: trafficSourceDistribution,
          search_keywords: searchKeywords,
          extension_crx_url: extensionId || null,
          custom_referrer: customReferrer || null,
          max_bandwidth_mb: sanitizedMaxBandwidth,
          use_serp_api: useSerpApi,
          serp_api_provider: serpApiProvider,
          use_browser_automation: useBrowserAutomation,
          use_luna_proxy_search: useLunaProxySearch,
          campaign_type: campaignType,
          use_luna_headful_direct: useLunaHeadfulDirect,
          site_structure: siteStructure,
          site_structure_traced_at: siteStructure ? new Date().toISOString() : null,
          headless_mode: headlessMode,
          updated_at: new Date().toISOString(),
        };
        console.log('[SAVE DEBUG] Full update payload:', updateData);
        
        const { error } = await supabase
          .from('campaigns')
          .update(updateData)
          .eq('id', campaign.id);
        
        if (error) {
          console.error('[SAVE DEBUG] Update error:', error);
          throw error;
        }
        console.log('[SAVE DEBUG] Update successful');
      } else {
        const { data, error } = await supabase
          .from('campaigns')
          .insert({
            user_id: user.id,
            name,
            target_url: targetUrl,
            total_sessions: totalSessions,
            concurrent_bots: concurrentBots,
            session_duration_min: sessionDurationMin,
            session_duration_max: sessionDurationMax,
            target_geo_locations: targetGeoLocations,
            use_residential_proxies: useResidentialProxies,
            proxy_provider: providerToUse,
            proxy_override_enabled: overrideEnabled,
            ...proxyPayload,
            total_users: totalUsers,
            distribution_period_hours: distributionPeriodHours,
            distribution_pattern: distributionPattern,
            sessions_per_hour: sessionsPerHour,
            bounce_rate: bounceRate,
            min_pages_per_session: minPagesPerSession,
            max_pages_per_session: maxPagesPerSession,
            debug_mode: debugMode,
            traffic_source_distribution: trafficSourceDistribution,
            search_keywords: searchKeywords,
            extension_crx_url: extensionId || null,
            custom_referrer: customReferrer || null,
            max_bandwidth_mb: sanitizedMaxBandwidth,
            use_serp_api: useSerpApi,
            serp_api_provider: serpApiProvider,
            use_browser_automation: useBrowserAutomation,
            use_luna_proxy_search: useLunaProxySearch,
            campaign_type: campaignType,
            use_luna_headful_direct: useLunaHeadfulDirect,
            site_structure: siteStructure,
            site_structure_traced_at: siteStructure ? new Date().toISOString() : null,
            headless_mode: headlessMode,
          })
          .select()
          .single();

        if (error) throw error;
        campaignId = data.id;
      }

      if (campaignId) {
        await supabase.from('user_journeys').delete().eq('campaign_id', campaignId);

        if (journeys.length > 0) {
          await supabase.from('user_journeys').insert(
            journeys.map((j, idx) => ({
              campaign_id: campaignId!,
              step_order: idx,
              action_type: j.action_type!,
              selector: j.selector,
              value: j.value,
              wait_before: j.wait_before || 0,
              wait_after: j.wait_after || 1000,
            }))
          );
        }

        await supabase.from('browser_plugins').delete().eq('campaign_id', campaignId);

        if (plugins.length > 0) {
          await supabase.from('browser_plugins').insert(
            plugins.map((p) => ({
              campaign_id: campaignId!,
              name: p.name!,
              extension_id: p.extension_id,
              enabled: p.enabled ?? true,
              configuration: p.configuration || {},
            }))
          );
        }
      }

      onSave();
    } catch (error) {
      console.error('Error saving campaign:', error);
      alert('Failed to save campaign');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-5xl mx-auto">
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-white">
            {campaign ? 'Edit Campaign' : 'Create New Campaign'}
          </h2>
        </div>

        <div className="flex border-b border-slate-700">
          <button
            type="button"
            onClick={() => setCurrentTab('basic')}
            className={`flex-1 px-6 py-4 font-medium transition-colors ${
              currentTab === 'basic'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Basic Settings
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('geo')}
            className={`flex-1 px-6 py-4 font-medium transition-colors ${
              currentTab === 'geo'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Geo & Distribution
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('journey')}
            className={`flex-1 px-6 py-4 font-medium transition-colors ${
              currentTab === 'journey'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            User Journey
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('plugins')}
            className={`flex-1 px-6 py-4 font-medium transition-colors ${
              currentTab === 'plugins'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Browser Plugins
          </button>
        </div>

        <div className="p-6">
          {currentTab === 'basic' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Campaign Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                  placeholder="My Load Test Campaign"
                />
              </div>

              <div className="bg-gradient-to-r from-cyan-500/10 to-green-500/10 border-2 border-cyan-500/30 rounded-xl p-6">
                <label className="block text-sm font-medium text-white mb-3">
                  Traffic Source Mode
                </label>
                <p className="text-xs text-slate-400 mb-4">
                  Choose how traffic will be generated for this campaign
                </p>
                
                <div className="space-y-3">
                  {/* Option 1: Browser API Search */}
                  <label className="flex items-start p-4 border-2 rounded-lg cursor-pointer hover:bg-slate-800/50 transition-colors"
                         style={{ borderColor: searchMode === 'browser_api' ? '#06b6d4' : '#334155' }}>
                    <input
                      type="radio"
                      name="searchMode"
                      value="browser_api"
                      checked={searchMode === 'browser_api'}
                      onChange={(e) => {
                        setSearchMode('browser_api');
                        setCampaignType('search');
                        setUseLunaHeadfulDirect(false);
                      }}
                      className="mt-1 mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-white flex items-center gap-2">
                        🚀 Option 1: Search via Bright Data Browser API
                        <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded border border-green-500/30">RECOMMENDED</span>
                      </div>
                      <p className="text-sm text-slate-400 mt-1">
                        Google search → click result → visit site. Uses Bright Data's unblocking infrastructure with auto-CAPTCHA solving.
                      </p>
                      <div className="text-xs text-slate-500 mt-2 space-y-1">
                        <div>✓ Best for bypassing detection</div>
                        <div>✓ Automatic IP rotation & geo-targeting</div>
                        <div>✓ Extension support (loads with search)</div>
                      </div>
                    </div>
                  </label>
                  
                  {/* Option 2: Luna Headful Direct */}
                  <label className="flex items-start p-4 border-2 rounded-lg cursor-pointer hover:bg-slate-800/50 transition-colors"
                         style={{ borderColor: searchMode === 'luna_headful_direct' ? '#06b6d4' : '#334155' }}>
                    <input
                      type="radio"
                      name="searchMode"
                      value="luna_headful_direct"
                      checked={searchMode === 'luna_headful_direct'}
                      onChange={(e) => {
                        setSearchMode('luna_headful_direct');
                        setCampaignType('direct');
                        setUseLunaHeadfulDirect(true);
                      }}
                      className="mt-1 mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-white flex items-center gap-2">
                        🎯 Option 2: Direct Traffic via Luna (Headful + Extension)
                        <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">NEW</span>
                      </div>
                      <p className="text-sm text-slate-400 mt-1">
                        Direct navigation to target URL. No search, just visit. Uses Luna residential proxy with headless:false + extension support.
                      </p>
                      <div className="text-xs text-slate-500 mt-2 space-y-1">
                        <div>💰 Most cost-effective option</div>
                        <div>⚡ Fastest execution</div>
                        <div>✓ Extension support</div>
                        <div>ℹ️ No Google search (direct URL only)</div>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Target URL
                </label>
                <input
                  type="url"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                  placeholder="https://example.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Total Sessions
                  </label>
                  <input
                    type="number"
                    value={totalSessions}
                    onChange={(e) => setTotalSessions(parseInt(e.target.value))}
                    min="1"
                    required
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Concurrent Bots
                  </label>
                  <input
                    type="number"
                    value={concurrentBots}
                    onChange={(e) => setConcurrentBots(parseInt(e.target.value))}
                    min="1"
                    required
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Min Session Duration (seconds)
                  </label>
                  <input
                    type="number"
                    value={sessionDurationMin}
                    onChange={(e) => setSessionDurationMin(parseInt(e.target.value))}
                    min="30"
                    required
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Max Session Duration (seconds)
                  </label>
                  <input
                    type="number"
                    value={sessionDurationMax}
                    onChange={(e) => setSessionDurationMax(parseInt(e.target.value))}
                    min="30"
                    max="240"
                    required
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Bounce Rate (%)
                </label>
                <input
                  type="number"
                  value={bounceRate}
                  onChange={(e) => setBounceRate(parseInt(e.target.value))}
                  min="0"
                  max="100"
                  required
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors"
                />
                <p className="mt-2 text-sm text-slate-400">
                  Percentage of users that will exit the site after 1-5 seconds (realistic bounce behavior)
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Min Pages Per Session
                  </label>
                  <input
                    type="number"
                    value={minPagesPerSession}
                    onChange={(e) => setMinPagesPerSession(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    max="10"
                    required
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                  <p className="mt-2 text-sm text-slate-400">
                    Minimum number of pages to visit per session (1-10)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Max Pages Per Session
                  </label>
                  <input
                    type="number"
                    value={maxPagesPerSession}
                    onChange={(e) => setMaxPagesPerSession(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    max="10"
                    required
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                  <p className="mt-2 text-sm text-slate-400">
                    Maximum number of pages to visit per session (1-10)
                  </p>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={debugMode}
                    onChange={(e) => setDebugMode(e.target.checked)}
                    className="w-5 h-5 bg-slate-800 border-slate-600 rounded focus:ring-cyan-500"
                  />
                  <span className="text-sm font-medium text-blue-300">Enable Debug Mode</span>
                </label>
                <p className="mt-2 text-sm text-blue-300">
                  When enabled: Bandwidth is calculated and tracked for this campaign launch only. Site analysis runs on first visit to find optimal navigation elements. Debug stats returned in session logs.
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  ⚠️ Production overhead: ZERO (debug tracking only runs when enabled)
                </p>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <label className="block text-sm font-medium text-amber-400 mb-2">
                  Custom Referrer Override (Advanced)
                </label>
                <input
                  type="text"
                  value={customReferrer}
                  onChange={(e) => setCustomReferrer(e.target.value)}
                  placeholder="e.g., https://www.google.com/"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
                <p className="mt-2 text-sm text-amber-300">
                  Force a specific referrer for ALL traffic (overrides automatic referrer detection). Use this to ensure Google Analytics registers traffic as organic search even if search clicks fail.
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Common values: <code className="text-cyan-400">https://www.google.com/</code> for organic search, <code className="text-cyan-400">https://www.facebook.com/</code> for social
                </p>
              </div>

              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                <label className="block text-sm font-medium text-purple-400 mb-3">
                  Browser Headless Mode
                </label>
                <select
                  value={headlessMode}
                  onChange={(e) => setHeadlessMode(e.target.value as 'true' | 'false' | 'new')}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                >
                  <option value="true">Traditional Headless (Recommended)</option>
                  <option value="new">New Headless Mode (Chrome 112+)</option>
                  <option value="false">Headed Mode (Requires Xvfb)</option>
                </select>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="text-purple-300">
                    <strong>Traditional (true):</strong> Stable, works everywhere, supports extensions. Best for most cases.
                  </div>
                  <div className="text-purple-300">
                    <strong>New (new):</strong> Chrome 112+ headless mode with extension support. Best of both worlds.
                  </div>
                  <div className="text-purple-300">
                    <strong>Headed (false):</strong> Full browser with UI. Requires Xvfb on servers. Can be unstable.
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  ⚠️ Changing this affects browser launch configuration on backend servers
                </p>
              </div>

              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                <label className="block text-sm font-medium text-purple-400 mb-2">
                  Max Bandwidth Per Session (MB)
                </label>
                <input
                  type="number"
                  value={maxBandwidthMB}
                  onChange={(e) => setMaxBandwidthMB(Math.max(0, Math.round(Number(e.target.value))))}
                  min="0"
                  max="50"
                  step="1"
                  required
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                />
                <p className="mt-2 text-sm text-purple-300">
                  Session will automatically stop once this bandwidth limit is reached. Extension loads via server bandwidth (no proxy), then all navigation uses proxies.
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  ⚡ Typical usage: 2-5 MB per session | Heavy sites: 10-20 MB
                </p>
              </div>

              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-6">
                <IntelligentTrafficConfig
                  url={targetUrl}
                  isLoading={false}
                  existingStructure={siteStructure}
                  onAnalysisComplete={(structure) => {
                    setSiteStructure(structure);
                    console.log('[SITE STRUCTURE] Analysis complete:', structure);
                  }}
                />
              </div>
            </div>
          )}

          {currentTab === 'geo' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Target Geo Locations
                </label>
                <div className="flex gap-2 mb-3">
                  <select
                    onChange={(e) => {
                      if (e.target.value && !targetGeoLocations.includes(e.target.value)) {
                        setTargetGeoLocations([...targetGeoLocations, e.target.value]);
                      }
                      e.target.value = '';
                    }}
                    className="flex-1 px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors"
                  >
                    <option value="">Add a location...</option>
                    <option value="US">United States</option>
                    <option value="UK">United Kingdom</option>
                    <option value="CA">Canada</option>
                    <option value="AU">Australia</option>
                    <option value="DE">Germany</option>
                    <option value="FR">France</option>
                    <option value="JP">Japan</option>
                    <option value="IN">India</option>
                    <option value="BR">Brazil</option>
                    <option value="MX">Mexico</option>
                    <option value="ES">Spain</option>
                    <option value="IT">Italy</option>
                    <option value="NL">Netherlands</option>
                    <option value="SE">Sweden</option>
                    <option value="SG">Singapore</option>
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  {targetGeoLocations.map((geo) => (
                    <span
                      key={geo}
                      className="px-3 py-2 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg text-sm flex items-center gap-2"
                    >
                      {geo}
                      <button
                        type="button"
                        onClick={() => setTargetGeoLocations(targetGeoLocations.filter((g) => g !== geo))}
                        className="text-cyan-400 hover:text-cyan-300"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <p className="text-slate-500 text-sm mt-2">
                  Bot sessions will be distributed across selected locations
                </p>
              </div>

              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex-1">
                    <div className="text-white font-medium">Residential Proxies</div>
                    <div className="text-slate-400 text-sm">Using default proxy settings from Settings panel</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOverrideProxySettings(!overrideProxySettings)}
                    className={`px-3 py-2 rounded-lg font-medium transition-all text-sm whitespace-nowrap ${
                      overrideProxySettings
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {overrideProxySettings ? '✓ Override Active' : 'Override for This Campaign'}
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Proxy Provider</label>
                    <select
                      value={proxyProvider}
                      onChange={(e) => setProxyProvider(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors"
                    >
                      {providers.length === 0 && (
                        <option value={defaultProviderName || 'luna-default'}>
                          {defaultProviderName || 'luna-default'} (default)
                        </option>
                      )}
                      {providers.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name} ({p.provider_type})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">
                      Scheduler pulls credentials from the settings table unless override is enabled.
                    </p>
                  </div>
                </div>

                {overrideProxySettings && (
                  <>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Proxy Provider
                        </label>
                        <select
                          value={proxyProvider}
                          onChange={(e) => setProxyProvider(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors"
                        >
                          <option value="luna">Luna Proxy (Recommended)</option>
                          <option value="brightdata">Bright Data</option>
                          <option value="smartproxy">SmartProxy</option>
                          <option value="oxylabs">Oxylabs</option>
                          <option value="geosurf">GeoSurf</option>
                          <option value="default">Other/Custom</option>
                        </select>
                      </div>

                      {proxyProvider === 'luna' && (
                        <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-700/40 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-semibold text-green-300">Browser API for Search Traffic</div>
                              <p className="text-xs text-slate-400">Use Bright Data Browser API for Google search (auto CAPTCHA solving). Luna used for direct navigation only.</p>
                            </div>
                            <label className="inline-flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={useLunaProxySearch}
                                onChange={(e) => setUseLunaProxySearch(e.target.checked)}
                                className="w-5 h-5 bg-slate-800 border-slate-600 rounded focus:ring-green-500"
                              />
                              <span className="text-sm text-slate-200">Enable</span>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Proxy Username
                        </label>
                        <input
                          type="text"
                          value={proxyUsername}
                          onChange={(e) => setProxyUsername(e.target.value)}
                          placeholder="user-admin_X5otK"
                          className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Proxy Password
                        </label>
                        <input
                          type="password"
                          value={proxyPassword}
                          onChange={(e) => setProxyPassword(e.target.value)}
                          placeholder="Enter password"
                          className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors"
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Proxy Host
                        </label>
                        <input
                          type="text"
                          value={proxyHost}
                          onChange={(e) => setProxyHost(e.target.value)}
                          placeholder="pr.lunaproxy.com"
                          className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Proxy Port
                        </label>
                        <input
                          type="text"
                          value={proxyPort}
                          onChange={(e) => setProxyPort(e.target.value)}
                          placeholder="12233"
                          className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors"
                        />
                      </div>
                    </div>

                    <p className="text-slate-400 text-xs">
                      These override settings will be used only for this campaign. Default settings from Settings panel will be used for other campaigns.
                    </p>
                  </>
                )}
              </div>

              <div className="space-y-3 bg-slate-900 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <h4 className="text-sm font-semibold text-white">Browser Automation API (Bright Data)</h4>
                    <p className="text-xs text-slate-400">Single remote browser handles search, results, and navigation to target URL (no proxy switching).</p>
                  </div>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useBrowserAutomation}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setUseBrowserAutomation(checked);
                        if (checked) setUseSerpApi(false);
                      }}
                      className="w-5 h-5 bg-slate-800 border-slate-600 rounded focus:ring-cyan-500"
                    />
                    <span className="text-sm text-slate-200">Enable</span>
                  </label>
                </div>
                <p className="text-xs text-amber-300 bg-amber-900/20 border border-amber-700/30 rounded px-3 py-2">
                  Uses your Bright Data Browser Automation zone (e.g., unblocker). Google search → results → click → target all in one browser.
                </p>
                <p className="text-xs text-slate-500">
                  If enabled, dual-proxy SERP flow is bypassed. Ensure search traffic % and keywords are set for Google steps.
                </p>
              </div>

              <div className="space-y-4 bg-gradient-to-br from-cyan-900/20 to-blue-900/20 p-4 rounded-lg border border-cyan-700/30">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-cyan-300">SERP API Integration</h4>
                  <span className="text-xs bg-cyan-500/20 text-cyan-300 px-2 py-1 rounded-full">Recommended for Google</span>
                </div>
                <p className="text-slate-400 text-xs mb-3">
                  Use Bright Data SERP API for search traffic with automatic geo-targeting and IP rotation. Configure in Settings → SERP Config.
                </p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useSerpApi}
                    onChange={(e) => setUseSerpApi(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-900"
                  />
                  <span className="text-sm font-medium text-slate-300">Use Bright Data for Search Traffic</span>
                </label>
                {useSerpApi && (
                  <div className="mt-3 pt-3 border-t border-cyan-700/30">
                    <div className="space-y-3">
                      <p className="text-xs text-cyan-300">Configure Bright Data SERP API in Settings → SERP Config before enabling.</p>
                      <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3">
                        <p className="text-xs text-blue-300 font-medium mb-1">Two-Proxy System:</p>
                        <ul className="text-xs text-slate-400 space-y-1">
                          <li>• Step 1: Bright Data SERP proxy → Search Google</li>
                          <li>• Step 2: Switch to Luna proxy → Visit target site</li>
                          <li>• Direct traffic: Luna proxy only (no Google)</li>
                          <li>• Each session gets unique IP with geo-targeting</li>
                        </ul>
                        <div className="mt-2 pt-2 border-t border-blue-700/30">
                          <p className="text-xs text-amber-300">⚠️ Luna proxy MUST be configured below for search campaigns</p>
                        </div>
                      </div>
                      <select
                        value={serpApiProvider}
                        onChange={(e) => setSerpApiProvider(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                      >
                        <option value="bright_data">Bright Data SERP API</option>
                        <option value="oxylabs">Oxylabs SERP API</option>
                        <option value="smartproxy">Smartproxy SERP API</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {useResidentialProxies && proxyProvider === 'luna' && (
                <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 p-4 rounded-lg border border-green-700/30">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-green-300">Browser API for Search Traffic</h4>
                      <p className="text-xs text-slate-400 mt-1">Use Bright Data Browser API for Google search with automatic CAPTCHA solving</p>
                    </div>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useLunaProxySearch}
                        onChange={(e) => setUseLunaProxySearch(e.target.checked)}
                        className="w-5 h-5 bg-slate-800 border-slate-600 rounded focus:ring-green-500"
                      />
                      <span className="text-sm text-slate-200">Enable</span>
                    </label>
                  </div>
                  {useLunaProxySearch && (
                    <div className="mt-3 pt-3 border-t border-green-700/30 text-xs text-green-300">
                      <p className="mb-2">✓ Search traffic uses Browser API (no Google blocks, auto CAPTCHA solving)</p>
                      <p className="mb-2">✓ Luna proxy used for direct navigation only (cost-effective)</p>
                      <p>✓ Requires: Search traffic % &gt; 0, Search keywords, Browser API credentials</p>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                <h4 className="text-sm font-semibold text-white mb-3">🧩 Browser Extension (Optional)</h4>
                <p className="text-slate-400 text-sm mb-4">
                  Load Chrome extensions automatically. Server downloads and caches extensions from Chrome Web Store.
                </p>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Chrome Extension ID
                  </label>
                  <input
                    type="text"
                    value={extensionId}
                    onChange={(e) => setExtensionId(e.target.value)}
                    placeholder="e.g., cjpalhdlnbpafiamejdnhcphjbkeiagm (SimilarWeb)"
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors font-mono text-sm"
                  />
                  <p className="text-slate-500 text-xs mt-2">
                    💡 Find extension IDs at <span className="text-cyan-400">chrome://extensions</span> (enable Developer Mode)<br/>
                    📦 Extensions are downloaded once and cached on server<br/>
                    ✅ Requires: Xvfb enabled (headless: false)
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-700 pt-6">
                <h3 className="text-lg font-semibold text-white mb-4">Traffic Distribution</h3>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Total Users
                    </label>
                    <input
                      type="number"
                      value={totalUsers}
                      onChange={(e) => setTotalUsers(parseInt(e.target.value))}
                      min="1"
                      required
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                    <p className="text-slate-500 text-xs mt-1">
                      Total number of user sessions
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Distribution Period (hours)
                    </label>
                    <input
                      type="number"
                      value={distributionPeriodHours}
                      onChange={(e) => setDistributionPeriodHours(parseInt(e.target.value))}
                      min="1"
                      required
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                    <p className="text-slate-500 text-xs mt-1">
                      Time period to distribute sessions
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Distribution Pattern
                  </label>
                  <select
                    value={distributionPattern}
                    onChange={(e) => setDistributionPattern(e.target.value as any)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors"
                  >
                    <option value="uniform">Uniform - Even distribution over time</option>
                    <option value="spike">Spike - Concentrated burst of traffic</option>
                    <option value="gradual_increase">Gradual Increase - Slowly ramp up traffic</option>
                    <option value="random">Random - Random intervals</option>
                  </select>
                </div>

                <div className="mt-4 p-4 bg-slate-900 rounded-lg border border-slate-700">
                  <div className="text-sm text-slate-300">
                    <span className="font-medium text-white">Estimated Rate:</span>{' '}
                    {(totalUsers / distributionPeriodHours).toFixed(2)} sessions per hour
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {distributionPattern === 'uniform' && 'Sessions will be evenly distributed throughout the period'}
                    {distributionPattern === 'spike' && 'Most sessions will execute in a short burst'}
                    {distributionPattern === 'gradual_increase' && 'Sessions will gradually increase over time'}
                    {distributionPattern === 'random' && 'Sessions will be randomly distributed'}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-700 pt-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                  {campaignType === 'search' ? 'Search Keywords (Required)' : 'Traffic Source Distribution'}
                </h3>

                {campaignType === 'search' ? (
                  // Search Campaign: Show Keywords Only
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Search Keywords
                    </label>
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        value={keywordInput}
                        onChange={(e) => setKeywordInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && keywordInput.trim()) {
                            e.preventDefault();
                            setSearchKeywords([...searchKeywords, keywordInput.trim()]);
                            setKeywordInput('');
                          }
                        }}
                        placeholder="Enter keyword and press Enter"
                        className="flex-1 px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (keywordInput.trim()) {
                            setSearchKeywords([...searchKeywords, keywordInput.trim()]);
                            setKeywordInput('');
                          }
                        }}
                        className="px-4 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {searchKeywords.map((keyword, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-sm flex items-center gap-2"
                        >
                          {keyword}
                          <button
                            type="button"
                            onClick={() => setSearchKeywords(searchKeywords.filter((_, i) => i !== idx))}
                            className="text-green-400 hover:text-green-300"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <p className="text-slate-500 text-sm mt-2">
                      Bots will randomly search these keywords on Google and click your site from results
                    </p>
                  </div>
                ) : (
                  // Direct Campaign: Show Traffic Distribution (backward compatibility)
                  <>
                    <div className="grid grid-cols-2 gap-6 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Direct Traffic (%)
                        </label>
                        <input
                          type="number"
                          value={trafficSourceDistribution.direct}
                          onChange={(e) => {
                            const direct = parseInt(e.target.value) || 0;
                            setTrafficSourceDistribution({ direct, search: 100 - direct });
                          }}
                          min="0"
                          max="100"
                          className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors"
                        />
                        <p className="text-slate-500 text-xs mt-1">
                          Users navigate directly to URL
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Search Traffic (%)
                        </label>
                        <input
                          type="number"
                          value={trafficSourceDistribution.search}
                          onChange={(e) => {
                            const search = parseInt(e.target.value) || 0;
                            setTrafficSourceDistribution({ direct: 100 - search, search });
                          }}
                          min="0"
                          max="100"
                          className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors"
                        />
                        <p className="text-slate-500 text-xs mt-1">
                          Users search Google then click result
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Search Keywords
                      </label>
                      <div className="flex gap-2 mb-3">
                        <input
                          type="text"
                          value={keywordInput}
                          onChange={(e) => setKeywordInput(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && keywordInput.trim()) {
                              e.preventDefault();
                              setSearchKeywords([...searchKeywords, keywordInput.trim()]);
                              setKeywordInput('');
                            }
                          }}
                          placeholder="Enter keyword and press Enter"
                          className="flex-1 px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (keywordInput.trim()) {
                              setSearchKeywords([...searchKeywords, keywordInput.trim()]);
                              setKeywordInput('');
                            }
                          }}
                          className="px-4 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
                        >
                          Add
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {searchKeywords.map((keyword, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-sm flex items-center gap-2"
                          >
                            {keyword}
                            <button
                              type="button"
                              onClick={() => setSearchKeywords(searchKeywords.filter((_, i) => i !== idx))}
                              className="text-green-400 hover:text-green-300"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                      <p className="text-slate-500 text-sm mt-2">
                        Bots will randomly search these keywords on Google and click your site from results
                      </p>
                    </div>

                    <div className="mt-4 p-4 bg-slate-900 rounded-lg border border-slate-700">
                      <div className="text-sm text-slate-300 space-y-1">
                        <div>
                          <span className="font-medium text-white">Direct:</span>{' '}
                          {Math.round((totalUsers * trafficSourceDistribution.direct) / 100)} users
                        </div>
                        <div>
                          <span className="font-medium text-white">Search:</span>{' '}
                          {Math.round((totalUsers * trafficSourceDistribution.search) / 100)} users
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {currentTab === 'journey' && (
            <JourneyBuilder journeys={journeys} onChange={setJourneys} />
          )}

          {currentTab === 'plugins' && (
            <PluginConfig plugins={plugins} onChange={setPlugins} />
          )}
        </div>

        <div className="p-6 border-t border-slate-700 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:from-slate-600 disabled:to-slate-700 text-white font-medium rounded-lg transition-all shadow-lg flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Campaign
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
