"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { ActionForm } from "@/components/admin/action-form";
import { Field, NativeSelect, TextField } from "@/components/admin/fields";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveProfile } from "@/app/(site)/me/actions";
import { browserSupabase } from "@/lib/supabase/browser";
import { PLAYER_ROLES, type PlayerProfile } from "@/lib/types";

/** Shrinks a photo to at most 512px (square crop) as JPEG before upload. */
async function shrink(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const size = Math.min(img.width, img.height);
  const out = Math.min(512, size);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = out;
  canvas.getContext("2d")!.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, out, out);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read image"))), "image/jpeg", 0.85));
}

export function ProfileForm({ playerId, profile, fallbackInitials }: { playerId: string; profile: PlayerProfile | null; fallbackInitials: string }) {
  const [photo, setPhoto] = useState(profile?.photo_url ?? "");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Pick an image file.");
    setUploading(true);
    try {
      const blob = await shrink(file);
      const path = `${playerId}/${Date.now()}.jpg`;
      const supabase = browserSupabase();
      const { error } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      setPhoto(supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl);
      toast.success("Photo uploaded. Press Save to keep it.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <ActionForm action={saveProfile} className="grid gap-4 sm:grid-cols-[auto_1fr]">
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="group relative grid size-28 place-items-center overflow-hidden rounded-2xl border bg-muted font-heading text-2xl font-bold text-muted-foreground"
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="size-full object-cover" />
          ) : (
            fallbackInitials
          )}
          <span className="absolute inset-0 grid place-items-center bg-black/50 text-white opacity-0 transition group-hover:opacity-100">
            <Camera className="size-6" />
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <Button type="button" size="sm" variant="ghost" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? "Uploading…" : photo ? "Change photo" : "Add photo"}
        </Button>
        {photo && (
          <button type="button" className="text-xs text-muted-foreground hover:text-loss" onClick={() => setPhoto("")}>
            Remove photo
          </button>
        )}
        <input type="hidden" name="photo_url" value={photo} />
      </div>
      <div className="grid gap-3">
        <Field label="Preferred role">
          <NativeSelect name="role" defaultValue={profile?.role ?? ""}>
            <option value="">Not set</option>
            {PLAYER_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Bio (shown on your public profile and auction card)">
          <Textarea name="bio" defaultValue={profile?.bio ?? ""} maxLength={280} rows={3} placeholder="Clutch king. Spray control merchant." />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Instagram" name="instagram" defaultValue={profile?.instagram ?? ""} placeholder="@yourhandle" />
          <TextField label="YouTube" name="youtube" defaultValue={profile?.youtube ?? ""} placeholder="@channel or link" />
        </div>
        <Button type="submit" className="justify-self-start" disabled={uploading}>
          Save profile
        </Button>
      </div>
    </ActionForm>
  );
}
