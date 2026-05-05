export function base64ToAudioUrl(base64: string, mimeType: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

export function playAudioWithVolume(
  url: string,
  onVolume: (volume: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const audio = new Audio(url);
    const audioContext = new AudioContext();

    const source = audioContext.createMediaElementSource(audio);
    const analyser = audioContext.createAnalyser();

    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.65;

    source.connect(analyser);
    analyser.connect(audioContext.destination);

    const data = new Uint8Array(analyser.fftSize);

    let animationFrame = 0;
    let smoothed = 0;

    function tick() {
      analyser.getByteTimeDomainData(data);

      let sum = 0;

      for (let i = 0; i < data.length; i++) {
        const centered = (data[i] - 128) / 128;
        sum += centered * centered;
      }

      const rms = Math.sqrt(sum / data.length);

      // Tune these numbers for your TTS voice.
      const noiseFloor = 0.015;
      const gain = 8;

      let volume = Math.max(0, (rms - noiseFloor) * gain);
      volume = Math.min(1, volume);

      // Fast open, slower close. Feels more speech-like.
      const attack = 0.55;
      const release = 0.18;
      const factor = volume > smoothed ? attack : release;

      smoothed += (volume - smoothed) * factor;

      onVolume(smoothed);

      animationFrame = requestAnimationFrame(tick);
    }

    audio.onplay = () => {
      tick();
    };

    audio.onended = async () => {
      cancelAnimationFrame(animationFrame);
      onVolume(0);
      await audioContext.close();
      resolve();
    };

    audio.onerror = async () => {
      cancelAnimationFrame(animationFrame);
      onVolume(0);
      await audioContext.close();
      reject(new Error("Audio playback failed"));
    };

    audio.play().catch(reject);
  });
}
