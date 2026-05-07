import clickSoundUrl from "../assets/audio/click.mp3";
import messagePopSoundUrl from "../assets/audio/message_pop.mp3";

const UI_SOUNDS = {
  click: clickSoundUrl,
  messagePop: messagePopSoundUrl,
} as const;

export type UiSoundName = keyof typeof UI_SOUNDS;

export function playUiSound(name: UiSoundName) {
  const soundUrl = UI_SOUNDS[name];
  const audio = new Audio(soundUrl);

  audio.volume = 0.2;

  void audio.play().catch((error) => {
    console.error(`Could not play UI sound "${name}".`, error);
  });
}
