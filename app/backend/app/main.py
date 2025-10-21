from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
from .routes import campaigns
from .routes import report
from .routes import upload
from .middleware.auth import verify_cloud_run_token

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI()

# Configure CORS - restrict to frontend domain in production
FRONTEND_URL = os.getenv("FRONTEND_URL", "")
allowed_origins = [
    "http://localhost:3000",  # Local development
    FRONTEND_URL  # Production frontend
] if FRONTEND_URL else ["*"]  # Allow all if FRONTEND_URL not set (local dev)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
    expose_headers=["*"],  # Expose all headers
    max_age=3600,  # Cache preflight requests for 1 hour
)

@app.get("/health")
async def health_check():
    """Health check endpoint for Cloud Run"""
    return {"status": "healthy"}

# Add authentication middleware
app.middleware("http")(verify_cloud_run_token)

# Include routers
app.include_router(campaigns.router)
app.include_router(report.router)
app.include_router(upload.router)