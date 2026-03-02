"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

export type TempUnit = "C" | "F";

const STORAGE_KEY = "thermal-temp-unit";

interface TempUnitContextValue {
  unit: TempUnit;
  toggleUnit: () => void;
  setUnit: (u: TempUnit) => void;
}

const TempUnitContext = createContext<TempUnitContextValue>({
  unit: "F",
  toggleUnit: () => {},
  setUnit: () => {},
});

export function TempUnitProvider({ children }: { children: React.ReactNode }) {
  const [unit, setUnitState] = useState<TempUnit>("F");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as TempUnit | null;
    if (stored === "C" || stored === "F") {
      setUnitState(stored);
    } else {
      localStorage.setItem(STORAGE_KEY, "F");
    }
  }, []);

  const setUnit = useCallback((u: TempUnit) => {
    setUnitState(u);
    localStorage.setItem(STORAGE_KEY, u);
  }, []);

  const toggleUnit = useCallback(() => {
    setUnit(unit === "C" ? "F" : "C");
  }, [unit, setUnit]);

  return (
    <TempUnitContext.Provider value={{ unit, toggleUnit, setUnit }}>
      {children}
    </TempUnitContext.Provider>
  );
}

export function useTempUnit() {
  return useContext(TempUnitContext);
}
