"use client";

import { useRef, useState } from "react";
import { Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MapUploadButtonProps {
  groupId: string;
  hasMap: boolean;
  onUploaded: (path: string) => void;
  onDeleted: () => void;
}

export function MapUploadButton({ groupId, hasMap, onUploaded, onDeleted }: MapUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/groups/${groupId}/map`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      onUploaded(data.mapImage);
    } catch (err) {
      console.error("Map upload error:", err);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete() {
    if (!confirm("Delete map and all pins?")) return;
    try {
      const res = await fetch(`/api/groups/${groupId}/map`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      onDeleted();
    } catch (err) {
      console.error("Map delete error:", err);
    }
  }

  return (
    <div className="flex gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleChange}
      />
      <Button
        variant="ghost"
        size="icon"
        title="Upload map image"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-4" />
      </Button>
      {hasMap && (
        <Button
          variant="ghost"
          size="icon"
          title="Delete map"
          onClick={handleDelete}
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      )}
    </div>
  );
}
