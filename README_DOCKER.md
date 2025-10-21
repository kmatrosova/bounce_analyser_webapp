# Docker Deployment Guide

## 📦 Prerequisites

- Docker installed
- Docker Compose installed
- Google Cloud credentials (for backend)
- OpenAI API key (for GPT labeling)

## 🏗️ Build Images

### Option 1: Using the build script (Recommended)

```bash
cd /Users/tina/Documents/GetGrowth
./bounce_analyser_webapp/build.sh
```

### Option 2: Manual build

**Backend:**
```bash
cd /Users/tina/Documents/GetGrowth
docker build -f bounce_analyser_webapp/Dockerfile.backend -t bounce-analyser-backend:latest .
```

**Frontend:**
```bash
cd /Users/tina/Documents/GetGrowth
docker build -f bounce_analyser_webapp/Dockerfile.frontend -t bounce-analyser-frontend:latest bounce_analyser_webapp/app/frontend
```

## 🚀 Run Locally with Docker Compose

### 1. Set up environment variables

```bash
cd bounce_analyser_webapp/app/backend
cp .env.example .env
# Edit .env with your actual values
```

### 2. Start services

```bash
cd bounce_analyser_webapp
docker-compose up
```

### 3. Access the application

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:8000
- **Backend Docs**: http://localhost:8000/docs

### 4. Stop services

```bash
docker-compose down
```

## 🌐 Deploy to Cloud Run

See the Terraform configuration in `/infrastructure/bounce_analyser/` for Cloud Run deployment.

### Build and push to Google Container Registry

```bash
# Set your GCP project
export PROJECT_ID=your-project-id
export REGION=europe-west1

# Configure Docker for GCP
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# Build and tag backend
docker build -f bounce_analyser_webapp/Dockerfile.backend \
  -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/bounce-analyser/bounce-webapp-backend:latest .

# Build and tag frontend
docker build -f bounce_analyser_webapp/Dockerfile.frontend \
  -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/bounce-analyser/bounce-webapp-frontend:latest \
  bounce_analyser_webapp/app/frontend

# Push images
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/bounce-analyser/bounce-webapp-backend:latest
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/bounce-analyser/bounce-webapp-frontend:latest
```

## 🔧 Troubleshooting

### Backend fails to start

- Check environment variables are set correctly
- Verify Google Cloud credentials
- Check bounce_labeler_gpt package installation

### Frontend can't connect to backend

- Ensure `NEXT_PUBLIC_API_URL` is set correctly
- Check backend is running on port 8000
- Verify CORS settings in backend

### Permission errors

- Ensure proper IAM roles for service accounts
- Check if running locally with proper credentials

## 📝 Notes

- Backend runs on port 8080 inside container, exposed as 8000
- Frontend runs on port 8080 inside container, exposed as 3000
- Health checks are configured for both services
- Data directory is mounted as volume for backend

