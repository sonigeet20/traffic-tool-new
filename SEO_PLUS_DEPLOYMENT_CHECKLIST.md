# SEO+ Deployment Checklist

## Pre-Deployment (Development)

### ✓ Code Quality
- [x] Server.cjs compiles without errors
- [x] SEO browser engine module complete
- [x] Backend endpoints have error handling
- [x] Edge function has proper error responses
- [x] Frontend pages structure complete
- [x] No console.error in production build
- [ ] Run `npm run lint` in seo/ directory
- [ ] Run type checking: `npm run type-check` in seo/

### ✓ Testing
- [ ] Test direct traffic fix with small target
  - Expected: Session completed with metrics
- [ ] Test direct traffic fix with large target
  - Expected: No timeouts, proper error messages
- [ ] Test backend /api/seo/health endpoint
  - Expected: Returns JSON with endpoints list
- [ ] Test backend /api/seo/crawl-rankings with test data
  - Expected: Returns rankings with position numbers
- [ ] Test backend /api/seo/click-session endpoint
  - Expected: Session records created
- [ ] Test frontend login/logout flow
  - Expected: Redirects to dashboard after login
- [ ] Test frontend page navigation
  - Expected: No 404 errors, all pages render

---

## Phase 1: Database Deployment

### Database Migration
- [ ] Open Supabase Dashboard
- [ ] Go to SQL Editor
- [ ] Create new query
- [ ] Paste contents of: `supabase/migrations/20260227_seo_plus_schema.sql`
- [ ] Execute and verify no errors
- [ ] Check tables were created:
  ```sql
  SELECT tablename FROM pg_tables 
  WHERE schemaname = 'public' 
  AND tablename LIKE 'seo_%' 
  ORDER BY tablename;
  ```
  Expected tables:
  - seo_campaigns
  - seo_click_sessions
  - seo_competitor_tracking
  - seo_keywords
  - seo_projects
  - seo_rank_alerts
  - seo_rank_history
  - seo_rank_snapshots

### Verify RLS Policies
- [ ] Each table has RLS enabled
- [ ] Policies filter by auth.uid()
- [ ] Test with sample INSERT (should be restricted)

---

## Phase 2: Backend Deployment

### Update AWS Server
- [ ] SSH into EC2 instance
- [ ] Pull latest code: `git pull origin main`
- [ ] Verify server.cjs has SEO+ endpoints
- [ ] Search for "POST /api/seo/crawl-rankings" (should exist)
- [ ] Verify seo-browser-engine.cjs is in root directory

### Verify Backend
- [ ] Restart server.js/server.cjs
- [ ] Test health endpoint:
  ```bash
  curl http://BACKEND_URL:3000/api/seo/health
  ```
- [ ] Should return JSON with features list
- [ ] Check server logs for errors

### Test Endpoints
- [ ] Test /api/seo/crawl-rankings with test data
  - Provide: project ID, keywords, Browser API creds
  - Verify: Returns rankings array
- [ ] Test /api/seo/click-session
  - Provide: campaign ID, keyword, target URL
  - Verify: Returns success response

---

## Phase 3: Edge Function Deployment

### Deploy to Supabase
- [ ] Ensure Supabase CLI installed
- [ ] Deploy function:
  ```bash
  supabase functions deploy seo-rank-crawler
  ```
- [ ] Verify deployment succeeded
- [ ] Check Supabase dashboard for function

### Configure Environment
- [ ] Set function environment variable:
  - Key: BACKEND_URL
  - Value: http://traffic-tool-alb-681297197.us-east-1.elb.amazonaws.com:3000
- [ ] Verify function can reach backend (test via dashboard)

### Test Function
- [ ] Go to Edge Functions in Supabase
- [ ] Click seo-rank-crawler
- [ ] Click "Invocation" tab
- [ ] Call function manually
- [ ] Should return success response
- [ ] Check Supabase logs for no errors

### Schedule Cron Job (Optional)
- [ ] To run daily at 8am UTC:
  ```sql
  SELECT cron.schedule(
    'seo-rank-crawler',
    '0 8 * * *',
    $$SELECT net.http_post(
      url := 'https://YOUR_PROJECT.supabase.co/functions/v1/seo-rank-crawler',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
      )
    )$$
  );
  ```
- [ ] Verify cron job created

---

## Phase 4: Frontend Deployment

### Build Frontend
- [ ] Navigate to seo/ directory
- [ ] Install dependencies: `npm install`
- [ ] Run linter: `npm run lint`
  - Fix any errors
- [ ] Build: `npm run build`
- [ ] Verify dist/seo/ directory created
- [ ] Check build size is reasonable (~200-300KB)

