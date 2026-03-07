"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export type AlertNoteDialogMode = "check" | "view" | "edit";

export interface AlertNoteTarget {
  id: string;
  cameraId: string;
  createdAt: string;
  note: string | null;
  acknowledged: boolean;
  camera?: { name?: string | null };
}

interface AlertNoteDialogProps {
  open: boolean;
  mode: AlertNoteDialogMode;
  alert: AlertNoteTarget | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (alertId: string, note: string) => Promise<void>;
}

/** Modal for checking alerts with note input, viewing notes, and editing notes later. */
export function AlertNoteDialog({
  open,
  mode,
  alert,
  onOpenChange,
  onSubmit,
}: AlertNoteDialogProps) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingInView, setEditingInView] = useState(false);

  const isEditable = mode !== "view" || editingInView;
  const cameraLabel = alert?.camera?.name ?? alert?.cameraId ?? "";

  useEffect(() => {
    if (!open) return;
    setNote(alert?.note ?? "");
    setError(null);
    setSubmitting(false);
    setEditingInView(false);
  }, [open, alert, mode]);

  async function handleSubmit() {
    if (!alert) return;
    const trimmed = note.trim();
    if (!trimmed) {
      setError("Note is required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(alert.id, trimmed);
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save note";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "check" ? "Check Alert" : isEditable ? "Edit Note" : "Alert Note"}
          </DialogTitle>
          <DialogDescription>
            {cameraLabel ? `Camera: ${cameraLabel}. ` : ""}
            {alert ? `Triggered at ${new Date(alert.createdAt).toLocaleString()}.` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="alert-note">Note</Label>
          {isEditable ? (
            <textarea
              id="alert-note"
              className="flex min-h-[160px] max-h-[340px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Enter your note..."
              disabled={submitting}
            />
          ) : (
            <div className="max-h-[340px] min-h-[120px] overflow-y-auto rounded-md border border-input px-3 py-2 text-sm whitespace-pre-wrap break-words">
              {note || "No note provided."}
            </div>
          )}
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {isEditable ? "Cancel" : "Close"}
          </Button>
          {!isEditable && alert?.acknowledged && (
            <Button type="button" onClick={() => setEditingInView(true)}>
              Edit Note
            </Button>
          )}
          {isEditable && (
            <Button type="button" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Saving..." : mode === "check" ? "Submit" : "Save"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
