// Minimal Supabase types used in the app (campaigns, journeys, plugins, sessions)
export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

type Nullable<T> = T | null;

type CampaignRow = {
	id: string;
	user_id: Nullable<string>;
	name: string;
	target_url: string;
	total_sessions: number;
	concurrent_bots: number;
	session_duration_min: number;
	session_duration_max: number;
	target_geo_locations: Nullable<string[]>;
	use_residential_proxies: boolean;
	proxy_provider: Nullable<string>;
	proxy_username: Nullable<string>;
	proxy_password: Nullable<string>;
	proxy_host: Nullable<string>;
	proxy_port: Nullable<string>;
	proxy_override_enabled?: Nullable<boolean>;
	total_users: number;
	distribution_period_hours: number;
	distribution_pattern: Nullable<string>;
	traffic_source_distribution: Nullable<Json>;
	search_keywords: Nullable<string[]>;
	extension_crx_url: Nullable<string>;
	bounce_rate: Nullable<number>;
	custom_referrer: Nullable<string>;
	use_serp_api: Nullable<boolean>;
	serp_api_provider: Nullable<string>;
	sessions_per_hour: Nullable<number>;
	status: Nullable<string>;
	created_at: Nullable<string>;
	updated_at: Nullable<string>;
	started_at?: Nullable<string>;
	use_browser_automation?: Nullable<boolean>;
	use_luna_proxy_search?: Nullable<boolean>;
	campaign_type?: Nullable<'direct' | 'search'>;
	max_bandwidth_kb?: Nullable<number>;
};

type SettingsRow = {
	id: string;
	user_id: Nullable<string>;
	backend_endpoint: string;
	luna_proxy_username: Nullable<string>;
	luna_proxy_password: Nullable<string>;
	luna_proxy_host: Nullable<string>;
	luna_proxy_port: Nullable<string>;
	luna_proxy_enabled: Nullable<boolean>;
	default_proxy_provider: Nullable<string>;
	created_at?: Nullable<string>;
	updated_at?: Nullable<string>;
};

type ProxyProviderRow = {
	id: string;
	user_id: string;
	name: string;
	provider_type: string;
	username: Nullable<string>;
	password: Nullable<string>;
	host: Nullable<string>;
	port: Nullable<string>;
	enabled: Nullable<boolean>;
	extra_config: Nullable<Json>;
	created_at?: Nullable<string>;
	updated_at?: Nullable<string>;
};

type UserJourneyRow = {
	id?: string;
	campaign_id: string;
	step_order: number;
	action_type: string;
	selector: Nullable<string>;
	value: Nullable<string>;
	wait_before: Nullable<number>;
	wait_after: Nullable<number>;
};

type BrowserPluginRow = {
	id?: string;
	campaign_id: string;
	name: string;
	extension_id: Nullable<string>;
	enabled: Nullable<boolean>;
	configuration: Json;
};

type BotSessionRow = {
	id: string;
	campaign_id: string;
	status: string;
	user_agent: Nullable<string>;
	geo_location: Nullable<string>;
	proxy_ip: Nullable<string>;
	proxy_type: Nullable<string>;
	traffic_source: Nullable<string>;
	search_keyword: Nullable<string>;
	referrer?: Nullable<string>;
	is_bounced?: Nullable<boolean>;
	bounce_duration_ms?: Nullable<number>;
	started_at?: Nullable<string>;
	created_at?: Nullable<string>;
	expected_duration_ms?: Nullable<number>;
	google_search_attempted?: Nullable<boolean>;
	google_search_timestamp?: Nullable<string>;
};

type PerformanceMetricRow = {
	id?: string;
	session_id: string;
	load_time_ms: Nullable<number>;
	dom_ready_ms: Nullable<number>;
};

type BrightDataSerpConfigRow = {
  user_id: string;
  api_token: Nullable<string>;
  api_password: Nullable<string>;
  customer_id: Nullable<string>;
  zone_name: Nullable<string>;
  endpoint: Nullable<string>;
  port: Nullable<string>;
  enabled: Nullable<boolean>;
  use_browser_automation: Nullable<boolean>;
  browser_api_token: Nullable<string>;
  browser_zone: Nullable<string>;
  browser_customer_id: Nullable<string>;
  browser_username: Nullable<string>;
  browser_password: Nullable<string>;
  browser_endpoint: Nullable<string>;
  browser_port: Nullable<string>;
  updated_at?: Nullable<string>;
};

type SerpConfigRow = {
	id: string;
	user_id: string;
	browser_customer_id: Nullable<string>;
	browser_username: Nullable<string>;
	browser_password: Nullable<string>;
	browser_zone: Nullable<string>;
	browser_endpoint: Nullable<string>;
	browser_port: Nullable<number>;
	created_at?: Nullable<string>;
	updated_at?: Nullable<string>;
};export type Database = {
	public: {
		Tables: {
			campaigns: {
				Row: CampaignRow;
				Insert: Partial<CampaignRow>;
				Update: Partial<CampaignRow>;
			};
			user_journeys: {
				Row: UserJourneyRow;
				Insert: Partial<UserJourneyRow>;
				Update: Partial<UserJourneyRow>;
			};
			browser_plugins: {
				Row: BrowserPluginRow;
				Insert: Partial<BrowserPluginRow>;
				Update: Partial<BrowserPluginRow>;
			};
			bot_sessions: {
				Row: BotSessionRow;
				Insert: Partial<BotSessionRow>;
				Update: Partial<BotSessionRow>;
			};
			performance_metrics: {
				Row: PerformanceMetricRow;
				Insert: Partial<PerformanceMetricRow>;
				Update: Partial<PerformanceMetricRow>;
			};
			bright_data_serp_config: {
				Row: BrightDataSerpConfigRow;
				Insert: Partial<BrightDataSerpConfigRow>;
				Update: Partial<BrightDataSerpConfigRow>;
			};
			serp_configs: {
				Row: SerpConfigRow;
				Insert: Partial<SerpConfigRow>;
				Update: Partial<SerpConfigRow>;
			};
			settings: {
				Row: SettingsRow;
				Insert: Partial<SettingsRow>;
				Update: Partial<SettingsRow>;
			};
			proxy_providers: {
				Row: ProxyProviderRow;
				Insert: Partial<ProxyProviderRow>;
				Update: Partial<ProxyProviderRow>;
			};
		};
	};
};