### Update Vercel Configuration
- [ ] Create vercel.json in root (if not exists):
  ```json
  {
    "buildCommand": "npm run build && cd seo && npm install && npm run build",
    "outputDirectory": "dist"
  }
  ```
- [ ] Push to GitHub
- [ ] Vercel should auto-detect and deploy

### Test Frontend on Vercel
- [ ] Visit https://YOUR_VERCEL_URL/seo/
- [ ] Verify page loads (not blank)
- [ ] Check browser console for no errors
- [ ] Test login flow (if auth set up)

---

## Phase 5: Staging Integration Tests

### Create Test Project
```sql
INSERT INTO seo_projects (user_id, name, website_url, target_country) VALUES
('YOUR_USER_ID', 'Test Project', 'https://example.com', 'US');
```

### Add Test Keywords
```sql
INSERT INTO seo_keywords (project_id, user_id, keyword, tier, priority) VALUES
('PROJECT_ID', 'USER_ID', 'test keyword 1', 'tier1', 10),
('PROJECT_ID', 'USER_ID', 'test keyword 2', 'tier2', 5);
```

### Test Ranking Crawl
- [ ] Call POST /api/seo/crawl-rankings with test project
- [ ] Verify seo_rank_snapshots created
- [ ] Verify seo_keywords.current_rank updated
- [ ] Check session logs

### Test Click Session
- [ ] Create seo_campaign with credentials
- [ ] Call POST /api/seo/click-session
- [ ] Verify seo_click_sessions created
- [ ] Verify campaign.total_clicks_delivered incremented

### Test Frontend
- [ ] Login to frontend
- [ ] Navigate to all pages
- [ ] Verify no 404 errors
- [ ] Check dashboard loads project data

---

## Phase 6: Production Readiness

### Security
- [ ] No hardcoded credentials in code
- [ ] RLS policies verified on all tables
- [ ] Browser API password never logged
- [ ] Environment variables used for secrets
- [ ] API endpoints require authentication (if applicable)

### Monitoring
- [ ] Set up error logging for edge function
- [ ] Set up monitoring for backend /api/seo endpoints
- [ ] Monitor database for slow queries
- [ ] Check CloudWatch logs on AWS

### Backup
- [ ] Verify Supabase automated backups enabled
- [ ] Test recovery procedure
- [ ] Document backup retention policy

### Documentation
- [ ] SEO_PLUS_QUICK_START.md reviewed
- [ ] SEO_PLUS_IMPLEMENTATION_COMPLETE.md updated
- [ ] API documentation updated
- [ ] Runbook created for common issues

---

## Phase 7: Production Deployment

### Final Checks
- [ ] All staging tests passed
- [ ] No open bugs or issues
- [ ] Performance benchmarks acceptable
- [ ] Team approved for launch

### Go Live
- [ ] Deploy to production
- [ ] Monitor system for 1 hour
- [ ] Set up automated crawl schedule
- [ ] Notify users of new features

### Post-Launch
- [ ] Monitor error rates
- [ ] Track performance metrics
- [ ] Gather user feedback
- [ ] Plan next improvements

---

## Rollback Plan

### If Issues Occur
1. **Database:** Restore from backup
   ```sql
   -- To rollback schema:
   DROP TABLE IF EXISTS seo_rank_snapshots CASCADE;
   DROP TABLE IF EXISTS seo_click_sessions CASCADE;
   -- etc.
   ```

2. **Backend:** Revert to previous server.cjs
   ```bash
   git revert HEAD
   git push origin main
   ```

3. **Frontend:** Rollback Vercel deployment
   - Go to Vercel dashboard
   - Click "Deployments"
   - Revert to previous deployment

4. **Edge Function:** Redeploy previous version
   ```bash
   supabase functions deploy seo-rank-crawler --version=previous
   ```

---

## Common Issues & Solutions

### Issue: Edge function timeout
**Solution:** 
- Increase function timeout in Supabase
- Check backend connectivity
- Verify no blocking operations

### Issue: Sessions not completing
**Solution:**
- Check bot_sessions.error_message for details
- Verify Browser API credentials
- Check ALB health

### Issue: Frontend showing blank page
**Solution:**
- Check browser console for errors
- Verify Supabase credentials in .env
- Ensure build completed successfully

### Issue: Ranking snapshots not created
**Solution:**
- Verify edge function was invoked
- Check Supabase function logs
- Confirm backend returned rankings

---

## Success Criteria

✅ All tests pass  
✅ No errors in production logs  
✅ Sessions complete with accurate metrics  
✅ Rankings crawled on schedule  
✅ Frontend loads without errors  
✅ Click campaigns execute successfully  
✅ Team is satisfied with system  

---

**Status:** Ready for Deployment  
**Estimated Deploy Time:** 30-45 minutes  
**Rollback Time:** 10-15 minutes  

Good luck with deployment! 🚀
