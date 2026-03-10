-- Check if campaign 067bbb4d-109b-439a-882c-d666526da132 is using overridden Bright Data credentials
-- for direct traffic campaigns

-- First, get campaign details
SELECT 
  id,
  name,
  campaign_type,
  target_url,
  -- Proxy override settings
  proxy_override_enabled,
  proxy_username,
  proxy_password,
  proxy_host,
  proxy_port,
  proxy_provider,
  -- Browser automation settings
  use_browser_automation,
  use_luna_proxy_search,
  use_serp_api,
  serp_api_provider,
  use_luna_headful_direct,
  -- Check if using custom proxy settings (override)
  CASE 
    WHEN proxy_override_enabled = true THEN 'YES - Using Campaign Override'
    WHEN proxy_username IS NOT NULL AND proxy_password IS NOT NULL THEN 'YES - Has Proxy Credentials (legacy override)'
    ELSE 'NO - Using Default Settings'
  END as uses_override,
  user_id
FROM campaigns
WHERE id = '067bbb4d-109b-439a-882c-d666526da132';

-- Get user's default Bright Data Browser API configuration
SELECT 
  'User Default Bright Data Config' as config_type,
  browser_customer_id,
  browser_username,
  browser_zone,
  browser_endpoint,
  browser_port,
  CASE WHEN browser_api_token IS NOT NULL THEN 'SET' ELSE 'NOT SET' END as api_token_status,
  CASE WHEN browser_password IS NOT NULL THEN 'SET' ELSE 'NOT SET' END as password_status,
  enabled
FROM bright_data_serp_config
WHERE user_id = (SELECT user_id FROM campaigns WHERE id = '067bbb4d-109b-439a-882c-d666526da132');

-- Get user's default proxy settings
SELECT 
  'User Default Proxy Config' as config_type,
  default_proxy_provider,
  CASE WHEN default_proxy_username IS NOT NULL THEN 'SET' ELSE 'NOT SET' END as proxy_username_status,
  CASE WHEN default_proxy_password IS NOT NULL THEN 'SET' ELSE 'NOT SET' END as proxy_password_status,
  default_proxy_host,
  default_proxy_port
FROM settings
WHERE user_id = (SELECT user_id FROM campaigns WHERE id = '067bbb4d-109b-439a-882c-d666526da132');

-- Summary: Determine which credentials are being used
SELECT 
  c.id as campaign_id,
  c.name as campaign_name,
  c.campaign_type,
  CASE 
    WHEN c.campaign_type = 'direct' THEN 
      CASE
        WHEN c.proxy_override_enabled = true OR (c.proxy_username IS NOT NULL AND c.proxy_password IS NOT NULL) THEN
          'CAMPAIGN OVERRIDE - Using campaign-specific proxy credentials (NOT Bright Data from settings)'
        ELSE
          'DEFAULT SETTINGS - Using proxy credentials from Settings table (NOT Bright Data)'
      END
    WHEN c.campaign_type = 'search' THEN
      'SEARCH CAMPAIGN - Uses Bright Data Browser API from bright_data_serp_config'
    ELSE
      'UNKNOWN CAMPAIGN TYPE'
  END as credential_source,
  c.use_browser_automation,
  c.use_luna_proxy_search,
  c.proxy_provider as override_proxy_provider,
  CASE 
    WHEN c.proxy_override_enabled = true OR (c.proxy_username IS NOT NULL) THEN 
      concat(c.proxy_host, ':', c.proxy_port) 
    ELSE 
      'Using default from settings'
  END as proxy_endpoint
FROM campaigns c
WHERE c.id = '067bbb4d-109b-439a-882c-d666526da132';
