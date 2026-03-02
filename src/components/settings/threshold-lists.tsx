"use client";

import { TemperatureThreshold, GapThreshold } from "@/types/threshold";
import { useTempUnit } from "@/contexts/temp-unit-context";
import { formatTemperature } from "@/lib/temperature-utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";

interface Group {
  id: string;
  name: string;
  cameraCount: number;
}

interface ThresholdListsProps {
  tempThresholds: TemperatureThreshold[];
  gapThresholds: GapThreshold[];
  groups: Group[];
  onEditTemp: (t: TemperatureThreshold) => void;
  onEditGap: (t: GapThreshold) => void;
  onDeleteTemp: (id: string) => void;
  onDeleteGap: (id: string) => void;
  onToggleTemp: (id: string, enabled: boolean) => void;
  onToggleGap: (id: string, enabled: boolean) => void;
}

/** Displays temperature and gap thresholds in tabbed lists with actions. */
export function ThresholdLists({
  tempThresholds,
  gapThresholds,
  groups,
  onEditTemp,
  onEditGap,
  onDeleteTemp,
  onDeleteGap,
  onToggleTemp,
  onToggleGap,
}: ThresholdListsProps) {
  const { unit } = useTempUnit();
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type: "temp" | "gap" | null;
    id: string;
    name: string;
  }>({ open: false, type: null, id: "", name: "" });

  const getScopeName = (cameraId: string | null, groupId?: string | null) => {
    if (groupId) {
      const group = groups.find((g) => g.id === groupId);
      return group ? group.name : groupId;
    }
    if (cameraId) return cameraId;
    return "Global (All)";
  };

  const confirmDelete = (type: "temp" | "gap", id: string, name: string) => {
    setDeleteDialog({ open: true, type, id, name });
  };

  const handleDelete = () => {
    if (deleteDialog.type === "temp") {
      onDeleteTemp(deleteDialog.id);
    } else {
      onDeleteGap(deleteDialog.id);
    }
    setDeleteDialog({ open: false, type: null, id: "", name: "" });
  };

  return (
    <>
      <Tabs defaultValue="temp">
        <TabsList>
          <TabsTrigger value="temp">Temperature Thresholds</TabsTrigger>
          <TabsTrigger value="gap">Gap Thresholds</TabsTrigger>
        </TabsList>

        <TabsContent value="temp" className="mt-4">
          {tempThresholds.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No temperature thresholds configured.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Range</TableHead>
                  <TableHead>Cooldown</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tempThresholds.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>{getScopeName(t.cameraId, t.groupId)}</TableCell>
                    <TableCell>
                      {t.minCelsius != null && <Badge variant="outline">Min: {formatTemperature(t.minCelsius, unit)}</Badge>}
                      {" "}
                      {t.maxCelsius != null && <Badge variant="outline">Max: {formatTemperature(t.maxCelsius, unit)}</Badge>}
                    </TableCell>
                    <TableCell>{t.cooldownMinutes}m</TableCell>
                    <TableCell>
                      <Switch
                        checked={t.enabled}
                        onCheckedChange={(v) => onToggleTemp(t.id, v)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => onEditTemp(t)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => confirmDelete("temp", t.id, t.name)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="gap" className="mt-4">
          {gapThresholds.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No gap thresholds configured.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Cooldown</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gapThresholds.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>{getScopeName(t.cameraId, t.groupId)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {t.direction === "RISE" && "Rise"}
                        {t.direction === "DROP" && "Drop"}
                        {t.direction === "BOTH" && "Any"}
                      </Badge>
                      {" "}
                      {formatTemperature(t.maxGapCelsius, unit)} in {t.intervalMinutes}m
                    </TableCell>
                    <TableCell>{t.cooldownMinutes}m</TableCell>
                    <TableCell>
                      <Switch
                        checked={t.enabled}
                        onCheckedChange={(v) => onToggleGap(t.id, v)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => onEditGap(t)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => confirmDelete("gap", t.id, t.name)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteDialog.open} onOpenChange={(o) => setDeleteDialog((d) => ({ ...d, open: o }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Threshold?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteDialog.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
