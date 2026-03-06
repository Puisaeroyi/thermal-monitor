"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProxyResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  duration: number;
  error?: string;
}

interface ResponseViewerProps {
  response: ProxyResponse | null;
  error?: string;
}

/**
 * Displays API response with status, headers, and formatted body.
 */
export function ResponseViewer({ response, error }: ResponseViewerProps) {
  const [headersOpen, setHeadersOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyBody = useCallback(async () => {
    if (!response?.body) return;

    await navigator.clipboard.writeText(response.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [response?.body]);

  // Show nothing when no response
  if (!response && !error) {
    return null;
  }

  // Show error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Response</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-md bg-destructive/10 text-destructive">
            <p className="font-medium">Request Failed</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!response) return null;

  const { status, statusText, headers, body, duration, error: responseError } = response;

  // Status badge color based on status code
  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "bg-green-500 text-white";
    if (status >= 300 && status < 400) return "bg-yellow-500 text-black";
    return "bg-red-500 text-white";
  };

  // Try to parse body as JSON for pretty printing
  let formattedBody: string;
  let isJson = false;

  try {
    const parsed = JSON.parse(body);
    formattedBody = JSON.stringify(parsed, null, 2);
    isJson = true;
  } catch {
    formattedBody = body;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Response</CardTitle>
          <Button variant="outline" size="sm" onClick={copyBody} disabled={!body}>
            {copied ? (
              <>
                <Check className="size-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="size-4" />
                Copy Body
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status and Duration */}
        <div className="flex items-center gap-4">
          <Badge className={cn("text-sm px-3 py-1", getStatusColor(status))}>
            {status} {statusText}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {duration} ms
          </span>
        </div>

        {/* Error message if present */}
        {responseError && (
          <div className="p-4 rounded-md bg-destructive/10 text-destructive">
            <p className="font-medium">Error</p>
            <p className="text-sm mt-1">{responseError}</p>
          </div>
        )}

        {/* Headers (collapsible) */}
        {Object.keys(headers).length > 0 && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setHeadersOpen(!headersOpen)}
              className="flex items-center gap-2 text-sm font-medium hover:underline"
            >
              {headersOpen ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
              Response Headers ({Object.keys(headers).length})
            </button>

            {headersOpen && (
              <div className="rounded-md border bg-muted/50 max-h-48 overflow-y-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(headers).map(([key, value]) => (
                      <tr key={key} className="border-b last:border-b-0">
                        <td className="font-mono text-xs px-3 py-2 text-muted-foreground w-1/3">
                          {key}
                        </td>
                        <td className="font-mono text-xs px-3 py-2 break-all">
                          {value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Body */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Body</span>
            {isJson && (
              <Badge variant="secondary" className="text-xs">
                JSON
              </Badge>
            )}
          </div>
          <pre className="rounded-md border bg-muted/50 p-4 max-h-96 overflow-auto text-xs font-mono whitespace-pre-wrap break-all">
            {formattedBody}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
