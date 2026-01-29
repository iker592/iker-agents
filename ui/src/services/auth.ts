/**
 * Authentication service for Cognito OAuth
 */

// Cognito configuration from environment
const COGNITO_USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID || '';
const COGNITO_CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || '';
const COGNITO_DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN || '';

// Check if auth is configured
export const isAuthConfigured = (): boolean => {
  return !!(COGNITO_USER_POOL_ID && COGNITO_CLIENT_ID && COGNITO_DOMAIN);
};

// Token storage (in memory for security, with localStorage backup for refresh)
let accessToken: string | null = null;
let idToken: string | null = null;
let refreshToken: string | null = null;
let tokenExpiry: number | null = null;

export interface User {
  sub: string;
  email: string;
  name?: string;
}

/**
 * Parse JWT token without verification (for reading claims)
 */
function parseJwt(token: string): Record<string, unknown> {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return {};
  }
}

/**
 * Get current redirect URI
 */
function getRedirectUri(): string {
  return `${window.location.origin}/auth/callback`;
}

/**
 * Generate code verifier for PKCE
 */
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate code challenge from verifier (SHA-256)
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Initiate login flow with Cognito hosted UI
 */
export async function login(): Promise<void> {
  if (!isAuthConfigured()) {
    console.warn('Auth not configured, skipping login');
    return;
  }

  // Generate PKCE code verifier
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Store code verifier for callback
  sessionStorage.setItem('pkce_code_verifier', codeVerifier);

  // Build authorization URL
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: COGNITO_CLIENT_ID,
    redirect_uri: getRedirectUri(),
    scope: 'email openid profile',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  window.location.href = `${COGNITO_DOMAIN}/oauth2/authorize?${params.toString()}`;
}

/**
 * Handle OAuth callback and exchange code for tokens
 */
export async function handleCallback(code: string): Promise<boolean> {
  if (!isAuthConfigured()) {
    return false;
  }

  const codeVerifier = sessionStorage.getItem('pkce_code_verifier');
  if (!codeVerifier) {
    console.error('No code verifier found');
    return false;
  }

  try {
    const response = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: COGNITO_CLIENT_ID,
        code,
        redirect_uri: getRedirectUri(),
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Token exchange failed:', error);
      return false;
    }

    const tokens = await response.json();
    setTokens(tokens.access_token, tokens.id_token, tokens.refresh_token, tokens.expires_in);

    // Clean up
    sessionStorage.removeItem('pkce_code_verifier');
    return true;
  } catch (error) {
    console.error('Token exchange error:', error);
    return false;
  }
}

/**
 * Set tokens in memory
 */
function setTokens(
  access: string,
  id: string,
  refresh: string,
  expiresIn: number
): void {
  accessToken = access;
  idToken = id;
  refreshToken = refresh;
  tokenExpiry = Date.now() + expiresIn * 1000;

  // Store refresh token in localStorage for session persistence
  localStorage.setItem('auth_refresh_token', refresh);
}

/**
 * Get current access token, refreshing if needed
 */
export async function getAccessToken(): Promise<string | null> {
  // Check if auth is configured
  if (!isAuthConfigured()) {
    return null;
  }

  // Check if token is valid
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry - 60000) {
    return accessToken;
  }

  // Try to refresh
  const storedRefresh = refreshToken || localStorage.getItem('auth_refresh_token');
  if (storedRefresh) {
    const refreshed = await refreshTokens(storedRefresh);
    if (refreshed) {
      return accessToken;
    }
  }

  return null;
}

/**
 * Refresh tokens using refresh token
 */
async function refreshTokens(refresh: string): Promise<boolean> {
  try {
    const response = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: COGNITO_CLIENT_ID,
        refresh_token: refresh,
      }),
    });

    if (!response.ok) {
      return false;
    }

    const tokens = await response.json();
    setTokens(tokens.access_token, tokens.id_token, refresh, tokens.expires_in);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get current user from ID token
 */
export function getCurrentUser(): User | null {
  if (!idToken) {
    return null;
  }

  const claims = parseJwt(idToken);
  return {
    sub: claims.sub as string,
    email: claims.email as string,
    name: claims.name as string | undefined,
  };
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!(accessToken && tokenExpiry && Date.now() < tokenExpiry);
}

/**
 * Logout user
 */
export function logout(): void {
  accessToken = null;
  idToken = null;
  refreshToken = null;
  tokenExpiry = null;
  localStorage.removeItem('auth_refresh_token');

  if (isAuthConfigured()) {
    // Redirect to Cognito logout
    const params = new URLSearchParams({
      client_id: COGNITO_CLIENT_ID,
      logout_uri: window.location.origin,
    });
    window.location.href = `${COGNITO_DOMAIN}/logout?${params.toString()}`;
  }
}

/**
 * Initialize auth on app start (check for stored refresh token)
 */
export async function initAuth(): Promise<void> {
  if (!isAuthConfigured()) {
    return;
  }

  const storedRefresh = localStorage.getItem('auth_refresh_token');
  if (storedRefresh) {
    await refreshTokens(storedRefresh);
  }
}
