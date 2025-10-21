"""
Authentication middleware for Cloud Run service-to-service authentication.
Verifies that requests come from authorized Cloud Run services.
"""

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from google.auth.transport import requests
from google.oauth2 import id_token
import os
import logging

logger = logging.getLogger(__name__)

# Allowed service accounts that can invoke this backend
ALLOWED_SERVICE_ACCOUNTS = os.getenv("ALLOWED_SERVICE_ACCOUNTS", "").split(",")

# In development (localhost), skip authentication
IS_LOCAL_DEV = os.getenv("ENVIRONMENT", "production") == "development"


async def verify_cloud_run_token(request: Request, call_next):
    """
    Middleware to verify Cloud Run identity tokens.
    Only allows requests from authorized service accounts.
    """
    
    # Skip authentication in local development
    if IS_LOCAL_DEV:
        logger.info("Local development mode - skipping authentication")
        return await call_next(request)
    
    # Allow health check endpoint without authentication
    if request.url.path == "/health":
        return await call_next(request)
    
    # Get the Authorization header
    auth_header = request.headers.get("Authorization")
    
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header"
        )
    
    token = auth_header.split("Bearer ")[1]
    
    try:
        # Verify the token
        # The audience should be the URL of this service
        audience = os.getenv("BACKEND_URL", "")
        
        if not audience:
            logger.warning("BACKEND_URL not set, using request URL")
            audience = str(request.url)
        
        # Verify the token with Google
        claims = id_token.verify_oauth2_token(
            token, 
            requests.Request(),
            audience=audience
        )
        
        # Check if the token is from an allowed service account
        email = claims.get("email", "")
        
        if not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token does not contain email claim"
            )
        
        # Check if service account is in allowed list
        if ALLOWED_SERVICE_ACCOUNTS and email not in ALLOWED_SERVICE_ACCOUNTS:
            logger.warning(f"Unauthorized service account attempted access: {email}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Service account {email} is not authorized"
            )
        
        # Add the verified email to request state for logging
        request.state.service_account = email
        logger.info(f"Authenticated request from: {email}")
        
        return await call_next(request)
        
    except ValueError as e:
        # Token verification failed
        logger.error(f"Token verification failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication error"
        )

