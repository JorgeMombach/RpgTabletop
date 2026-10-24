import { Accordion, ActionIcon, Button, Code, Collapse, CopyButton, Group, Image, Stack, Text, Tooltip } from "@mantine/core";
import { IconQrcode } from "@tabler/icons-react";
import type { HostInfo } from "@rpg/shared";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Panel } from "./Panel";

/** QR code do endereço, para o jogador apontar a câmera do celular (E12). Gerado aqui mesmo, sem internet. */
function QrImage({ value }: { value: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    // Escuro sobre pergaminho: as câmeras leem melhor com bom contraste e margem clara.
    void QRCode.toDataURL(value, { margin: 2, width: 240, color: { dark: "#141218", light: "#ece4d4" } }).then((url) => alive && setSrc(url));
    return () => {
      alive = false;
    };
  }, [value]);
  return src ? <Image src={src} w={180} h={180} radius="sm" mx="auto" alt={`QR code de ${value}`} /> : null;
}

function CopyRow({ value, label }: { value: string; label?: string }) {
  const [showQr, setShowQr] = useState(false);
  return (
    <Stack gap={6}>
      <Group gap="xs" wrap="nowrap" justify="space-between">
        <div style={{ minWidth: 0 }}>
          <Code block style={{ wordBreak: "break-all", whiteSpace: "normal" }}>
            {value}
          </Code>
          {label && (
            <Text size="xs" c="dimmed" mt={2}>
              {label}
            </Text>
          )}
        </div>
        <Group gap={4} wrap="nowrap" style={{ flex: "none" }}>
          <Tooltip label={showQr ? "Esconder QR code" : "Mostrar QR code para o celular"}>
            <ActionIcon
              variant={showQr ? "light" : "default"}
              color={showQr ? "bronze" : undefined}
              size="input-xs"
              aria-label={showQr ? "Esconder QR code" : "Mostrar QR code"}
              aria-pressed={showQr}
              onClick={() => setShowQr((v) => !v)}
            >
              <IconQrcode size={16} />
            </ActionIcon>
          </Tooltip>
          <CopyButton value={value} timeout={1500}>
            {({ copied, copy }) => (
              <Button variant={copied ? "light" : "default"} color={copied ? "copper" : undefined} onClick={copy}>
                {copied ? "Copiado" : "Copiar"}
              </Button>
            )}
          </CopyButton>
        </Group>
      </Group>
      <Collapse expanded={showQr}>{showQr && <QrImage value={value} />}</Collapse>
    </Stack>
  );
}

export function InvitePanel({ host }: { host: HostInfo }) {
  // Outro dispositivo não alcança o "localhost" daqui: usa o primeiro endereço de convite.
  const gmLink = `${host.addresses[0]?.url ?? location.origin}/?gm=${host.gmKey}`;

  return (
    <Panel title="Convidar jogadores">
      {host.addresses.length === 0 ? (
        <Text size="xs" c="dimmed">
          Nenhum endereço detectado. No Docker, defina <Code>PUBLIC_URLS</Code> com o endereço que os jogadores usam (ex.:{" "}
          <Code>http://192.168.0.10:3000</Code>).
        </Text>
      ) : (
        <Stack gap="xs">
          {host.addresses.map((a) => (
            <CopyRow key={a.url} value={a.url} label={a.label} />
          ))}
        </Stack>
      )}
      <Accordion variant="contained" chevronPosition="left">
        <Accordion.Item value="gm">
          <Accordion.Control>
            <Text size="xs" c="dimmed">
              Abrir como mestre em outro dispositivo
            </Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="xs">
              <Text size="xs" c="dimmed">
                Quem abrir este link entra como mestre. Não compartilhe com os jogadores.
              </Text>
              <CopyRow value={gmLink} />
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Panel>
  );
}
