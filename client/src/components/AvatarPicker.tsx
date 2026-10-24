import { Avatar, Button, FileButton, Group, Input } from "@mantine/core";
import { avatarFromFile } from "../images";
import { toast } from "../notify";

interface Props {
  value: string | null;
  color: string;
  onChange: (avatar: string | null) => void;
}

export function AvatarPicker({ value, color, onChange }: Props) {
  async function pick(file: File | null) {
    if (!file) return;
    try {
      onChange(await avatarFromFile(file));
    } catch (err) {
      toast({ kind: "error", text: (err as Error).message });
    }
  }

  return (
    <Input.Wrapper label="Avatar no mapa (opcional)">
      <Group gap="sm" wrap="wrap" mt={4}>
        <Avatar src={value} size={40} radius="xl" style={{ border: `3px solid ${color}`, background: value ? undefined : color }} />
        <FileButton onChange={pick} accept="image/png,image/jpeg,image/webp">
          {(props) => (
            <Button variant="default" {...props}>
              {value ? "Trocar avatar" : "Escolher avatar"}
            </Button>
          )}
        </FileButton>
        {value && (
          <Button variant="subtle" color="gray" onClick={() => onChange(null)}>
            Remover
          </Button>
        )}
      </Group>
    </Input.Wrapper>
  );
}
