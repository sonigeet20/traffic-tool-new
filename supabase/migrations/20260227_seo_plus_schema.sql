/*
  # SEO+ Ranking Tracker - Complete Schema

  1. New Tables
    - seo_projects: Track SEO projects and ranking goals
    - seo_keywords: Keywords being tracked for rankings
    - seo_rank_snapshots: Daily/weekly/monthly ranking snapshots
    - seo_campaigns: Click traffic campaigns for ranking boost
    - seo_click_sessions: Individual click sessions for ranking improvement
    - seo_rank_history: Historical ranking data for trend analysis
    - seo_competitor_tracking: Monitor competitor rankings
    - seo_rank_alerts: Alerts for significant ranking changes

  2. RLS Policies
    - All tables have user-based RLS policies
    - Filtering by auth.uid() ensures data isolation

  3. Indexes
    - Optimized for common queries (rankings by date, projects, keywords)
*/

-- ============================================================================
-- 1. SEO_PROJECTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS seo_projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic info
  name TEXT NOT NULL,
  description TEXT,
  website_url TEXT NOT NULL,
  target_country TEXT DEFAULT 'US',
  crawl_frequency TEXT DEFAULT 'daily', -- daily, weekly, monthly
  
  -- Crawl settings
  smart_tier_enabled BOOLEAN DEFAULT true,
  daily_crawl_top_count INTEGER DEFAULT 20, -- Top N keywords crawled daily
  weekly_crawl_range TEXT DEFAULT '20-50', -- Mid-tier keywords crawled 3x/week
  monthly_crawl_range TEXT DEFAULT '50+', -- Bottom-tier crawled weekly
  
  -- SEO goals
  avg_rank_target INTEGER, -- Target average ranking position
  top_10_keywords_target INTEGER, -- Target # of keywords in top 10
  top_3_keywords_target INTEGER, -- Target # of keywords in top 3
  
  -- Status
  status TEXT DEFAULT 'active', -- active, paused, completed, archived
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_seo_projects_user_id ON seo_projects(user_id);
CREATE INDEX idx_seo_projects_status ON seo_projects(status);

