-- Add proxy providers table and default selection in settings
CREATE TABLE IF NOT EXISTS proxy_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL DEFAULT 'luna',
  username TEXT,
  password TEXT,
  host TEXT,
  port TEXT,
  enabled BOOLEAN DEFAULT true,
  extra_config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, name)
);

-- RLS for proxy_providers
ALTER TABLE proxy_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own proxy providers"
  ON proxy_providers FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own proxy providers"
  ON proxy_providers FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own proxy providers"
  ON proxy_providers FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own proxy providers"
  ON proxy_providers FOR DELETE
  USING (auth.uid() = user_id);

-- Extend settings with default proxy provider name
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS default_proxy_provider TEXT;

-- Ensure campaigns can explicitly enable proxy overrides
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS proxy_override_enabled BOOLEAN DEFAULT false;
