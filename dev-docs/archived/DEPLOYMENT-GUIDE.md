# Deployment Guide — Sveltedraw to draw.hodion.com

**Target**: draw.hodion.com  
**Platform**: Vercel (recommended) or any static host  
**Build Output**: `sveltedraw-app/dist/`  
**Status**: ✅ Ready for production

---

## 🚀 Deployment Steps

### 1. Vercel Deployment (Recommended)

#### Option A: CLI Deployment
```bash
# Install Vercel CLI (if needed)
npm i -g vercel

# Deploy from project root
vercel deploy --prod --name sveltedraw

# Point to sveltedraw-app/dist as output directory
# When prompted: Configure as static site
```

#### Option B: Git Integration
```bash
# 1. Push to GitHub/GitLab
git remote add origin https://github.com/username/sveltedraw.git
git push -u origin master

# 2. Connect to Vercel via dashboard
#    - Import project
#    - Set build command: npm run build
#    - Set output directory: sveltedraw-app/dist
#    - Set install command: npm install

# 3. Add environment variables (if needed):
#    VITE_API_URL=https://draw.hodion.com
```

### 2. Alternative: Static Hosting (Netlify, AWS S3, etc.)

```bash
# Build locally
npm run build

# Output ready in: sveltedraw-app/dist/

# Upload dist/ to your hosting provider
```

### 3. Custom Domain Setup

#### For draw.hodion.com:
```
1. Go to Vercel dashboard
2. Project settings → Domains
3. Add custom domain: draw.hodion.com
4. Follow DNS instructions
5. Add SSL certificate (automatic)
```

#### DNS Records (if self-hosting):
```
Type: CNAME
Name: draw
Target: your-vercel-deployment.vercel.app
TTL: 3600
```

---

## 🏗️ Build Configuration

### Current Setup
```json
{
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "outputDirectory": "sveltedraw-app/dist",
  "nodeVersion": "18"
}
```

### Vite Config (sveltedraw-app/vite.config.ts)
- ✅ SPA mode enabled
- ✅ PWA plugin configured
- ✅ WOFF2 font caching (1 year)
- ✅ Source maps for production
- ✅ Minification enabled

---

## 📊 Build Output

### File Sizes (Production)
```
Main app:        323.85 kB (gzip: 94.23 kB)
Excalidraw core: 358.06 kB (gzip: 136.06 kB)
Font subsets:    1,823.83 kB (gzip: 738.65 kB)
Vendor:          145.74 kB (gzip: 51.95 kB)
Total (gzip):    ~1.02 MB (uncompressed: ~2.8 MB)
```

### Total Assets
- 68 precached files
- All critical assets included
- PWA offline support enabled
- Service worker generated automatically

---

## ✅ Pre-Deployment Checklist

- [x] Build succeeds (`npm run build`)
- [x] No TypeScript errors (`npm run check`)
- [x] All tests pass (30+ CDP tests)
- [x] Performance audit passed
- [x] No console errors on production build
- [x] PWA configured
- [x] Environment variables documented
- [x] CORS headers configured
- [x] Cache headers optimized
- [x] Dark mode working
- [x] All keyboard shortcuts tested
- [x] Export (PNG/SVG) working
- [x] localStorage persistence verified

---

## 🔧 Post-Deployment Verification

After deploying to draw.hodion.com:

```bash
# 1. Verify site loads
curl https://draw.hodion.com

# 2. Check service worker
curl https://draw.hodion.com/sw.js

# 3. Test PWA
#    - Open DevTools → Application → Service Workers
#    - Should show "registered and running"

# 4. Check performance
#    - Lighthouse score in Chrome DevTools
#    - Should be 90+ across all metrics

# 5. Verify features
#    - Draw elements
#    - Ctrl+Z undo
#    - Ctrl+S export
#    - Dark mode toggle
#    - Save to localStorage
```

### Expected Metrics
- **Largest Contentful Paint (LCP)**: < 2.5s
- **First Input Delay (FID)**: < 100ms
- **Cumulative Layout Shift (CLS)**: < 0.1
- **PageSpeed Score**: 90+

---

## 🌍 Custom Domain Setup for draw.hodion.com

### Step 1: DNS Configuration
Add these records to your DNS provider:

```
CNAME record:
Name: draw
Target: cname.vercel-dns.com (or your deployment URL)
TTL: 3600
```

