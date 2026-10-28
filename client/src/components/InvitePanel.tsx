import { Accordion, ActionIcon, Button, Code, Collapse, CopyButton, Group, Image, Stack, Text, Tooltip } from "@mantine/core";
import { IconQrcode } from "@tabler/icons-react";
import type { HostInfo } from "@rpg/shared";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Panel } from "./Panel";
import { useT } from "../i18n";

/** QR code do endereço, para o jogador apontar a câmera do celular (E12). Gerado aqui mesmo, sem internet. */
function QrImage({ value }: { value: string }) {
  const t = useT();
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    // Escuro sobre pergaminho: as câmeras leem melhor com bom contraste e margem clara.
    void QRCode.toDataURL(value, { margin: 2, width: 240, color: { dark: "#141218", light: "#ece4d4" } }).then((url) => alive && setSrc(url));
    return () => {
      alive = false;
    };
  }, [value]);
  return src ? <Image src={src} w={180} h={180} radius="sm" mx="auto" alt={t("invite.qrOf", { value })} /> : null;
}

function CopyRow({ value, label }: { value: string; label?: string }) {
  const t = useT();
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
          <Tooltip label={showQr ? t("invite.hideQr") : t("invite.showQrTip")}>
            <ActionIcon
              variant={showQr ? "light" : "default"}
              color={showQr ? "bronze" : undefined}
              size="input-xs"
              aria-label={showQr ? t("invite.hideQr") : t("invite.showQr")}
              aria-pressed={showQr}
              onClick={() => setShowQr((v) => !v)}
            >
              <IconQrcode size={16} />
            </ActionIcon>
          </Tooltip>
          <CopyButton value={value} timeout={1500}>
            {({ copied, copy }) => (
              <Button variant={copied ? "light" : "default"} color={copied ? "copper" : undefined} onClick={copy}>
                {copied ? t("invite.copied") : t("invite.copy")}
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
  const t = useT();
  // Outro dispositivo não alcança o "localhost" daqui: usa o primeiro endereço de convite.
  const gmLink = `${host.addresses[0]?.url ?? location.origin}/?gm=${host.gmKey}`;

  return (
    <Panel title={t("invite.title")}>
      {host.addresses.length === 0 ? (
        <Text size="xs" c="dimmed">
          {t("invite.none")} <Code>PUBLIC_URLS</Code> {t("invite.noneHint")} <Code>http://192.168.0.10:3000</Code>
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
              {t("invite.gmOther")}
            </Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="xs">
              <Text size="xs" c="dimmed">
                {t("invite.gmWarn")}
              </Text>
              <CopyRow value={gmLink} />
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Panel>
  );
}
