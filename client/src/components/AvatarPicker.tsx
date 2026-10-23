import { useRef } from "react";
import { avatarFromFile } from "../images";
import { toast } from "../store";

interface Props {
  value: string | null;
  color: string;
  onChange: (avatar: string | null) => void;
}

export function AvatarPicker({ value, color, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    try {
      onChange(await avatarFromFile(file));
    } catch (err) {
      toast({ kind: "error", text: (err as Error).message });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="avatar-picker">
      <div className="avatar-preview" style={{ borderColor: color, background: value ? undefined : color }}>
        {value && <img src={value} alt="" />}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      <button type="button" className="btn small" onClick={() => fileRef.current?.click()}>
        {value ? "Trocar avatar" : "Escolher avatar"}
      </button>
      {value && (
        <button type="button" className="btn small" onClick={() => onChange(null)}>
          Remover
        </button>
      )}
    </div>
  );
}