-- Enable RLS
ALTER TABLE seo_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY seo_projects_user_access ON seo_projects
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 2. SEO_KEYWORDS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS seo_keywords (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES seo_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Keyword info
  keyword TEXT NOT NULL,
  search_volume INTEGER, -- Monthly search volume
  difficulty_score INTEGER, -- SEO difficulty (0-100)
  intent TEXT, -- commercial, informational, navigational, transactional
  
  -- Tier (for smart crawling frequency)
  tier TEXT DEFAULT 'tier2', -- tier1 (top 20), tier2 (20-50), tier3 (50+)
  priority INTEGER DEFAULT 0,
  
  -- Current ranking
  current_rank INTEGER,
  current_rank_updated_at TIMESTAMP WITH TIME ZONE,
  
  -- Targets
  target_rank INTEGER,
  target_position TEXT DEFAULT 'top-10', -- top-3, top-5, top-10, top-20
  
  -- Status
  status TEXT DEFAULT 'active', -- active, paused, achieved, archived
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_seo_keywords_project_id ON seo_keywords(project_id);
CREATE INDEX idx_seo_keywords_user_id ON seo_keywords(user_id);
CREATE INDEX idx_seo_keywords_tier ON seo_keywords(tier);
CREATE INDEX idx_seo_keywords_status ON seo_keywords(status);

ALTER TABLE seo_keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY seo_keywords_user_access ON seo_keywords
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 3. SEO_RANK_SNAPSHOTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS seo_rank_snapshots (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES seo_projects(id) ON DELETE CASCADE,
  keyword_id UUID NOT NULL REFERENCES seo_keywords(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Ranking data
  rank_position INTEGER,
  rank_url TEXT,
  rank_title TEXT,
  rank_snippet TEXT,
  search_engine TEXT DEFAULT 'google', -- google, bing, etc
  
  -- Metadata
  snapshot_date DATE DEFAULT CURRENT_DATE,
  snapshot_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  crawl_method TEXT, -- api, browser, manual
  
  -- Trend info
  rank_change INTEGER, -- Change from previous snapshot
  trend TEXT, -- improved, declined, stable
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_seo_rank_snapshots_project_id ON seo_rank_snapshots(project_id);
CREATE INDEX idx_seo_rank_snapshots_keyword_id ON seo_rank_snapshots(keyword_id);
CREATE INDEX idx_seo_rank_snapshots_user_id ON seo_rank_snapshots(user_id);
CREATE INDEX idx_seo_rank_snapshots_date ON seo_rank_snapshots(snapshot_date);
CREATE INDEX idx_seo_rank_snapshots_time ON seo_rank_snapshots(snapshot_time DESC);

ALTER TABLE seo_rank_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY seo_rank_snapshots_user_access ON seo_rank_snapshots
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 4. SEO_RANK_HISTORY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS seo_rank_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES seo_projects(id) ON DELETE CASCADE,
  keyword_id UUID NOT NULL REFERENCES seo_keywords(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Historical data
  rank_30_days_ago INTEGER,
  rank_60_days_ago INTEGER,
  rank_90_days_ago INTEGER,
  rank_6_months_ago INTEGER,
  rank_1_year_ago INTEGER,
  
  -- Current
  rank_today INTEGER,
  
  -- Trend analysis
  trend_direction TEXT, -- up, down, stable
  trend_percentage NUMERIC(5,2), -- Percentage change
  
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_seo_rank_history_project_id ON seo_rank_history(project_id);
CREATE INDEX idx_seo_rank_history_keyword_id ON seo_rank_history(keyword_id);
CREATE INDEX idx_seo_rank_history_user_id ON seo_rank_history(user_id);

ALTER TABLE seo_rank_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY seo_rank_history_user_access ON seo_rank_history
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 5. SEO_CAMPAIGNS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS seo_campaigns (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES seo_projects(id) ON DELETE CASCADE,
  keyword_id UUID NOT NULL REFERENCES seo_keywords(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Campaign details
  name TEXT NOT NULL,
  description TEXT,
  search_keyword TEXT NOT NULL,
  
  -- Campaign goals
  target_keywords_for_clicks TEXT[],
  total_clicks_goal INTEGER DEFAULT 100,
  daily_click_budget INTEGER DEFAULT 10,
  
  -- Bright Data credentials
  browser_customer_id TEXT,
  browser_zone TEXT,
  browser_username TEXT,
  browser_password TEXT,
  
  -- Campaign status
  status TEXT DEFAULT 'pending', -- pending, running, paused, completed, failed
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Metrics
  total_clicks_delivered INTEGER DEFAULT 0,
  avg_rank_before NUMERIC(4,1),
  avg_rank_after NUMERIC(4,1),
  rank_improvement NUMERIC(4,1),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_seo_campaigns_project_id ON seo_campaigns(project_id);
CREATE INDEX idx_seo_campaigns_keyword_id ON seo_campaigns(keyword_id);
CREATE INDEX idx_seo_campaigns_user_id ON seo_campaigns(user_id);
CREATE INDEX idx_seo_campaigns_status ON seo_campaigns(status);

ALTER TABLE seo_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY seo_campaigns_user_access ON seo_campaigns
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 6. SEO_CLICK_SESSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS seo_click_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES seo_campaigns(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES seo_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Session details
  search_keyword TEXT NOT NULL,
  clicked_url TEXT NOT NULL,
  session_duration_sec INTEGER,
  geo_location TEXT DEFAULT 'US',
  device_type TEXT DEFAULT 'desktop', -- desktop, mobile, tablet
  
  -- Session status
  status TEXT DEFAULT 'pending', -- pending, running, completed, failed
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Metrics
  pages_visited INTEGER DEFAULT 0,
  bounce_rate NUMERIC(3,2), -- 0.0-1.0
  time_on_site_sec INTEGER,
  
  -- Browser automation
  browser_method TEXT DEFAULT 'browser_api_websocket',
  error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_seo_click_sessions_campaign_id ON seo_click_sessions(campaign_id);
CREATE INDEX idx_seo_click_sessions_project_id ON seo_click_sessions(project_id);
CREATE INDEX idx_seo_click_sessions_user_id ON seo_click_sessions(user_id);
CREATE INDEX idx_seo_click_sessions_status ON seo_click_sessions(status);

ALTER TABLE seo_click_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY seo_click_sessions_user_access ON seo_click_sessions
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 7. SEO_COMPETITOR_TRACKING TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS seo_competitor_tracking (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES seo_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Competitor info
  competitor_domain TEXT NOT NULL,
  competitor_name TEXT,
  
  -- Shared keywords
  shared_keyword_ids UUID[],
  total_shared_keywords INTEGER DEFAULT 0,
  
  -- Ranking comparison
  your_avg_rank NUMERIC(4,1),
  competitor_avg_rank NUMERIC(4,1),
  rank_difference NUMERIC(4,1),
  
  -- Top keywords where competitor ranks better
  competitor_top_keywords JSONB, -- {keyword, their_rank, your_rank}
  
  -- Tracking
  last_checked_at TIMESTAMP WITH TIME ZONE,
  tracking_enabled BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_seo_competitor_tracking_project_id ON seo_competitor_tracking(project_id);
CREATE INDEX idx_seo_competitor_tracking_user_id ON seo_competitor_tracking(user_id);

ALTER TABLE seo_competitor_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY seo_competitor_tracking_user_access ON seo_competitor_tracking
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 8. SEO_RANK_ALERTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS seo_rank_alerts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES seo_projects(id) ON DELETE CASCADE,
  keyword_id UUID NOT NULL REFERENCES seo_keywords(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Alert trigger
  alert_type TEXT NOT NULL, -- rank_drop, rank_gain, milestone, competitor
  trigger_description TEXT,
  
  -- Alert details
  previous_rank INTEGER,
  new_rank INTEGER,
  rank_change INTEGER,
  
  -- Timing
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  alert_dismissed BOOLEAN DEFAULT false,
  
  -- Action
  action_taken TEXT, -- campaign_started, investigation, ignored
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_seo_rank_alerts_project_id ON seo_rank_alerts(project_id);
CREATE INDEX idx_seo_rank_alerts_keyword_id ON seo_rank_alerts(keyword_id);
CREATE INDEX idx_seo_rank_alerts_user_id ON seo_rank_alerts(user_id);
CREATE INDEX idx_seo_rank_alerts_type ON seo_rank_alerts(alert_type);

ALTER TABLE seo_rank_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY seo_rank_alerts_user_access ON seo_rank_alerts
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- FUNCTIONS FOR SEO+ SYSTEM
-- ============================================================================

-- Function to update keyword tier based on current rank
CREATE OR REPLACE FUNCTION update_keyword_tier()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_rank IS NOT NULL THEN
    IF NEW.current_rank <= 20 THEN
      NEW.tier := 'tier1';
    ELSIF NEW.current_rank <= 50 THEN
      NEW.tier := 'tier2';
    ELSE
      NEW.tier := 'tier3';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER keyword_tier_update
BEFORE INSERT OR UPDATE ON seo_keywords
FOR EACH ROW
EXECUTE FUNCTION update_keyword_tier();

-- Function to mark campaign as completed when all clicks are delivered
CREATE OR REPLACE FUNCTION check_campaign_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.total_clicks_delivered >= (
    SELECT total_clicks_goal FROM seo_campaigns WHERE id = NEW.campaign_id
  ) THEN
    UPDATE seo_campaigns
    SET status = 'completed', completed_at = NOW()
    WHERE id = NEW.campaign_id AND status != 'completed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER campaign_completion_check
AFTER INSERT OR UPDATE ON seo_click_sessions
FOR EACH ROW
EXECUTE FUNCTION check_campaign_completion();

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Verify all SEO+ tables created:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'seo_%' ORDER BY tablename;
