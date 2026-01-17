// services/audioService.ts

// A simple in-memory cache for audio buffers
const audioCache = new Map<string, AudioBuffer>();

let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.error("Web Audio API is not supported in this browser.", e);
      return null;
    }
  }
  return audioContext;
};

// Function to decode a base64 DataURL into an AudioBuffer
const decodeAudioData = async (dataUrl: string): Promise<AudioBuffer | null> => {
  const context = getAudioContext();
  if (!context) return null;

  if (audioCache.has(dataUrl)) {
    return audioCache.get(dataUrl)!;
  }

  try {
    const response = await fetch(dataUrl);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await context.decodeAudioData(arrayBuffer);
    audioCache.set(dataUrl, audioBuffer);
    return audioBuffer;
  } catch (error) {
    console.error("Failed to decode audio data:", error);
    return null;
  }
};

// Function to play a sound from an AudioBuffer
const playSound = (audioBuffer: AudioBuffer | null): void => {
  const context = getAudioContext();
  if (!context || !audioBuffer) return;

  // Resume context if it's in a suspended state (required by modern browsers)
  if (context.state === 'suspended') {
    context.resume();
  }
  
  const source = context.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(context.destination);
  source.start(0);
};

// A "success" sound encoded as a DataURL. This avoids needing a separate file.
// This is a simple, short, and clean synth notification sound.
const successSoundDataUrl = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';


let successSoundBuffer: AudioBuffer | null = null;

// Pre-load and cache the success sound
const preloadSuccessSound = async () => {
    if (!successSoundBuffer) {
        successSoundBuffer = await decodeAudioData(successSoundDataUrl);
    }
};

// Public function to play the pre-loaded success sound
export const playSuccessSound = async () => {
    if (!successSoundBuffer) {
        await preloadSuccessSound();
    }
    playSound(successSoundBuffer);
};

// Pre-load the sound as soon as the module is imported
preloadSuccessSound();

