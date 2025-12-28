# Deploying Neon Threads to Render

This guide will help you deploy both the backend server and frontend client to Render.

## Overview

You'll need to deploy:
1. **Backend Service** - Node.js/Express API server
2. **Frontend Static Site** - React build

## Prerequisites

- GitHub repository pushed (✅ Done: https://github.com/azimoto99/neonthreads)
- Render account (sign up at https://render.com)

---

## Step 1: Deploy Backend Service

### 1.1 Create New Web Service

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository: `azimoto99/neonthreads`
4. Configure the service:

**Basic Settings:**
- **Name:** `neon-threads-api` (or your preferred name)
- **Region:** Choose closest to you
- **Branch:** `main`
- **Root Directory:** `server`
- **Runtime:** `Node`
- **Build Command:** `npm install --legacy-peer-deps && npm run build`
- **Start Command:** `npm start`

### 1.2 Environment Variables

Add these environment variables in Render dashboard:

```
NODE_ENV=production
PORT=10000
OPENROUTER_API_KEY=your_openrouter_api_key_here
REPLICATE_API_TOKEN=your_replicate_api_token_here
APP_URL=https://your-frontend-url.onrender.com
DATABASE_PATH=/opt/render/project/src/neon_threads.db
```

**Important:**
- Replace `your_openrouter_api_key_here` with your actual OpenRouter API key
- Replace `your-frontend-url.onrender.com` with your actual frontend URL (you'll get this after deploying the frontend)
- Render provides `PORT` automatically, but you can set it to `10000` or use the provided `PORT` env var

### 1.3 Advanced Settings

- **Auto-Deploy:** `Yes` (deploys on every push to main)
- **Health Check Path:** `/api/health` (optional - you may need to add this endpoint)

### 1.4 Deploy

Click **"Create Web Service"** and wait for deployment.

**Note the URL:** You'll get something like `https://neon-threads-api.onrender.com`

---

## Step 2: Deploy Frontend Static Site

### 2.1 Create New Static Site

1. In Render Dashboard, click **"New +"** → **"Static Site"**
2. Connect your GitHub repository: `azimoto99/neonthreads`
3. Configure:

**Basic Settings:**
- **Name:** `neon-threads-client` (or your preferred name)
- **Branch:** `main`
- **Root Directory:** `client`
- **Build Command:** `npm install --legacy-peer-deps && npm run build`
- **Publish Directory:** `build`

### 2.2 Environment Variables

Add this environment variable:

```
REACT_APP_API_URL=https://your-backend-url.onrender.com/api
```

**Important:** Replace `your-backend-url.onrender.com` with your actual backend URL from Step 1.

### 2.3 Deploy

Click **"Create Static Site"** and wait for deployment.

**Note the URL:** You'll get something like `https://neon-threads-client.onrender.com`

---

## Step 3: Update Backend URL

After deploying the frontend, you need to update the backend's `APP_URL`:

1. Go back to your **Backend Web Service** settings
2. Update the environment variable:
   ```
   APP_URL=https://your-frontend-url.onrender.com
   ```
3. Save and redeploy (or it will auto-redeploy)

---

## Step 4: Database Considerations

### Option A: SQLite (Simple, but data resets on redeploy)

The current setup uses SQLite. On Render:
- Database file is stored in the service's filesystem
- **Data will be lost** if the service is stopped or redeployed
- Good for development/testing

### Option B: PostgreSQL (Recommended for production)

For persistent data, use Render's PostgreSQL:

1. Create a **PostgreSQL** database in Render
2. Update your database connection code to use PostgreSQL instead of SQLite
3. This requires code changes (not covered in this guide)

**For now, SQLite will work but data won't persist across redeploys.**

---

## Step 5: Verify Deployment

1. **Backend Health Check:**
   - Visit: `https://your-backend-url.onrender.com/api/characters`
   - Should return JSON (may be empty array, that's OK)

2. **Frontend:**
   - Visit: `https://your-frontend-url.onrender.com`
   - Should load the game interface

3. **Test the Game:**
   - Create a character
   - Generate a story
   - Check if images generate (requires API credits)

---

## Troubleshooting

### Backend Issues

**Build Fails:**
- Check build logs in Render dashboard
- Ensure all dependencies are in `package.json`
- Check that `npm run build` works locally

**Service Crashes:**
- Check logs in Render dashboard
- Verify all environment variables are set
- Check that `npm start` works locally

**Database Errors:**
- SQLite file path might need adjustment
- Check file permissions in Render

### Frontend Issues

**Build Fails:**
- Check build logs
- Ensure `REACT_APP_API_URL` is set correctly
- Verify React build works locally: `cd client && npm run build`

**API Calls Fail:**
- Check browser console for CORS errors
- Verify `REACT_APP_API_URL` points to correct backend
- Check backend CORS settings allow your frontend domain

**Images Don't Load:**
- Check Replicate API token is set
- Verify API credits are available
- Check backend logs for image generation errors

---

## Environment Variables Summary

### Backend (.env equivalent in Render)
```
NODE_ENV=production
PORT=10000
OPENROUTER_API_KEY=sk-or-your-key
REPLICATE_API_TOKEN=r8_your-token
APP_URL=https://your-frontend.onrender.com
DATABASE_PATH=/opt/render/project/src/neon_threads.db
```

### Frontend (Environment Variables in Render)
```
REACT_APP_API_URL=https://your-backend.onrender.com/api
```

---

## Cost Considerations

**Free Tier Limits:**
- Services spin down after 15 minutes of inactivity
- First request after spin-down takes ~30 seconds (cold start)
- 750 hours/month free

**Paid Plans:**
- Always-on services
- Faster response times
- More resources

---

## Next Steps

1. ✅ Deploy backend service
2. ✅ Deploy frontend static site
3. ✅ Update environment variables
4. ✅ Test the application
5. (Optional) Set up PostgreSQL for persistent data
6. (Optional) Add custom domain
7. (Optional) Set up monitoring/logging

---

## Support

- Render Docs: https://render.com/docs
- Render Community: https://community.render.com/

