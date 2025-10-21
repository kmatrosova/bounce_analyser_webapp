// API configuration that works at runtime
// This is set by the server at runtime, not baked in at build time

declare global {
  interface Window {
    __API_URL__?: string;
  }
}

export function getApiUrl(): string {
  // In production, read from window object (set by server)
  if (typeof window !== 'undefined' && window.__API_URL__) {
    return window.__API_URL__;
  }
  
  // Fallback to environment variable (for local development)
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
}

