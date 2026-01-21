-- Add campaign_type column to campaigns table
-- This separates search campaigns (Browser API) from direct campaigns (Luna Proxy)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'campaign_type'
  ) THEN
    ALTER TABLE campaigns 
      ADD COLUMN campaign_type TEXT DEFAULT 'direct' 
      CHECK (campaign_type IN ('direct', 'search'));
  END IF;
END $$;

-- Add index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_campaigns_campaign_type ON campaigns(campaign_type);

-- Update existing campaigns to have explicit type
-- If they have search keywords, mark as search, otherwise direct
UPDATE campaigns 
SET campaign_type = CASE 
  WHEN search_keywords IS NOT NULL AND array_length(search_keywords, 1) IS NOT NULL AND array_length(search_keywords, 1) > 0 THEN 'search'
  ELSE 'direct'
END;

-- Add comment for documentation
COMMENT ON COLUMN campaigns.campaign_type IS 'Campaign type: "search" uses Browser API for search+click, "direct" uses Luna Proxy for direct navigation';
