import { NextRequest, NextResponse } from "next/server";
import { fetchWithDigestAuth } from "@/lib/digest-auth";

interface AuthConfig {
  type: "none" | "basic" | "digest";
  username?: string;
  password?: string;
}

interface ProxyRequest {
  url: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  auth?: AuthConfig;
}

interface ProxyResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  duration: number;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 10000;
const MAX_TIMEOUT_MS = 30000;

/**
 * Validates if an IP address is in private ranges (RFC 1918) or localhost.
 * Allows: 10.x.x.x, 172.16-31.x.x, 192.168.x.x, localhost, 127.x.x.x
 */
function isPrivateIP(hostname: string): boolean {
  // Allow localhost
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return true;
  }

  // Parse IP address
  const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = hostname.match(ipv4Pattern);

  if (!match) {
    return false;
  }

  const [, a, b, c, d] = match.map(Number);

  // Validate octets are in range
  if ([a, b, c, d].some(octet => octet < 0 || octet > 255)) {
    return false;
  }

  // Check private IP ranges
  // 10.0.0.0 - 10.255.255.255
  if (a === 10) {
    return true;
  }

  // 172.16.0.0 - 172.31.255.255
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }

  // 192.168.0.0 - 192.168.255.255
  if (a === 192 && b === 168) {
    return true;
  }

  // 127.0.0.0 - 127.255.255.255 (loopback)
  if (a === 127) {
    return true;
  }

  return false;
}

/**
 * Extracts hostname from URL and validates it's a private IP
 */
function validatePrivateURL(urlString: string): { valid: boolean; error?: string } {
  try {
    const url = new URL(urlString);

    // Only allow HTTP/HTTPS
    if (!["http:", "https:"].includes(url.protocol)) {
      return { valid: false, error: "Only HTTP and HTTPS protocols are allowed" };
    }

    // Validate hostname is private IP
    if (!isPrivateIP(url.hostname)) {
      return {
        valid: false,
        error: "Only private IP addresses (10.x.x.x, 172.16-31.x.x, 192.168.x.x, 127.x.x.x) and localhost are allowed"
      };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}

/**
 * POST /api/proxy - Server-side HTTP proxy for testing camera APIs
 * Avoids CORS and mixed-content issues when accessing local network devices
 */
export async function POST(req: NextRequest) {
  const startTime = performance.now();

  try {
    const body = await req.json();

    // Validate required fields
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Request body must be an object" },
        { status: 400 }
      );
    }

    const { url, method = "GET", headers = {}, body: requestBody, timeout = DEFAULT_TIMEOUT_MS, auth } = body as ProxyRequest;

    // Validate URL
    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "url must be a non-empty string" },
        { status: 400 }
      );
    }

    // Validate URL is private IP range
    const urlValidation = validatePrivateURL(url);
    if (!urlValidation.valid) {
      return NextResponse.json(
        { error: urlValidation.error },
        { status: 400 }
      );
    }

    // Validate method
    const validMethods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
    if (!validMethods.includes(method)) {
      return NextResponse.json(
        { error: `method must be one of: ${validMethods.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate and clamp timeout
    const clampedTimeout = Math.min(Math.max(timeout, 1000), MAX_TIMEOUT_MS);

    // Create AbortController for timeout
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), clampedTimeout);

    // Prepare fetch options
    const fetchOptions: RequestInit = {
      method,
      headers: {
        ...headers,
        "Content-Type": headers["Content-Type"] || "application/json",
      },
      signal: abortController.signal,
    };

    // Add Basic auth header if requested
    if (auth?.type === "basic" && auth.username && auth.password) {
      const encoded = Buffer.from(`${auth.username}:${auth.password}`).toString("base64");
      (fetchOptions.headers as Record<string, string>)["Authorization"] = `Basic ${encoded}`;
    }

    // Add body for methods that support it
    if (["POST", "PUT", "PATCH"].includes(method) && requestBody) {
      fetchOptions.body = requestBody;
    }

    // Execute the request — use digest auth handshake or plain fetch
    let response: Response;
    if (auth?.type === "digest" && auth.username && auth.password) {
      response = await fetchWithDigestAuth(url, fetchOptions, auth.username, auth.password);
    } else {
      response = await fetch(url, fetchOptions);
    }
    clearTimeout(timeoutId);

    const duration = performance.now() - startTime;

    // Read response body
    const responseText = await response.text();

    // Extract headers as plain object
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const proxyResponse: ProxyResponse = {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseText,
      duration: Math.round(duration),
    };

    return NextResponse.json(proxyResponse);
  } catch (error) {
    const duration = performance.now() - startTime;

    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        {
          error: "Request timeout",
          duration: Math.round(duration)
        },
        { status: 408 }
      );
    }

    if (error instanceof Error && error.message.includes("fetch")) {
      return NextResponse.json(
        {
          error: `Network error: ${error.message}`,
          duration: Math.round(duration)
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        duration: Math.round(duration)
      },
      { status: 500 }
    );
  }
}
