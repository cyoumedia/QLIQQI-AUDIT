const encoder = new TextEncoder();

function getSecret() {
  return process.env.ADMIN_PASSWORD || "cyoumedia-default-fallback-auth-key-123456";
}

async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const keyData = encoder.encode(secret);
  return crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export interface AuthTokenPayload {
  username: string;
  expiresAt: number;
}

/**
 * Creates a cryptographically signed HMAC-SHA256 token.
 */
export async function signToken(payload: AuthTokenPayload): Promise<string> {
  const secret = getSecret();
  const data = JSON.stringify(payload);
  const key = await getCryptoKey(secret);
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  
  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
    
  const base64Data = btoa(data)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
    
  return `${base64Data}.${signature}`;
}

/**
 * Verifies token signature integrity and checks expiration.
 */
export async function verifyToken(token: string): Promise<AuthTokenPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [base64Data, signature] = parts;
  
  try {
    const dataStr = atob(base64Data.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(dataStr) as AuthTokenPayload;
    
    // Check if token has expired
    if (payload.expiresAt < Date.now()) {
      return null;
    }

    const secret = getSecret();
    const key = await getCryptoKey(secret);
    const expectedSignatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(dataStr));
    const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(expectedSignatureBuffer)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
      
    if (signature === expectedSignature) {
      return payload;
    }
  } catch (e) {
    return null;
  }
  return null;
}
