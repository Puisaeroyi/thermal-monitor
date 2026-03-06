import { createHash } from "crypto";

interface DigestChallenge {
  realm: string;
  nonce: string;
  qop?: string;
  opaque?: string;
  algorithm?: string;
}

/**
 * Parses the WWW-Authenticate header from a 401 response to extract digest challenge params.
 */
function parseDigestChallenge(header: string): DigestChallenge | null {
  if (!header.toLowerCase().startsWith("digest ")) return null;

  const params: Record<string, string> = {};
  // Match key="value" or key=value patterns
  const regex = /(\w+)=(?:"([^"]*)"|([\w]+))/g;
  let match;
  while ((match = regex.exec(header)) !== null) {
    params[match[1]] = match[2] ?? match[3];
  }

  if (!params.realm || !params.nonce) return null;
  return {
    realm: params.realm,
    nonce: params.nonce,
    qop: params.qop,
    opaque: params.opaque,
    algorithm: params.algorithm,
  };
}

/** Compute MD5 hex hash */
function md5(data: string): string {
  return createHash("md5").update(data).digest("hex");
}

/**
 * Performs an HTTP request with Digest Authentication (RFC 2617).
 * 1) Sends initial request → gets 401 with WWW-Authenticate challenge
 * 2) Computes digest response hash
 * 3) Retries request with Authorization header
 */
export async function fetchWithDigestAuth(
  url: string,
  options: RequestInit,
  username: string,
  password: string,
): Promise<Response> {
  // Step 1: Initial request to get the 401 challenge
  const initialRes = await fetch(url, options);
  if (initialRes.status !== 401) return initialRes;

  const wwwAuth = initialRes.headers.get("www-authenticate");
  if (!wwwAuth) return initialRes;

  const challenge = parseDigestChallenge(wwwAuth);
  if (!challenge) return initialRes;

  // Step 2: Compute digest response
  const method = options.method?.toUpperCase() ?? "GET";
  const uri = new URL(url).pathname + new URL(url).search;
  const nc = "00000001";
  const cnonce = md5(Math.random().toString(36));

  const ha1 = md5(`${username}:${challenge.realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);

  let responseHash: string;
  if (challenge.qop === "auth") {
    responseHash = md5(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:auth:${ha2}`);
  } else {
    responseHash = md5(`${ha1}:${challenge.nonce}:${ha2}`);
  }

  // Step 3: Build Authorization header and retry
  let authHeader = `Digest username="${username}", realm="${challenge.realm}", nonce="${challenge.nonce}", uri="${uri}", response="${responseHash}"`;
  if (challenge.qop) authHeader += `, qop=auth, nc=${nc}, cnonce="${cnonce}"`;
  if (challenge.opaque) authHeader += `, opaque="${challenge.opaque}"`;

  const retryHeaders = new Headers(options.headers as HeadersInit);
  retryHeaders.set("Authorization", authHeader);

  return fetch(url, { ...options, headers: retryHeaders });
}