### Step 2: Vercel Configuration
```bash
# In Vercel dashboard:
1. Project → Settings → Domains
2. Add custom domain: draw.hodion.com
3. Vercel auto-configures SSL
4. DNS propagation: 24-48 hours
```

### Step 3: Verify SSL
```bash
# After 48 hours
curl -I https://draw.hodion.com
# Should return HTTP/2 with valid certificate
```

---

## 🔄 Continuous Deployment (Optional)

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to draw.hodion.com

on:
  push:
    branches: [master]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm run build
      - uses: vercel/action@master
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          production: true
```

---

## 📈 Monitoring & Maintenance

### Uptime Monitoring
```bash
# Add uptime check to Vercel dashboard
# Monitor: https://draw.hodion.com/
# Expected response: 200 OK
```

### Performance Monitoring
```bash
# Use Vercel Analytics
# Dashboard → Settings → Analytics
# Tracks Core Web Vitals automatically
```

### Error Tracking
```bash
# Monitor console errors in production
# Use Sentry or similar service (optional)
# Environment variable: SENTRY_DSN
```

### Log Access
```bash
# Vercel provides deployment logs
# Dashboard → Deployments → Logs
# Check for errors, warnings
```

---

## 🚨 Rollback Procedure

If issues occur after deployment:

```bash
# 1. Via Vercel Dashboard
#    Deployments → Select previous version → Promote to Production

# 2. Via CLI
vercel rollback [previous-deployment-url]

# 3. Verify rollback
#    Check: https://draw.hodion.com/
```

---

## 📝 Environment Variables

### Required
None (app is self-contained)

### Optional
```env
# For future API integration
VITE_API_URL=https://api.draw.hodion.com
VITE_APP_VERSION=1.0.0
```

### Build-time
```env
# Set during deployment
NODE_ENV=production
```

---

## 🔒 Security Headers

Currently configured in `vercel.json`:

```json
{
  "Access-Control-Allow-Origin": "*",
  "X-Content-Type-Options": "nosniff",
  "Feature-Policy": "*",
  "Referrer-Policy": "origin"
}
```

### Recommended Additions
```json
{
  "X-Frame-Options": "SAMEORIGIN",
  "X-XSS-Protection": "1; mode=block",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
}
```

---

## 📞 Support & Troubleshooting

### Common Issues

**Issue**: Service worker not caching
```bash
# Check: DevTools → Application → Service Workers
# Clear site data: DevTools → Storage → Clear site data
# Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
```

**Issue**: Fonts not loading
```bash
# Check CORS headers
# Verify woff2 files in dist/
# Check browser console for CORS errors
```

**Issue**: Dark mode not persisting
```bash
# localStorage disabled?
# Check DevTools → Storage → localStorage
# Verify theme preference saved
```

---

## ✨ Post-Launch

### Day 1 Checks
- [ ] Site accessible at draw.hodion.com
- [ ] HTTPS working
- [ ] All features functional
- [ ] No 404 errors
- [ ] Service worker registered

### Week 1 Checks
- [ ] Monitor error rate (should be 0%)
- [ ] Check Core Web Vitals
- [ ] Verify PWA works offline
- [ ] Test on mobile devices
- [ ] Gather user feedback

### Ongoing
- [ ] Weekly performance review
- [ ] Monthly feature updates
- [ ] Security patch monitoring
- [ ] User issue tracking

---

## 📖 Deployment Checklist

```markdown
Pre-Deployment:
- [ ] All tests pass (npm run test)
- [ ] Build succeeds (npm run build)
- [ ] No TypeScript errors (npm run check)
- [ ] Git repository clean (git status)
- [ ] Latest changes committed

Deployment:
- [ ] Push to repository
- [ ] Trigger build in Vercel (or deploy via CLI)
- [ ] Verify build succeeds
- [ ] Check deployment logs

Post-Deployment:
- [ ] Test in production (draw.hodion.com)
- [ ] Verify all features work
- [ ] Check console for errors
- [ ] Monitor performance metrics
- [ ] Update deployment tracking

Announcement:
- [ ] Update team on completion
- [ ] Collect user feedback
- [ ] Document any issues
- [ ] Plan next iterations
```

---

**Status**: ✅ **Ready for Production**  
**Estimated Deployment Time**: 5-10 minutes  
**Estimated DNS Propagation**: 24-48 hours  
**Rollback Time**: < 1 minute  

Deploy with confidence! 🚀
