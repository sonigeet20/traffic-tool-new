import { useState } from 'react';
import { Eye, Edit2, Play, Pause, Trash2, RefreshCw, Loader2, Copy, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Campaign = Database['public']['Tables']['campaigns']['Row'];

interface CampaignsListProps {
  campaigns: Campaign[];
  loading: boolean;
  onViewDetails: (campaign: Campaign) => void;
  onEdit: (campaign: Campaign) => void;
  onRefresh: () => void;
  onCreateNew: () => void;
}

export default function CampaignsList({
  campaigns,
  loading,
  onViewDetails,
  onEdit,
  onRefresh,
  onCreateNew,
}: CampaignsListProps) {
  const [startingCampaign, setStartingCampaign] = useState<string | null>(null);
  const [duplicatingCampaign, setDuplicatingCampaign] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'paused':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'completed':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  async function handleToggleStatus(campaign: Campaign) {
    const newStatus = campaign.status === 'active' ? 'paused' : 'active';

    if (newStatus === 'active') {
      setStartingCampaign(campaign.id);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          alert('Please sign in again to start a campaign.');
          setStartingCampaign(null);
          return;
        }
        let body: any = { campaignId: campaign.id };
        
        // Get the current user for config
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: config } = await supabase
            .from('bright_data_serp_config')
            .select('browser_ws_endpoint, api_token, customer_id, zone_name, endpoint, port')
            .eq('user_id', user.id)
            .maybeSingle();
          
          // If browser automation is enabled AND SERP API is NOT enabled, add browser_ws_endpoint
          if (campaign.use_browser_automation && !campaign.use_serp_api && config && config.browser_ws_endpoint) {
            body.browser_ws_endpoint = config.browser_ws_endpoint;
          }
          
          // If SERP API is enabled, add SERP credentials (disables Browser Automation)
          if (campaign.use_serp_api && config && config.api_token && config.customer_id) {
            body.serp_api_token = config.api_token;
            body.serp_customer_id = config.customer_id;
            body.serp_zone_name = config.zone_name || 'serp';
            body.serp_endpoint = config.endpoint || 'brd.superproxy.io';
            body.serp_port = config.port || '33335';
          }
        }
        
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/start-campaign`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(body),
          }
        );

        if (!response.ok) {
          const error = await response.text();
          console.error('Failed to start campaign:', error);
          alert('Failed to start campaign. Check console for details.');
          setStartingCampaign(null);
          return;
        }

        const result = await response.json();
        console.log('Campaign started:', result);
      } catch (error) {
        console.error('Error starting campaign:', error);
        alert('Failed to start campaign. Check console for details.');
        setStartingCampaign(null);
        return;
      } finally {
        setStartingCampaign(null);
      }
    } else {
      await supabase
        .from('campaigns')
        .update({
          status: newStatus,
        })
        .eq('id', campaign.id);
    }

    onRefresh();
  }

  async function handleDelete(id: string) {
    if (confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
      await supabase.from('campaigns').delete().eq('id', id);
      onRefresh();
    }
  }

  async function handleDuplicate(campaign: Campaign) {
    setDuplicatingCampaign(campaign.id);
    try {
      // Get user journey steps if they exist
      const { data: journeySteps } = await supabase
        .from('user_journeys')
        .select('*')
        .eq('campaign_id', campaign.id)
        .order('step_order', { ascending: true });

      // Create new campaign with duplicated data
      const { data: newCampaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          user_id: campaign.user_id,
          name: `${campaign.name} (Copy)`,
          target_url: campaign.target_url,
          total_sessions: campaign.total_sessions,
          concurrent_bots: campaign.concurrent_bots,
          sessions_per_hour: campaign.sessions_per_hour,
          session_duration_min: campaign.session_duration_min,
          session_duration_max: campaign.session_duration_max,
          target_geo_locations: campaign.target_geo_locations,
          traffic_source_distribution: campaign.traffic_source_distribution,
          search_keywords: campaign.search_keywords,
          use_residential_proxies: campaign.use_residential_proxies,
          proxy_username: campaign.proxy_username,
          proxy_password: campaign.proxy_password,
          proxy_host: campaign.proxy_host,
          proxy_port: campaign.proxy_port,
          extension_crx_url: campaign.extension_crx_url,
          bounce_rate: campaign.bounce_rate,
          custom_referrer: campaign.custom_referrer,
          status: 'draft',
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Duplicate user journey steps if they exist
      if (journeySteps && journeySteps.length > 0 && newCampaign) {
        const duplicatedSteps = journeySteps.map((step) => ({
          campaign_id: newCampaign.id,
          step_order: step.step_order,
          action_type: step.action_type,
          selector: step.selector,
          wait_time: step.wait_time,
        }));

        await supabase.from('user_journeys').insert(duplicatedSteps);
      }

      onRefresh();
    } catch (error) {
      console.error('Error duplicating campaign:', error);
      alert('Failed to duplicate campaign');
    } finally {
      setDuplicatingCampaign(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Your Campaigns</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={onCreateNew}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium rounded-lg transition-all shadow-lg flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Campaign
            </button>
            <button
              onClick={onRefresh}
              className="p-2 text-slate-400 hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-800 rounded-full mb-4">
            <Play className="w-8 h-8 text-slate-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">No campaigns yet</h2>
          <p className="text-slate-400 mb-6">Create your first campaign to start load testing</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Your Campaigns</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={onCreateNew}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium rounded-lg transition-all shadow-lg flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Campaign
          </button>
          <button
            onClick={onRefresh}
            className="p-2 text-slate-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {campaigns.map((campaign) => (
          <div
            key={campaign.id}
            className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 hover:border-slate-600 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-semibold text-white">{campaign.name}</h3>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                      campaign.status
                    )}`}
                  >
                    {campaign.status}
                  </span>
                </div>
                <p className="text-slate-400 text-sm mb-3">{campaign.target_url}</p>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-slate-300">
                    <span className="text-slate-500">Sessions:</span> {campaign.total_sessions}
                  </div>
                  <div className="text-slate-300">
                    <span className="text-slate-500">Concurrent:</span> {campaign.concurrent_bots}
                  </div>
                  <div className="text-slate-300">
                    <span className="text-slate-500">Duration:</span> {campaign.session_duration_min}s
                    -{campaign.session_duration_max}s
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onViewDetails(campaign)}
                  className="p-2 text-cyan-400 hover:bg-slate-700 rounded-lg transition-colors"
                  title="View details"
                >
                  <Eye className="w-5 h-5" />
                </button>
                <button
                  onClick={() => onEdit(campaign)}
                  className="p-2 text-blue-400 hover:bg-slate-700 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDuplicate(campaign)}
                  disabled={duplicatingCampaign === campaign.id}
                  className={`p-2 text-purple-400 hover:bg-slate-700 rounded-lg transition-colors ${
                    duplicatingCampaign === campaign.id ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  title={duplicatingCampaign === campaign.id ? 'Duplicating...' : 'Duplicate'}
                >
                  {duplicatingCampaign === campaign.id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={() => handleToggleStatus(campaign)}
                  disabled={startingCampaign === campaign.id}
                  className={`p-2 hover:bg-slate-700 rounded-lg transition-colors ${
                    campaign.status === 'active' ? 'text-yellow-400' : 'text-green-400'
                  } ${startingCampaign === campaign.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={startingCampaign === campaign.id ? 'Starting...' : campaign.status === 'active' ? 'Pause' : 'Start'}
                >
                  {startingCampaign === campaign.id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : campaign.status === 'active' ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={() => handleDelete(campaign.id)}
                  className="p-2 text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {campaign.started_at && (
              <div className="text-xs text-slate-500">
                Started: {new Date(campaign.started_at).toLocaleString()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
