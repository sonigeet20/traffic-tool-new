-- =============================================================================
-- COMPLETE SUPABASE MIGRATION SQL
-- Run this in Supabase Dashboard > SQL Editor
-- Project: pffapmqqswcmndlvkjrs (https://pffapmqqswcmndlvkjrs.supabase.co)
-- =============================================================================

-- Add site_structure column for pre-mapped website analysis
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS site_structure JSONB;
CREATE INDEX IF NOT EXISTS idx_campaigns_site_structure ON campaigns USING GIN (site_structure);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS site_structure_traced_at TIMESTAMP;

-- Add comments for documentation
COMMENT ON COLUMN campaigns.site_structure IS 'Pre-mapped website structure including navigable pages, forms, content areas, and internal links';
COMMENT ON COLUMN campaigns.site_structure_traced_at IS 'Timestamp when website structure was analyzed';

-- =============================================================================
-- Verification query (run after migration)
-- =============================================================================
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'campaigns' 
  AND column_name IN ('site_structure', 'site_structure_traced_at')
ORDER BY column_name;
