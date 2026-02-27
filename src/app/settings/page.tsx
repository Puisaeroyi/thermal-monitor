"use client";

import { useState, useEffect } from "react";
import { TemperatureThreshold, GapDirection } from "@/types/threshold";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TemperatureThresholdForm } from "@/components/settings/temperature-threshold-form";
import { GapThresholdForm } from "@/components/settings/gap-threshold-form";
import { ThresholdLists } from "@/components/settings/threshold-lists";
import { GroupManagement } from "@/components/settings/group-management";

interface GapThreshold {
  id: string;
  name: string;
  cameraId: string | null;
  intervalMinutes: number;
  maxGapCelsius: number;
  direction: GapDirection;
  cooldownMinutes: number;
  notifyEmail: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Group {
  id: string;
  name: string;
  color: string;
  cameraCount: number;
}

type FormType = "temp" | "gap" | null;

export default function SettingsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [tempThresholds, setTempThresholds] = useState<TemperatureThreshold[]>([]);
  const [gapThresholds, setGapThresholds] = useState<GapThreshold[]>([]);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState<FormType>(null);
  const [editingTemp, setEditingTemp] = useState<TemperatureThreshold | null>(null);
  const [editingGap, setEditingGap] = useState<GapThreshold | null>(null);

  useEffect(() => {
    Promise.all([fetchGroups(), fetchTempThresholds(), fetchGapThresholds()])
      .finally(() => setLoading(false));
  }, []);

  async function fetchGroups() {
    const res = await fetch("/api/groups");
    if (res.ok) setGroups(await res.json());
  }

  async function fetchTempThresholds() {
    const res = await fetch("/api/thresholds/temperature");
    if (res.ok) setTempThresholds(await res.json());
  }

  async function fetchGapThresholds() {
    const res = await fetch("/api/thresholds/gap");
    if (res.ok) setGapThresholds(await res.json());
  }

  function openTempForm(threshold?: TemperatureThreshold) {
    setEditingTemp(threshold ?? null);
    setOpenForm("temp");
  }

  function openGapForm(threshold?: GapThreshold) {
    setEditingGap(threshold ?? null);
    setOpenForm("gap");
  }

  function closeForm() {
    setOpenForm(null);
    setEditingTemp(null);
    setEditingGap(null);
  }

  async function handleDeleteTemp(id: string) {
    const res = await fetch(`/api/thresholds/temperature/${id}`, { method: "DELETE" });
    if (res.ok) fetchTempThresholds();
  }

  async function handleDeleteGap(id: string) {
    const res = await fetch(`/api/thresholds/gap/${id}`, { method: "DELETE" });
    if (res.ok) fetchGapThresholds();
  }

  async function handleToggleTemp(id: string, enabled: boolean) {
    const res = await fetch(`/api/thresholds/temperature/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (res.ok) fetchTempThresholds();
  }

  async function handleToggleGap(id: string, enabled: boolean) {
    const res = await fetch(`/api/thresholds/gap/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (res.ok) fetchGapThresholds();
  }

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage groups, temperature and gap thresholds</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Groups</CardTitle>
          <CardDescription>
            Organize cameras into groups for bulk threshold configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GroupManagement groups={groups} onChange={fetchGroups} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Thresholds</CardTitle>
          <CardDescription>
            Configure alerts based on temperature readings and rapid changes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={() => openTempForm()}>
              Add Temperature Threshold
            </Button>
            <Button onClick={() => openGapForm()} variant="outline">
              Add Gap Threshold
            </Button>
          </div>

          <ThresholdLists
            tempThresholds={tempThresholds}
            gapThresholds={gapThresholds}
            groups={groups}
            onEditTemp={openTempForm}
            onEditGap={openGapForm}
            onDeleteTemp={handleDeleteTemp}
            onDeleteGap={handleDeleteGap}
            onToggleTemp={handleToggleTemp}
            onToggleGap={handleToggleGap}
          />
        </CardContent>
      </Card>

      <TemperatureThresholdForm
        open={openForm === "temp"}
        onOpenChange={closeForm}
        threshold={editingTemp}
        groups={groups}
        onSuccess={() => {
          fetchTempThresholds();
          closeForm();
        }}
      />

      <GapThresholdForm
        open={openForm === "gap"}
        onOpenChange={closeForm}
        threshold={editingGap}
        groups={groups}
        onSuccess={() => {
          fetchGapThresholds();
          closeForm();
        }}
      />
    </div>
  );
}
