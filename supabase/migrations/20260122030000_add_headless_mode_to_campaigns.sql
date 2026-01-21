-- Add headless_mode column to campaigns table
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS headless_mode text DEFAULT 'true' CHECK (headless_mode IN ('true', 'false', 'new'));

COMMENT ON COLUMN campaigns.headless_mode IS 'Browser headless mode: true (traditional), false (headed with Xvfb), new (Chrome 112+ headless)';
