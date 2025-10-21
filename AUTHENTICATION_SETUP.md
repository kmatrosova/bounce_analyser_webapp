# Google Authentication Setup Guide

## ✅ What's Been Done

NextAuth.js with Google Sign-In has been installed and configured:
- ✅ NextAuth API route created
- ✅ Authentication provider configured
- ✅ Sign-in and error pages created
- ✅ Main page protected with auth check
- ✅ Sign-out button added to header

## 🔧 Next Steps

### Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console - APIs & Credentials](https://console.cloud.google.com/apis/credentials?project=gtgt-bounceanalyser)

2. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**

3. If prompted to configure consent screen:
   - Click "CONFIGURE CONSENT SCREEN"
   - Select **"Internal"** (for GetGrowth users only)
   - Fill in:
     - App name: `Bounce Analyzer`
     - User support email: `tina@getgrowth.fr`
     - Developer contact: `tina@getgrowth.fr`
   - Click **Save and Continue** through all steps

4. Back to Create OAuth Client ID:
   - Application type: **"Web application"**
   - Name: `Bounce Analyzer Web Client`
   - Authorized redirect URIs, add:
     ```
     http://localhost:3000/api/auth/callback/google
     https://bounce-webapp-frontend-5bkgdumapa-ew.a.run.app/api/auth/callback/google
     ```
   - Click **CREATE**

5. **Copy the Client ID and Client Secret** - you'll need them next!

### Step 2: Create Environment Variables File

In `/Users/tina/Documents/GetGrowth/bounce_analyser_webapp/app/frontend/`, create a file named `.env.local`:

```bash
# NextAuth.js Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# Google OAuth Credentials (from Step 1)
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
```

**Generate a secure secret:**
```bash
cd /Users/tina/Documents/GetGrowth/bounce_analyser_webapp/app/frontend
echo "NEXTAUTH_URL=http://localhost:3000" > .env.local
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)" >> .env.local
echo "GOOGLE_CLIENT_ID=your-client-id-here" >> .env.local
echo "GOOGLE_CLIENT_SECRET=your-client-secret-here" >> .env.local
```

**Important:** Replace `your-client-id-here` and `your-client-secret-here` with your actual credentials from Step 1!

### Step 3: Add Allowed Users

Edit `/Users/tina/Documents/GetGrowth/bounce_analyser_webapp/app/frontend/src/app/api/auth/[...nextauth]/route.ts`

Add your colleague's email to the `ALLOWED_USERS` array:
```typescript
const ALLOWED_USERS = [
  "tina@getgrowth.fr",
  "colleague@company.com",  // Add your colleague's email here
];
```

### Step 4: Test Locally

```bash
cd /Users/tina/Documents/GetGrowth/bounce_analyser_webapp/app/frontend
npm run dev
```

Open http://localhost:3000 - you should see the Google Sign-In page!

### Step 5: Deploy to Cloud Run

#### 5a: Update Dockerfile to include env vars

The Dockerfile needs to accept build-time environment variables. Update `/Users/tina/Documents/GetGrowth/bounce_analyser_webapp/Dockerfile.frontend`:

Add these to the builder stage:
```dockerfile
# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ARG NEXTAUTH_URL
ARG NEXTAUTH_SECRET
ARG GOOGLE_CLIENT_ID
ARG GOOGLE_CLIENT_SECRET
```

#### 5b: Update Cloud Run Terraform

Add environment variables to `/Users/tina/Documents/GetGrowth/infrastructure/bounce_analyser/cloud_run.tf` in the `webapp_frontend` resource:

```hcl
env {
  name  = "NEXTAUTH_URL"
  value = google_cloud_run_v2_service.webapp_frontend.uri
}

env {
  name  = "NEXTAUTH_SECRET"
  value = var.nextauth_secret
}

env {
  name  = "GOOGLE_CLIENT_ID"
  value = var.google_client_id
}

env {
  name  = "GOOGLE_CLIENT_SECRET"
  value = var.google_client_secret
}
```

#### 5c: Add variables to terraform.tfvars

```hcl
# Authentication (add to terraform.tfvars)
nextauth_secret      = "your-generated-secret-from-step-2"
google_client_id     = "your-client-id.apps.googleusercontent.com"
google_client_secret = "your-client-secret"
```

#### 5d: Rebuild and deploy

```bash
# Rebuild Docker image
cd /Users/tina/Documents/GetGrowth
docker build --platform linux/amd64 \\
  -f bounce_analyser_webapp/Dockerfile.frontend \\
  -t europe-west1-docker.pkg.dev/gtgt-bounceanalyser/bounce-analyser/bounce-webapp-frontend:latest \\
  .

# Push to registry
docker push europe-west1-docker.pkg.dev/gtgt-bounceanalyser/bounce-analyser/bounce-webapp-frontend:latest

# Deploy with Terraform
cd infrastructure/bounce_analyser
terraform apply
```

### Step 6: Enable Public Access (Cloud Console)

1. Go to [Cloud Run Console](https://console.cloud.google.com/run?project=gtgt-bounceanalyser)
2. Click **"bounce-webapp-frontend"**
3. Click **"SECURITY"** tab
4. Under **"Authentication"**, select **"Allow unauthenticated invocations"**
5. Click **"SAVE"**
6. Repeat for **"bounce-webapp-backend"**

### Step 7: Share with Your Colleague

Send them the Cloud Run URL:
```
https://bounce-webapp-frontend-5bkgdumapa-ew.a.run.app
```

They'll see a Google Sign-In page → Sign in → Access the app! ✅

## 🔒 Security Summary

- ✅ Cloud Run is public (anyone can reach the URL)
- ✅ App requires Google Sign-In (only authorized emails can use it)
- ✅ Only emails in `ALLOWED_USERS` array can access
- ✅ Fully secure for internal team use

## 🎯 To Add More Users Later

1. Edit `/Users/tina/Documents/GetGrowth/bounce_analyser_webapp/app/frontend/src/app/api/auth/[...nextauth]/route.ts`
2. Add email to `ALLOWED_USERS` array
3. Rebuild and redeploy Docker image
4. Done!

