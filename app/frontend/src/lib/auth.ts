/**
 * Fetch Cloud Run identity token for service-to-service authentication
 */
async function fetchIdentityToken(audience: string): Promise<string | null> {
  // Only available when running on Cloud Run
  if (typeof window === 'undefined') {
    return null;
  }
  
  // Check if we're running on Cloud Run (not localhost)
  const isCloudRun = window.location.hostname.includes('run.app');
  
  if (!isCloudRun) {
    // Running locally - no token needed
    return null;
  }
  
  try {
    // Fetch identity token from Cloud Run metadata server
    const metadataServerUrl = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${audience}`;
    
    const response = await fetch(metadataServerUrl, {
      headers: {
        'Metadata-Flavor': 'Google'
      }
    });
    
    if (!response.ok) {
      console.error('Failed to fetch identity token:', response.statusText);
      return null;
    }
    
    return await response.text();
  } catch (error) {
    console.error('Error fetching identity token:', error);
    return null;
  }
}

/**
 * Authenticated fetch wrapper that includes Cloud Run identity token
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  
  // Try to get identity token
  const token = await fetchIdentityToken(url);
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  return fetch(url, {
    ...options,
    headers,
  });
}

