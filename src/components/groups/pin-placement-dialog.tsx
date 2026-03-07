"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface CameraOption {
  cameraId: string;
  name: string;
}

interface PinPlacementDialogProps {
  open: boolean;
  cameras: CameraOption[];
  onConfirm: (cameraId: string) => void;
  onCancel: () => void;
}

export function PinPlacementDialog({
  open,
  cameras,
  onConfirm,
  onCancel,
}: PinPlacementDialogProps) {
  const [selected, setSelected] = useState("");

  function handleSubmit() {
    if (!selected) return;
    onConfirm(selected);
    setSelected("");
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      onCancel();
      setSelected("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Place Camera Pin</DialogTitle>
        </DialogHeader>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger>
            <SelectValue placeholder="Select a camera" />
          </SelectTrigger>
          <SelectContent>
            {cameras.map((cam) => (
              <SelectItem key={cam.cameraId} value={cam.cameraId}>
                {cam.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={!selected} onClick={handleSubmit}>
            Place Pin
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
