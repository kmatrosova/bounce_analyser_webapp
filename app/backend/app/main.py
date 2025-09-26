from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from .routes import inference_routes
from .routes import campaigns
from .routes import report
from .routes import upload

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins during development
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
    expose_headers=["*"],  # Expose all headers
    max_age=3600,  # Cache preflight requests for 1 hour
)

# Include routers
app.include_router(inference_routes.router)
app.include_router(campaigns.router)
app.include_router(report.router)
app.include_router(upload.router)