import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pffapmqqswcmndlvkjrs.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZmFwbXFxc3djbW5kbHZranJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5ODY3OTYsImV4cCI6MjA4NDU2Mjc5Nn0.oVibU3ip3oLVBK0ItBjCjQSZaa1Xi-R7ocmysuqNp2k';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/* ─── Types matching production DB schema ─── */

export interface SEOProject {
  id: string;
  user_id: string;
  name: string;
  website_url: string;
  target_country: string;
  avg_rank_target?: number;
  crawl_frequency: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SEOKeyword {
  id: string;
  project_id: string;
  keyword: string;
  search_volume?: number;
  difficulty_score?: number;
  current_rank?: number;
  previous_rank?: number;
  best_rank?: number;
  target_rank?: number;
  tier: string;
  status: string;
  created_at: string;
  last_checked?: string;
}

export interface RankSnapshot {
  id: string;
  keyword_id: string;
  rank_position: number;
  snapshot_date: string;
  search_engine: string;
  device_type: string;
  serp_features?: Record<string, boolean>;
}

export interface RankHistory {
  id: string;
  keyword_id: string;
  date_from: string;
  date_to: string;
  avg_rank: number;
  min_rank: number;
  max_rank: number;
}

export interface SEOCampaign {
  id: string;
  project_id: string;
  keyword_id?: string;
  name: string;
  search_keyword: string;
  target_url?: string;
  status: string;
  total_clicks_goal: number;
  total_clicks_delivered: number;
  daily_click_limit: number;
  geo_targets?: string[];
  device_mix?: Record<string, number>;
  bounce_rate?: number;
  min_session_duration?: number;
  max_session_duration?: number;
  rank_before?: number;
  rank_after?: number;
  rank_improvement?: number;
  start_date?: string;
  end_date?: string;
  created_at: string;
  // Joined fields
  seo_projects?: { name: string; website_url: string };
  seo_keywords?: { keyword: string };
}

export interface SEOClickSession {
  id: string;
  campaign_id: string;
  status: string;
  device_type: string;
  geo_location?: string;
  session_duration?: number;
  pages_visited?: number;
  clicked_position?: number;
  bounced: boolean;
  created_at: string;
}

export interface SEOCompetitor {
  id: string;
  project_id: string;
  competitor_domain: string;
  competitor_name?: string;
  overlap_score?: number;
  is_tracking: boolean;
  created_at: string;
  // Joined fields
  seo_projects?: { name: string };
}

export interface SEORankAlert {
  id: string;
  project_id: string;
  keyword_id?: string;
  alert_type: string;
  threshold: number;
  current_value?: number;
  is_active: boolean;
  triggered_at?: string;
  created_at: string;
}
