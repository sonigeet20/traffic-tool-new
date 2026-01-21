-- Add settings table for backend endpoint and credentials
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  backend_endpoint TEXT NOT NULL DEFAULT 'http://traffic-tool-alb-681297197.us-east-1.elb.amazonaws.com:3000',
  luna_proxy_username TEXT,
  luna_proxy_password TEXT,
  luna_proxy_host TEXT DEFAULT 'pr.lunaproxy.com',
  luna_proxy_port TEXT DEFAULT '12233',
  luna_proxy_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own settings"
  ON settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
  ON settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own settings"
  ON settings FOR DELETE
  USING (auth.uid() = user_id);

-- Insert default settings for existing users
INSERT INTO settings (user_id, backend_endpoint)
SELECT id, 'http://traffic-tool-alb-681297197.us-east-1.elb.amazonaws.com:3000'
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
