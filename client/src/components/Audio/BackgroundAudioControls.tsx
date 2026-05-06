import { useEffect, useRef } from "react";
import "./background-audio-controls.scss";

import {
  useBackgroundAudioStore,
  type MusicStyle,
} from "../../stores/backgroundAudioStore";

const MUSIC_STYLES: MusicStyle[] = ["ambient", "futuristic", "static"];

function getAverageFrequencyRange(
  data: Uint8Array<ArrayBuffer>,
  start: number,
  end: number,
) {
  const lastIndex = Math.min(end, data.length);

  if (start >= lastIndex) return 0;

  let sum = 0;

  for (let index = start; index < lastIndex; index++) {
    sum += data[index];
  }

  return sum / (lastIndex - start) / 255;
}

export function BackgroundAudioControls() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  const {
    isPlaying,
    isMuted,
    volume,
    style,
    setIsPlaying,
    setIsMuted,
    setVolume,
    setStyle,
    setAudioAnalysis,
  } = useBackgroundAudioStore();

  useEffect(() => {
    const audio = new Audio("/audio/ambient_leo.mp3");
    audio.loop = true;
    audio.volume = volume;
    audio.muted = isMuted;
    audioRef.current = audio;

    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;
    const source = audioContext.createMediaElementSource(audio);
    const analyser = audioContext.createAnalyser();

    analyser.fftSize = 256;
    source.connect(analyser);
    analyser.connect(audioContext.destination);

    analyserRef.current = analyser;
    dataRef.current = new Uint8Array(analyser.frequencyBinCount);

    let animationFrame = 0;

    function tick() {
      const analyser = analyserRef.current;
      const data = dataRef.current;

      if (analyser && data) {
        analyser.getByteFrequencyData(data);

        setAudioAnalysis({
          amplitude: getAverageFrequencyRange(data, 0, data.length),
          bass: getAverageFrequencyRange(data, 0, 8),
          mids: getAverageFrequencyRange(data, 8, 32),
          highs: getAverageFrequencyRange(data, 32, data.length),
        });
      }

      animationFrame = requestAnimationFrame(tick);
    }

    tick();

    return () => {
      cancelAnimationFrame(animationFrame);
      audio.pause();
      audio.src = "";
      audioContext.close();
      audioContextRef.current = null;
    };
  }, [setAudioAnalysis]);

  useEffect(() => {
    if (!audioRef.current) return;

    audioRef.current.volume = volume;
    audioRef.current.muted = isMuted;
  }, [volume, isMuted]);

  async function togglePlay() {
    console.log("playing");
    const audio = audioRef.current;
    if (!audio) return;
    console.log("found audio", audio);
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    try {
      const audioContext = audioContextRef.current;

      if (audioContext?.state === "suspended") {
        await audioContext.resume();
      }

      await audio.play();
      console.log("audio is playing now");
      setIsPlaying(true);
    } catch (error) {
      console.error("Could not play background audio.", error);
      setIsPlaying(false);
    }
  }

  function cycleStyle() {
    const index = MUSIC_STYLES.indexOf(style);
    setStyle(MUSIC_STYLES[(index + 1) % MUSIC_STYLES.length]);
  }

  return (
    <div className="backgroundAudioControls">
      <button
        type="button"
        className={isPlaying ? "audioPauseButton" : "audioPlayButton"}
        onClick={togglePlay}
        aria-label={
          isPlaying ? "Pause background music" : "Play background music"
        }
      />

      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={volume}
        onChange={(event) => setVolume(Number(event.target.value))}
        aria-label="Background music volume"
      />

      <button
        type="button"
        className={isMuted ? "audioMuteButton" : "audioUnmuteMuteButton"}
        onClick={() => setIsMuted(!isMuted)}
        aria-label={
          isMuted ? "Unmute background music" : "Mute background music"
        }
      />

      <button
        type="button"
        className={`audioStyleButton ${style}`}
        onClick={cycleStyle}
        aria-label={`Music style: ${style}`}
      />
    </div>
  );
}
