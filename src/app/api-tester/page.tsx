"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserRole, isWriteRole } from "@/hooks/use-user-role";
import { RequestForm, ProxyRequest } from "@/components/api-tester/request-form";
import { ResponseViewer, ProxyResponse } from "@/components/api-tester/response-viewer";
import { RequestHistory } from "@/components/api-tester/request-history";
import { useRequestHistory, HistoryEntry } from "@/hooks/use-request-history";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ApiTesterPage() {
  const role = useUserRole();
  const router = useRouter();

  useEffect(() => {
    if (role && !isWriteRole(role)) {
      router.replace("/");
    }
  }, [role, router]);

  const [response, setResponse] = useState<ProxyResponse | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [formValues, setFormValues] = useState<Partial<ProxyRequest>>({
    method: "GET",
    timeout: 10000,
  });

  const { history, addEntry, removeEntry, clearAll } = useRequestHistory();

  const handleSubmit = useCallback(
    async (request: ProxyRequest) => {
      setLoading(true);
      setError(undefined);
      setResponse(null);

      // Save initial form values for reloading
      setFormValues({
        method: request.method,
        timeout: request.timeout,
        url: request.url,
        body: request.body,
        headers: request.headers,
        auth: request.auth,
      });

      try {
        const res = await fetch("/api/proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        });

        const data: ProxyResponse = await res.json();

        if (!res.ok) {
          setError(data.error || `Request failed with status ${data.status}`);
        } else {
          setResponse(data);
        }

        // Add to history (store auth type but NOT credentials for security)
        addEntry({
          url: request.url,
          method: request.method,
          headers: request.headers,
          body: request.body,
          authType: request.auth?.type ?? "none",
          status: data.status,
          duration: data.duration,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error occurred");
      } finally {
        setLoading(false);
      }
    },
    [addEntry]
  );

  const handleSelectHistory = useCallback(
    (entry: HistoryEntry) => {
      setFormValues({
        url: entry.url,
        method: entry.method,
        headers: entry.headers,
        body: entry.body,
        timeout: entry.timeout ?? 10000,
        auth: entry.authType && entry.authType !== "none" ? { type: entry.authType, username: "", password: "" } : undefined,
      });
      setResponse(null);
      setError(undefined);
    },
    []
  );

  if (role && !isWriteRole(role)) return null;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">API Tester</h1>
        <p className="text-muted-foreground">
          Test camera HTTP APIs and other local network endpoints
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column: Form + Response */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Request</CardTitle>
              <CardDescription>
                Enter URL, method, headers, and body to send a request
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RequestForm
                onSubmit={handleSubmit}
                loading={loading}
                initialValues={formValues}
              />
            </CardContent>
          </Card>

          <ResponseViewer response={response} error={error} />
        </div>

        {/* Sidebar: History */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <RequestHistory
              history={history}
              onSelect={handleSelectHistory}
              onDelete={removeEntry}
              onClear={clearAll}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
