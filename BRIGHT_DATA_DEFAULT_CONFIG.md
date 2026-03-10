# Bright Data Default Configuration

**Date:** March 9, 2026  
**Status:** ✅ Active and Working

---

## Current Configuration

All campaigns have been updated to use **Bright Data ISP zone** exclusively. Luna proxy has been completely replaced.

### Working Proxy Settings

```
Provider:  Bright Data
Host:      brd.superproxy.io
Port:      33335
Username:  brd-customer-hl_a908b07a-zone-isp
Password:  mihmos3ifhay
Zone:      ISP (hl_a908b07a)
```

### Static IP Configuration

- **NAT Gateway:** nat-042bc4ce3dac362cf
- **Elastic IP:** 52.0.92.53
- **Status:** Whitelisted on Bright Data account

---

## Campaign Update Summary

**Total Campaigns Updated:** 18

### Port Configuration
- ✅ Port 33335 (WORKING): **18 campaigns** (100%)
- ❌ Port 12233 (FAILING): **0 campaigns** (0%)

### Password Configuration
- ✅ New password (mihmos3ifhay): **18 campaigns** (100%)
- ❌ Old password (q2r3q6ffofme): **0 campaigns** (0%)

### Campaign Status
- Completed: 15
- Draft: 1
- Paused: 2

---

## Why Sessions Were Timing Out

### Root Cause
1. **Port 12233 with old password was timing out** after 30-40 seconds
2. Bright Data likely:
   - Changed proxy authentication requirements
   - Updated port configuration
   - Modified IP whitelisting rules

### Proof
- **Failed:** `curl` to port 12233 → timeout
- **Succeeded:** `curl` to port 33335 → HTTP 200 with proxy details
- **ALB Test:** Sessions using port 33335 navigated successfully

---

## Server Code Status

### Files Updated
- **server.cjs** (deployed to both ALB instances)
  - Lines 1588-1606: Bright Data geo-targeting fix (`-country-US` format)
  - Lines 2538-2552: Provider-aware proxy authentication

### Deployment
- ✅ Instance i-01b53f76120d7a1f3 (172.31.87.235)
- ✅ Instance i-0828ae6e2e68ceb7a (172.31.12.140)
- ✅ ALB traffic-tool-alb routing correctly

---

## Luna Proxy Removal

Luna proxy is **no longer used** but the code still supports it for backward compatibility:

```javascript
const isLunaProxy = proxyUsername.includes('admin_') || proxyUsername.includes('lunaproxy');
if (isLunaProxy) {
  authUsername = `${authUsername}-region-${geoCode.toLowerCase()}`;
} else {
  authUsername = `${authUsername}-country-${geoCode}`;
}
```

If Luna is never used again, this detection logic can remain for safety.

---

## Expected Behavior Now

### ✅ Sessions Will
- Navigate successfully to target sites
- Complete without `net::ERR_TIMED_OUT` errors
- Set `target_site_reached = true`
- Appear in Google Analytics with proper referrer tracking
- Use residential IPs from Bright Data ISP zone

### 📊 Monitoring
Check session success rate:
```sql
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN target_site_reached THEN 1 ELSE 0 END) as reached,
  ROUND(100.0 * SUM(CASE WHEN target_site_reached THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM bot_sessions
WHERE created_at > NOW() - INTERVAL '1 hour';
```

---

## Infrastructure

### Load Balancer
- **ALB:** traffic-tool-alb-681297197.us-east-1.elb.amazonaws.com:3000
- **Target Group:** traffic-tool-tg
- **Health:** Both instances healthy

### EC2 Instances
- **i-01b53f76120d7a1f3** (Private: 172.31.87.235)
- **i-0828ae6e2e68ceb7a** (Public: 3.214.144.158, Private: 172.31.12.140)

### Network
- **VPC:** Default VPC (us-east-1)
- **NAT Gateway:** Provides static IP for all outbound traffic
- **Security:** IP 52.0.92.53 whitelisted on Bright Data

---

## Next Steps

1. **Monitor first 100 sessions** after this update
2. **Verify Google Analytics** shows traffic within 24-48 hours
3. **Check session_logs** for successful navigation
4. **Consider removing Luna fallback code** if never used again

---

## Troubleshooting

### If Sessions Still Timeout

1. Verify Bright Data credentials haven't changed
2. Check NAT Gateway is routing correctly: `curl ifconfig.me` from instances
3. Confirm IP 52.0.92.53 still whitelisted on Bright Data dashboard
4. Test proxy directly: 
   ```bash
   curl -i --proxy brd.superproxy.io:33335 \
     --proxy-user brd-customer-hl_a908b07a-zone-isp:mihmos3ifhay \
     https://lumtest.com/myip.json
   ```

### If Google Analytics Shows Zero Traffic

1. Check `target_site_reached` in bot_sessions table
2. Verify GA4 tracking code on target site
3. Confirm sessions spending enough time on page (30+ seconds)
4. Check referrer is being set correctly in navigation

---

**Last Updated:** March 9, 2026  
**Configuration Verified:** ✅  
**All Systems Operational:** ✅
