import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8081';

/**
 * API proxy that forwards requests to the backend with Cloud Run authentication
 * This runs server-side on Cloud Run and can access the metadata server
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path, 'POST');
}

async function proxyRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string
) {
  try {
    const path = pathSegments.join('/');
    const backendUrl = `${BACKEND_URL}/${path}`;
    
    // Get identity token from Cloud Run metadata server (server-side only)
    let token: string | null = null;
    
    // Only fetch token when running on Cloud Run (not localhost)
    const isCloudRun = process.env.K_SERVICE !== undefined;
    
    if (isCloudRun) {
      try {
        const metadataResponse = await fetch(
          `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${BACKEND_URL}`,
          {
            headers: {
              'Metadata-Flavor': 'Google',
            },
          }
        );
        
        if (metadataResponse.ok) {
          token = await metadataResponse.text();
        }
      } catch (error) {
        console.error('Failed to fetch identity token:', error);
      }
    }
    
    // Prepare headers
    const headers: HeadersInit = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Forward Content-Type for POST requests
    const contentType = request.headers.get('content-type');
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
    
    // Prepare request body for POST
    let body: BodyInit | undefined;
    if (method === 'POST') {
      body = await request.arrayBuffer();
    }
    
    // Forward request to backend
    const backendResponse = await fetch(backendUrl, {
      method,
      headers,
      body,
    });
    
    // Get response data
    const responseData = await backendResponse.arrayBuffer();
    
    // Forward backend response to client
    return new NextResponse(responseData, {
      status: backendResponse.status,
      headers: {
        'Content-Type': backendResponse.headers.get('Content-Type') || 'application/json',
      },
    });
    
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy request to backend' },
      { status: 500 }
    );
  }
}

