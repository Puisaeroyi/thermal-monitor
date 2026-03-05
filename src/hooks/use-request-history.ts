"use client";

import { useState, useEffect, useCallback } from "react";

export interface HistoryEntry {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  /** Auth type used (credentials are NOT stored for security) */
  authType?: "none" | "basic" | "digest";
  timestamp: string;
  status?: number;
  duration?: number;
}

const STORAGE_KEY = "api-tester-history";
const MAX_ENTRIES = 50;

/**
 * Manages API request history in localStorage.
 * Max 50 entries with FIFO eviction.
 */
export function useRequestHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as HistoryEntry[];
        setHistory(parsed);
      }
    } catch (error) {
      console.error("[use-request-history] Failed to load history:", error);
    }
    setIsLoaded(true);
  }, []);

  // Persist history to localStorage whenever it changes
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error("[use-request-history] Failed to save history:", error);
    }
  }, [history, isLoaded]);

  const addEntry = useCallback((entry: Omit<HistoryEntry, "timestamp">) => {
    const newEntry: HistoryEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    setHistory(prev => {
      const updated = [newEntry, ...prev];
      // FIFO eviction - keep only MAX_ENTRIES
      return updated.slice(0, MAX_ENTRIES);
    });
  }, []);

  const removeEntry = useCallback((index: number) => {
    setHistory(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearAll = useCallback(() => {
    setHistory([]);
  }, []);

  const loadEntry = useCallback((index: number): HistoryEntry | undefined => {
    return history[index];
  }, [history]);

  return {
    history,
    isLoaded,
    addEntry,
    removeEntry,
    clearAll,
    loadEntry,
  };
}
