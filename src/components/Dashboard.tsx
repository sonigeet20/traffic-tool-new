import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import CampaignsList from './CampaignsList';
import CampaignForm from './CampaignForm';
import CampaignDetails from './CampaignDetails';
import AnalyticsDashboard from './AnalyticsDashboard';
import BrowserApiCredentials from './BrowserApiCredentials';
import LunaProxyConfig from './LunaProxyConfig';
import { Activity, Plus, BarChart3, LogOut, Settings } from 'lucide-react';
import SerpConfig from './SerpConfig';

type Campaign = Database['public']['Tables']['campaigns']['Row'];

type View = 'campaigns' | 'create' | 'details' | 'analytics' | 'settings';

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('campaigns');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  useEffect(() => {
    loadCampaigns();

    // Set up periodic scheduler trigger for active campaigns
    const schedulerInterval = setInterval(async () => {
      const { data: activeCampaigns } = await supabase
        .from('campaigns')
        .select('id')
        .eq('status', 'active');

      if (activeCampaigns && activeCampaigns.length > 0) {
        // Trigger the scheduler
        try {
          const { data: { session } } = await supabase.auth.getSession();
          await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/campaign-scheduler`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`,
              },
            }
          );
        } catch (error) {
          console.error('Failed to trigger scheduler:', error);
        }
      }

      // Reload campaigns to update UI
      loadCampaigns();
    }, 60000); // Every 1 minute

    return () => clearInterval(schedulerInterval);
  }, []);

  async function loadCampaigns() {
    try {
      setLoading(true);
      console.log('[DASHBOARD] Loading campaigns...');
      
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[DASHBOARD] Error loading campaigns:', error);
        setCampaigns([]);
      } else if (data) {
        console.log('[DASHBOARD] Loaded campaigns:', data.length);
        setCampaigns(data);
        // Update selected campaign if it exists
        if (selectedCampaign) {
          const updated = data.find(c => c.id === selectedCampaign.id);
          if (updated) {
            setSelectedCampaign(updated);
          }
        }
      }
    } catch (err) {
      console.error('[DASHBOARD] Exception loading campaigns:', err);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }

  function handleCreateNew() {
    setSelectedCampaign(null);
    setCurrentView('create');
  }

  function handleViewDetails(campaign: Campaign) {
    setSelectedCampaign(campaign);
    setCurrentView('details');
  }

  function handleEditCampaign(campaign: Campaign) {
    setSelectedCampaign(campaign);
    setCurrentView('create');
  }

  function handleBackToCampaigns() {
    setCurrentView('campaigns');
    setSelectedCampaign(null);
    loadCampaigns();
  }

  function handleSaveCampaign() {
    handleBackToCampaigns();
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Traffic Tester</h1>
                <p className="text-slate-400 text-sm">Bot orchestration & load testing platform</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentView('analytics')}
                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  currentView === 'analytics'
                    ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Analytics
              </button>
              <button
                onClick={() => setCurrentView('settings')}
                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  currentView === 'settings'
                    ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
              {currentView !== 'create' && currentView !== 'settings' && (
                <button
                  onClick={handleCreateNew}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium rounded-lg transition-all shadow-lg flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New Campaign
                </button>
              )}
              <button
                onClick={handleSignOut}
                className="px-4 py-2 bg-slate-700 text-slate-300 hover:bg-slate-600 rounded-lg font-medium transition-all flex items-center gap-2"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {currentView === 'campaigns' && (
          <CampaignsList
            campaigns={campaigns}
            loading={loading}
            onViewDetails={handleViewDetails}
            onEdit={handleEditCampaign}
            onRefresh={loadCampaigns}
          />
        )}

        {currentView === 'create' && (
          <CampaignForm
            campaign={selectedCampaign}
            onSave={handleSaveCampaign}
            onCancel={handleBackToCampaigns}
          />
        )}

        {currentView === 'details' && selectedCampaign && (
          <CampaignDetails
            campaign={selectedCampaign}
            onBack={handleBackToCampaigns}
            onEdit={() => handleEditCampaign(selectedCampaign)}
            onRefresh={loadCampaigns}
          />
        )}

        {currentView === 'analytics' && (
          <AnalyticsDashboard
            campaigns={campaigns}
            onBack={handleBackToCampaigns}
          />
        )}

        {currentView === 'settings' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Settings</h2>
              <p className="text-slate-400">Configure integrations and advanced options</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-2">Backend Endpoint (ALB)</h3>
              <p className="text-slate-400 text-sm mb-4">Use this load balancer endpoint for all frontend API requests.</p>
              <div className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono text-sm break-all">
                http://traffic-tool-alb-681297197.us-east-1.elb.amazonaws.com:3000/api/automate
              </div>
              <p className="text-slate-500 text-xs mt-3">If the ALB changes, update this value in code and redeploy.</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Luna Proxy Configuration</h3>
              <LunaProxyConfig />
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Bright Data Browser API</h3>
              <BrowserApiCredentials />
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">SERP API Configuration</h3>
              <SerpConfig />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
