import { Affix, Button } from "@mantine/core";
import { IconVolume } from "@tabler/icons-react";
import type { SoundState } from "@rpg/shared";
import { useEffect, useState } from "react";
import { audioLocked, onAudioState, playSfx, setPlayerVolume, syncSound, unlockAudio } from "../audio/engine";
import { sessionToken } from "../session";
import { socket } from "../socket";
import { useVolume } from "../store";

/**
 * Deixa o som deste navegador igual ao da mesa (E25) e toca os efeitos de uma vez.
 * O navegador só libera áudio depois de um clique: com algo tocando, aparece "Ativar som".
 */
export function SoundSync({ sound }: { sound: SoundState }) {
  const { volume, muted } = useVolume();
  const [locked, setLocked] = useState(() => audioLocked());

  useEffect(() => syncSound(sound, sessionToken()), [sound]);
  useEffect(() => setPlayerVolume(volume, muted), [volume, muted]);

  useEffect(() => {
    const off = onAudioState(() => setLocked(audioLocked()));
    // Qualquer clique ou tecla na página já libera o som.
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    const sfx = (source: Parameters<typeof playSfx>[0]) => void playSfx(source, sessionToken());
    socket.on("sound:sfx", sfx);
    return () => {
      off();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      socket.off("sound:sfx", sfx);
    };
  }, []);

  const playing = sound.music !== null || sound.ambient !== null;
  if (!locked || !playing) return null;
  return (
    <Affix position={{ bottom: 24, left: "50%" }} style={{ transform: "translateX(-50%)" }}>
      <Button leftSection={<IconVolume size={16} />} onClick={unlockAudio} size="md" className="plaque">
        Ativar som da mesa
      </Button>
    </Affix>
  );
}
