-- Rename max_bandwidth_mb to max_bandwidth_kb and convert values
-- MB values will be multiplied by 1024 to get KB values
ALTER TABLE campaigns 
RENAME COLUMN max_bandwidth_mb TO max_bandwidth_kb;

-- Update existing values from MB to KB (multiply by 1024)
UPDATE campaigns 
SET max_bandwidth_kb = max_bandwidth_kb * 1024
WHERE max_bandwidth_kb IS NOT NULL;

COMMENT ON COLUMN campaigns.max_bandwidth_kb IS 'Maximum bandwidth per session in kilobytes (KB). Allows decimal values for fine-grained control.';
