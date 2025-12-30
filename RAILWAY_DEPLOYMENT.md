# Railway Deployment Guide - SLP Assessment Platform

## Quick Start (5 Steps)

### Step 1: Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Connect your GitHub account

### Step 2: Create New Project
1. Click "Create New Project"
2. Select "Deploy from GitHub"
3. Choose `slp-assessment-frontend` repository
4. Click "Import Repository"

### Step 3: Add PostgreSQL Database
1. In your Railway project, click "+ Add Service"
2. Search and click "PostgreSQL"
3. Wait 1-2 minutes for initialization
4. Click on PostgreSQL service
5. Go to "Variables" tab
6. **Copy these values** - you'll need them:
   - `DATABASE_URL` (full connection string)
   - `PGHOST`
   - `PGPORT`
   - `PGUSER`
   - `PGPASSWORD`

### Step 4: Deploy Express Backend
1. Click "+ Add Service"
2. Select "GitHub Repo"
3. Choose `slp-assessment-frontend`
4. Set **Root Directory**: `backend-express`
5. Click "Add Service"
6. Once added, click on the service
7. Go to "Variables" tab
8. Add these environment variables:

```
NODE_ENV=production
PORT=3001
DB_HOST=${{ PostgreSQL.PGHOST }}
DB_PORT=${{ PostgreSQL.PGPORT }}
DB_NAME=${{ PostgreSQL.PGDATABASE }}
DB_USER=${{ PostgreSQL.PGUSER }}
DB_PASSWORD=${{ PostgreSQL.PGPASSWORD }}
PYTHON_API_URL=https://your-python-service-name.up.railway.app
CORS_ORIGIN=https://your-frontend-service-name.up.railway.app
JWT_SECRET=generate-random-string-here
```

9. Go to "Settings" tab
10. Set **Start Command**: `node server.js`
11. Wait for deployment (3-5 minutes)
12. Go to "Settings" → Copy your **Railway Domain** (e.g., `https://slp-express.up.railway.app`)

### Step 5: Deploy Python Backend
1. Click "+ Add Service"
2. Select "GitHub Repo"
3. Choose `slp-assessment-frontend`
4. Set **Root Directory**: `backend`
5. Click "Add Service"
6. Once added, click on the service
7. Go to "Variables" tab
8. Add these environment variables:

```
ENVIRONMENT=production
PORT=8000
DATABASE_URL=${{ PostgreSQL.DATABASE_URL }}
CORS_ORIGINS=https://your-frontend-service.up.railway.app,https://your-express-service.up.railway.app
```

9. Go to "Settings" tab
10. Set **Start Command**: `python app.py`
11. Wait for deployment (5-7 minutes)
12. Go to "Settings" → Copy your **Railway Domain** (e.g., `https://slp-python.up.railway.app`)

### Step 6: Deploy React Frontend
1. Click "+ Add Service"
2. Select "GitHub Repo"
3. Choose `slp-assessment-frontend`
4. Set **Root Directory**: `.` (root directory)
5. Click "Add Service"
6. Once added, click on the service
7. Go to "Variables" tab
8. Add these environment variables:

```
VITE_API_URL=https://your-express-service.up.railway.app
NODE_ENV=production
```

9. Go to "Settings" tab
10. Set **Build Command**: `npm install && npm run build`
11. Set **Start Command**: `npm install -g serve && serve -s dist -l 3000`
12. Wait for deployment (3-5 minutes)
13. Go to "Settings" → Copy your **Railway Domain**

### Step 7: Test Your Deployment
1. Open the frontend Railway Domain in your browser
2. Test login and navigation
3. Create a patient to verify database connectivity
4. Upload audio to test backend communication

---

## Environment Variables Summary

### PostgreSQL (Auto-provided by Railway)
- `PGHOST`
- `PGPORT`
- `PGUSER`
- `PGPASSWORD`
- `PGDATABASE`
- `DATABASE_URL`

### Express Backend
```
NODE_ENV=production
PORT=3001
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
PYTHON_API_URL
CORS_ORIGIN
JWT_SECRET
```

### Python Backend
```
ENVIRONMENT=production
PORT=8000
DATABASE_URL
CORS_ORIGINS
```

### Frontend
```
VITE_API_URL
NODE_ENV=production
```

---

## Cost Estimate
- **Free Tier**: $5/month free credits
- **Typical Monthly Cost**: $15-30
  - PostgreSQL: $5-10
  - Express Backend: $5
  - Python Backend: $5
  - Frontend: $5

---

## Troubleshooting

### Service Won't Deploy
- Check "Logs" tab in Railway console
- Verify environment variables are set
- Ensure Procfile exists in service root directory

### CORS Errors
- Verify CORS_ORIGIN/CORS_ORIGINS match exactly
- Update in all backend services
- Restart services after changes

### Database Connection Failed
- Verify DATABASE_URL is correct
- Check PostgreSQL service is running
- Confirm credentials match

### 502 Bad Gateway
- Service crashed - check logs
- Missing environment variables
- Port configuration issue

---

## After Deployment

1. ✅ Test all features work
2. ✅ Monitor logs for errors
3. ✅ Set up custom domain (optional)
4. ✅ Configure backups for database

---

## Need Help?
- Railway Docs: https://docs.railway.app
- Check service logs in Railway dashboard
- Verify all environment variables are set correctly

**You're ready to deploy!** 🚀
