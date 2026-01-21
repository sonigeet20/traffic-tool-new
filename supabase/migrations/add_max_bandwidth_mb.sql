-- Add max_bandwidth_mb column to campaigns table (numeric, default 0.2 MB)
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS max_bandwidth_mb NUMERIC(6,2) DEFAULT 0.20;

COMMENT ON COLUMN campaigns.max_bandwidth_mb IS 'Maximum bandwidth in MB per session - stops session when exceeded';
