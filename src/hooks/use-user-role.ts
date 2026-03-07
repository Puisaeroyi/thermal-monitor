"use client";

import { useSyncExternalStore } from "react";

export type UserRole = "admin" | "manager" | "operator" | "";

function getRole(): UserRole {
  if (typeof window === "undefined") return "";
  const user = localStorage.getItem("user");
  if (!user) return "";
  try {
    return JSON.parse(user).role ?? "";
  } catch {
    return "";
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

/** Returns current user's role from localStorage. */
export function useUserRole(): UserRole {
  return useSyncExternalStore(subscribe, getRole, () => "" as UserRole);
}

/** Check if role can perform write/modify actions (admin & manager only). */
export function isWriteRole(role: UserRole): boolean {
  return role === "admin" || role === "manager";
}
