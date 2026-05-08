export function base64ToAudioUrl(base64: string, mimeType: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

let sharedAudioContext: AudioContext | null = null;

function getAudioContext() {
  sharedAudioContext ??= new AudioContext();
  return sharedAudioContext;
}

export async function prepareAudioPlayback() {
  const audioContext = getAudioContext();

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
}

export async function playAudioWithVolume(
  url: string,
  onVolume: (volume: number) => void,
) {
  await prepareAudioPlayback();

  const audioContext = getAudioContext();
  const response = await fetch(url);
  const audioBuffer = await audioContext.decodeAudioData(
    await response.arrayBuffer(),
  );

  return new Promise<void>((resolve, reject) => {
    const source = audioContext.createBufferSource();
    const analyser = audioContext.createAnalyser();

    source.buffer = audioBuffer;
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.65;

    source.connect(analyser);
    analyser.connect(audioContext.destination);

    const data = new Uint8Array(analyser.fftSize);

    let animationFrame = 0;
    let smoothed = 0;
    let settled = false;

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

    function cleanup() {
      cancelAnimationFrame(animationFrame);
      onVolume(0);
      source.disconnect();
      analyser.disconnect();
    }

    source.onended = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };

    try {
      tick();
      source.start();
    } catch (error) {
      settled = true;
      cleanup();
      reject(error);
    }
  });
}
