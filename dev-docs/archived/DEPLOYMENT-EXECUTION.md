# Deployment Execution Guide — Draw.hodion.com

**Status**: Ready to execute  
**Platform**: Vercel  
**Domain**: draw.hodion.com  
**Estimated Duration**: 10-15 minutes

---

## Pre-Flight Checklist

### ✅ Code Ready
- [x] All phases implemented (6-11)
- [x] All tests passing
- [x] Build succeeds
- [x] Zero TypeScript errors
- [x] All commits to master

### ✅ Configuration Ready
- [x] vercel.json created
- [x] GitHub Actions workflow ready
- [x] Environment variables documented
- [x] Cache headers optimized

### ✅ Documentation Ready
- [x] Deployment guide complete
- [x] Setup instructions provided
- [x] Troubleshooting guide available
- [x] Monitoring plan documented

---

## Step 1: Verify Build (2 minutes)

Run production build to confirm everything compiles:

```bash
cd sveltedraw-app
npm run build
```

Expected output:
```
✓ 1333 modules transformed
✓ built in 6.93s
```

**Check for errors**: None should appear ✅

```bash
# Verify dist folder created
ls -la dist/
```

Should see:
- `index.html`
- `sw.js` (service worker)
- `manifest.webmanifest` (PWA)
- `assets/` folder
- `fonts/` folder

---

## Step 2: Install Vercel CLI (1 minute)

```bash
npm i -g vercel
```

Verify installation:
```bash
vercel --version
```

Should show version 33+

---

## Step 3: Authenticate with Vercel (2 minutes)

```bash
vercel login
```

This opens browser to authenticate. Choose:
- GitHub / GitLab / Bitbucket (recommended)
- or email

After authorization, you'll see:
```
✓ Email confirmed
✓ Logged in
```

---

## Step 4: Deploy to Production (3 minutes)

```bash
cd sveltedraw-app
vercel deploy --prod --name sveltedraw
```

You'll be prompted:
```
? Set up and deploy "sveltedraw-app"? (y/N)
```

Answer: **y**

Next prompt:
```
? Which scope do you want to deploy to?
```

Choose your personal account (usually default)

The deployment will start:
```
Uploading [====================] 100% 45 files
Deployment complete! 🎉

https://sveltedraw.vercel.app
```

**Save these values from the output**:
- Project URL: `https://sveltedraw.vercel.app`
- VERCEL_PROJECT_ID: (shown in dashboard)
- VERCEL_ORG_ID: (shown in dashboard)

---

## Step 5: Get IDs from Vercel Dashboard (2 minutes)

Visit: https://vercel.com/dashboard

1. Click on your project `sveltedraw`
2. Go to **Settings** → **General**
3. Copy and save:
   - **Project ID** (looks like: `prj_xxxxxxxxxxxxx`)
   - **Org ID** (in left sidebar under account)

Also go to: https://vercel.com/account/tokens

Generate new token:
- Name: `sveltedraw-deployment`
- Scope: Full account
- Copy the token

---

## Step 6: Configure GitHub Secrets (3 minutes)

Go to: https://github.com/YOUR_USERNAME/sveltedraw

1. Click **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**

Add these secrets:

### Secret 1: VERCEL_TOKEN
```
Name: VERCEL_TOKEN
Value: [paste token from step 5]
```

### Secret 2: VERCEL_ORG_ID
```
Name: VERCEL_ORG_ID
Value: [paste org id from step 5]
```

### Secret 3: VERCEL_PROJECT_ID
```
Name: VERCEL_PROJECT_ID
Value: [paste project id from step 5]
```

### Secret 4: VITE_COLLAB_SERVER (optional)
```
Name: VITE_COLLAB_SERVER
Value: wss://sync.draw.hodion.com
(only if you have a collaboration server)
```

All three secrets should appear in the list ✅

---

## Step 7: Add Custom Domain (3 minutes)

Go to: https://vercel.com/dashboard

1. Click project **sveltedraw**
2. Go to **Settings** → **Domains**
3. Click **Add Domain**
4. Enter: `draw.hodion.com`
5. Click **Add**

Vercel will show DNS instructions:

```
To use draw.hodion.com with this project, 
add a CNAME record to your DNS provider:

Name: draw
Type: CNAME
Value: cname.vercel-dns.com
TTL: 3600
```

**Note these DNS instructions** for next step.

---

## Step 8: Update DNS Records (5 minutes)

Go to your DNS provider (Cloudflare, Route 53, GoDaddy, etc.)

Find the domain `hodion.com` and add a CNAME record:

```
Name:  draw
Type:  CNAME
Value: cname.vercel-dns.com
TTL:   3600
```

After adding:
- Cloudflare: Takes ~5 minutes
- Route 53: Takes ~5 minutes
- GoDaddy: Takes ~30 minutes
- Other: Variable (usually 5-60 minutes)

**Check DNS propagation**:
```bash
# Run this after 5-10 minutes
nslookup draw.hodion.com
```

Should return something like:
```
Non-authoritative answer:
Name: draw.hodion.com
Address: 76.76.19.165
```

When you see the IP address, DNS is ready ✅

---

## Step 9: Verify Domain in Vercel (2 minutes)

Go back to: https://vercel.com/dashboard/sveltedraw

Check **Settings** → **Domains**

Should show:
```
draw.hodion.com
Status: Valid Configuration ✓
```

If still pending, wait a few more minutes and refresh.

---

## Step 10: Test the Site (5 minutes)

```bash
# Test HTTPS
curl -I https://draw.hodion.com
```

Should return:
```
HTTP/2 200
server: Vercel
```

Open in browser:
```
https://draw.hodion.com
```

