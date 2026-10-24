import { Accordion, Button, Code, CopyButton, Group, Stack, Text } from "@mantine/core";
import type { HostInfo } from "@rpg/shared";
import { Panel } from "./Panel";

function CopyRow({ value, label }: { value: string; label?: string }) {
  return (
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
      <CopyButton value={value} timeout={1500}>
        {({ copied, copy }) => (
          <Button variant={copied ? "light" : "default"} color={copied ? "teal" : undefined} onClick={copy} style={{ flex: "none" }}>
            {copied ? "Copiado" : "Copiar"}
          </Button>
        )}
      </CopyButton>
    </Group>
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
