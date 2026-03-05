"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Trash } from "lucide-react";
import { HistoryEntry } from "@/hooks/use-request-history";

interface RequestHistoryProps {
  history: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
  onDelete: (index: number) => void;
  onClear: () => void;
}

/**
 * Sidebar showing request history with select and delete actions.
 */
export function RequestHistory({ history, onSelect, onDelete, onClear }: RequestHistoryProps) {
  // Format timestamp to readable string
  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  // Method badge colors
  const getMethodColor = (method: string) => {
    switch (method) {
      case "GET":
        return "bg-blue-500 text-white";
      case "POST":
        return "bg-green-500 text-white";
      case "PUT":
        return "bg-orange-500 text-black";
      case "DELETE":
        return "bg-red-500 text-white";
      case "PATCH":
        return "bg-purple-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  // Truncate URL for display
  const truncateUrl = (url: string, maxLength = 40) => {
    if (url.length <= maxLength) return url;
    return url.slice(0, maxLength - 3) + "...";
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">History</CardTitle>
          {history.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-7 text-xs"
            >
              <Trash className="size-3 mr-1" />
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        {history.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            No recent requests
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((entry, index) => (
              <div
                key={`${entry.timestamp}-${index}`}
                className="group p-3 rounded-md border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                onClick={() => onSelect(entry)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        className={cn("text-xs px-1.5 py-0", getMethodColor(entry.method))}
                      >
                        {entry.method}
                      </Badge>
                      {entry.status && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            entry.status >= 200 && entry.status < 300
                              ? "text-green-600 border-green-600"
                              : entry.status >= 300 && entry.status < 400
                              ? "text-yellow-600 border-yellow-600"
                              : "text-red-600 border-red-600"
                          )}
                        >
                          {entry.status}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate font-mono">
                      {truncateUrl(entry.url)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTimestamp(entry.timestamp)}
                      {entry.duration && ` • ${entry.duration}ms`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(index);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