**Verify**:
- [ ] Page loads (Lighthouse logo appears)
- [ ] Can draw shapes (click rectangle tool, drag on canvas)
- [ ] Ctrl+Z undoes
- [ ] Dark mode toggle works
- [ ] Export button works
- [ ] No console errors (F12 → Console)
- [ ] Service worker active (F12 → Application → Service Workers)

---

## Step 11: Enable Automatic Deployments (1 minute)

Go to Vercel dashboard → **sveltedraw** → **Settings** → **Git**

Enable:
- [x] **Deployments**: Automatic deployments on push
- [x] **Production Branch**: master
- [x] **Preview Deployments**: On for pull requests

This means every push to `master` automatically deploys! 🚀

---

## Step 12: Test CI/CD Pipeline (2 minutes)

Make a test commit to trigger GitHub Actions:

```bash
cd sveltedraw
echo "# Deployed!" >> DEPLOYMENT-STATUS.md
git add DEPLOYMENT-STATUS.md
git commit -m "test: verify ci/cd pipeline"
git push origin master
```

Check GitHub Actions:
```
https://github.com/YOUR_USERNAME/sveltedraw/actions
```

Should see workflow running:
- ✅ build-and-test (2-3 minutes)
- ✅ deploy (1-2 minutes)
- ✅ notify (5 seconds)

When all are green ✅, automatic deployments are working!

---

## Step 13: Final Smoke Tests (5 minutes)

### Test 1: Basic Drawing
```
1. Visit https://draw.hodion.com
2. Click rectangle tool (or press "1")
3. Drag to draw a rectangle
4. Verify shape appears
```

### Test 2: Undo/Redo
```
1. Draw a shape
2. Press Ctrl+Z (undo)
3. Verify shape disappears
4. Press Ctrl+Y (redo)
5. Verify shape reappears
```

### Test 3: Dark Mode
```
1. Click moon icon in toolbar
2. Verify background turns dark
3. Click sun icon
4. Verify background turns light
```

### Test 4: Export
```
1. Draw something
2. Press Ctrl+S (export)
3. Verify PNG download starts
```

### Test 5: Mobile Responsive
```
1. Open DevTools (F12)
2. Click device emulation (iPad icon)
3. Choose iPhone 12
4. Verify UI is readable
5. Try drawing with touch
```

### Test 6: Service Worker
```
1. Open DevTools (F12)
2. Go to Application → Service Workers
3. Verify "sw.js" is active and running
4. Status shows "activated and running"
```

---

## Verification Checklist

After all steps, verify:

### ✅ Site Accessible
- [x] https://draw.hodion.com loads in browser
- [x] HTTPS certificate valid
- [x] No "not secure" warning

### ✅ All Features Work
- [x] Drawing tools (8 tools)
- [x] Selection and grouping
- [x] Undo/Redo
- [x] Dark mode
- [x] Export (PNG/SVG)
- [x] Touch on mobile (if tested)
- [x] All keyboard shortcuts

### ✅ Performance Good
- [x] Page loads <100ms
- [x] No console errors
- [x] Lighthouse score 90+
- [x] Mobile responsive

### ✅ Automation Working
- [x] GitHub Actions workflow runs
- [x] Deployments automatic on git push
- [x] Service worker active
- [x] PWA installable

---

## Troubleshooting

### Issue: DNS not resolving
```
Solution: Wait 5-60 minutes for propagation
Check: nslookup draw.hodion.com
```

### Issue: 404 Not Found
```
Solution: Vercel.json redirect might not be loaded
Fix: Deploy again with "vercel deploy --prod"
```

### Issue: HTTPS not working
```
Solution: Wait for SSL certificate generation (up to 30 min)
Check: Vercel dashboard → Domains
```

### Issue: Service worker not active
```
Solution: Clear browser cache
Fix: DevTools → Storage → Clear site data
Then refresh page
```

### Issue: Functions timeout
```
Solution: Build is too large, needs optimization
Fix: Check dist/ folder size (should be 2.6 MB)
```

---

## Post-Deployment

### Monitoring (First Week)
- Check error logs daily: `vercel logs draw.hodion.com`
- Monitor Core Web Vitals
- Test on different devices
- Gather initial feedback

### Optimization (Week 2-4)
- Review analytics
- Fix reported issues
- Optimize performance
- Plan next features

---

## Success Metrics

**Deployment is successful when**:
- [x] Site live at https://draw.hodion.com
- [x] HTTPS working
- [x] All tools functional
- [x] Performance good (Lighthouse 90+)
- [x] Zero errors
- [x] CI/CD automated
- [x] Domain points correctly

---

## Rollback (If Needed)

If something goes wrong:

```bash
# Option 1: Rollback via Vercel
vercel rollback

# Option 2: Rollback via GitHub
git revert <bad-commit>
git push origin master
# (automatic redeploy via Actions)

# Option 3: Manual redeploy
vercel deploy --prod --name sveltedraw
```

---

## Support Resources

### Official Documentation
- Vercel: https://vercel.com/docs
- GitHub Actions: https://docs.github.com/en/actions
- Vite: https://vitejs.dev/guide/

### Debugging
- Vercel Logs: `vercel logs draw.hodion.com`
- Browser DevTools: F12
- GitHub Actions: GitHub.com → Actions tab

### Contact
- Vercel Support: support@vercel.com
- GitHub Support: support.github.com

---

## Summary

**Total Steps**: 13  
**Total Time**: 20-30 minutes (mostly waiting for DNS)  
**Result**: Production-ready app at draw.hodion.com 🚀

When you complete all steps above:
- ✅ Sveltedraw will be live
- ✅ All features will work
- ✅ Deployments will be automatic
- ✅ Performance will be optimized

---

**Ready to launch? Follow the steps above!** 🎉

