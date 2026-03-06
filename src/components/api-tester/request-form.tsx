"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, X, Loader2, Lock } from "lucide-react";

export type AuthType = "none" | "basic" | "digest";

export interface AuthConfig {
  type: AuthType;
  username?: string;
  password?: string;
}

export interface ProxyRequest {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  auth?: AuthConfig;
}

interface RequestFormProps {
  onSubmit: (request: ProxyRequest) => void;
  loading: boolean;
  initialValues?: Partial<ProxyRequest>;
}

interface HeaderRow {
  id: string;
  key: string;
  value: string;
}

const DEFAULT_TIMEOUT = 10000;
const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"];
const AUTH_TYPES: { value: AuthType; label: string }[] = [
  { value: "none", label: "No Auth" },
  { value: "basic", label: "Basic" },
  { value: "digest", label: "Digest" },
];

/**
 * Request form with URL, method, headers, body, and timeout inputs.
 */
export function RequestForm({ onSubmit, loading, initialValues }: RequestFormProps) {
  const [url, setUrl] = useState(initialValues?.url ?? "");
  const [method, setMethod] = useState(initialValues?.method ?? "GET");
  const [timeout, setTimeout] = useState(initialValues?.timeout ?? DEFAULT_TIMEOUT);
  const [body, setBody] = useState(initialValues?.body ?? "");
  const [authType, setAuthType] = useState<AuthType>(initialValues?.auth?.type ?? "none");
  const [authUsername, setAuthUsername] = useState(initialValues?.auth?.username ?? "");
  const [authPassword, setAuthPassword] = useState(initialValues?.auth?.password ?? "");
  const [headerRows, setHeaderRows] = useState<HeaderRow[]>(() => {
    const headers = initialValues?.headers ?? {};
    const entries = Object.entries(headers);
    if (entries.length === 0) {
      return [{ id: crypto.randomUUID(), key: "", value: "" }];
    }
    return entries.map(([key, value]) => ({
      id: crypto.randomUUID(),
      key,
      value,
    }));
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Build headers object from rows (filter out empty rows)
    const headers: Record<string, string> = {};
    headerRows.forEach(row => {
      if (row.key.trim() && row.value.trim()) {
        headers[row.key.trim()] = row.value.trim();
      }
    });

    const request: ProxyRequest = {
      url: url.trim(),
      method,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      body: body.trim() || undefined,
      timeout,
      auth: authType !== "none" ? { type: authType, username: authUsername, password: authPassword } : undefined,
    };

    onSubmit(request);
  };

  const addHeaderRow = useCallback(() => {
    setHeaderRows(prev => [...prev, { id: crypto.randomUUID(), key: "", value: "" }]);
  }, []);

  const removeHeaderRow = useCallback((id: string) => {
    setHeaderRows(prev => prev.filter(row => row.id !== id));
  }, []);

  const updateHeaderRow = useCallback((id: string, field: "key" | "value", value: string) => {
    setHeaderRows(prev =>
      prev.map(row => (row.id === id ? { ...row, [field]: value } : row))
    );
  }, []);

  const showBody = ["POST", "PUT", "PATCH"].includes(method);

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* URL */}
          <div className="space-y-2">
            <Label htmlFor="url">URL</Label>
            <Input
              id="url"
              placeholder="http://192.168.1.100/api/status"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {/* Method and Timeout */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="method">Method</Label>
              <Select value={method} onValueChange={setMethod} disabled={loading}>
                <SelectTrigger id="method">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {HTTP_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeout">Timeout (ms)</Label>
              <Input
                id="timeout"
                type="number"
                min={1000}
                max={30000}
                value={timeout}
                onChange={(e) => setTimeout(Number(e.target.value))}
                disabled={loading}
              />
            </div>
          </div>

          {/* Authentication */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Lock className="size-4" />
              <Label>Authentication</Label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Select value={authType} onValueChange={(v) => setAuthType(v as AuthType)} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder="Auth type" />
                </SelectTrigger>
                <SelectContent>
                  {AUTH_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {authType !== "none" && (
                <>
                  <Input
                    placeholder="Username"
                    value={authUsername}
                    onChange={(e) => setAuthUsername(e.target.value)}
                    disabled={loading}
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    disabled={loading}
                  />
                </>
              )}
            </div>
          </div>

          {/* Headers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Headers</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addHeaderRow}
                disabled={loading}
              >
                <Plus className="size-4" />
                Add Header
              </Button>
            </div>

            <div className="space-y-2">
              {headerRows.map((row, index) => (
                <div key={row.id} className="flex gap-2">
                  <Input
                    placeholder="Header name"
                    value={row.key}
                    onChange={(e) => updateHeaderRow(row.id, "key", e.target.value)}
                    disabled={loading}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Header value"
                    value={row.value}
                    onChange={(e) => updateHeaderRow(row.id, "value", e.target.value)}
                    disabled={loading}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeHeaderRow(row.id)}
                    disabled={loading || headerRows.length === 1}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Body */}
          {showBody && (
            <div className="space-y-2">
              <Label htmlFor="body">Request Body</Label>
              <textarea
                id="body"
                className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                placeholder='{"key": "value"}'
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={loading}
              />
            </div>
          )}

          {/* Submit */}
          <Button type="submit" className="w-full" disabled={loading || !url.trim()}>
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Request"
            )}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
