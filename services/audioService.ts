let audio: HTMLAudioElement | null = null;

export type SoundType = 'SUCCESS' | 'ERROR' | 'NOTIFY';

const SOUND_MAP: Record<SoundType, string> = {
  SUCCESS: '/sounds/success.mp3',
  ERROR: '/sounds/error.mp3',
  NOTIFY: '/sounds/notify.mp3'
};

const DEV = !!(import.meta as any)?.env?.DEV;

export class AudioService {
  static async preload(): Promise<void> {
    try {
      const testAudio = new Audio(SOUND_MAP.SUCCESS);
      testAudio.preload = 'auto';
      await testAudio.load?.();
      audio = testAudio;
    } catch (e) {
      if (DEV) console.warn('Audio preload failed:', e);
    }
  }

  static async play(type: SoundType): Promise<void> {
    try {
      const soundUrl = SOUND_MAP[type];

      if (!audio) {
        audio = new Audio(soundUrl);
      } else {
        audio.src = soundUrl;
      }

      audio.volume = 0.4;

      await audio.play().catch((e) => {
        if (DEV) console.warn('Audio play failed:', e);
      });
    } catch (e) {
      if (DEV) console.warn('Audio error:', e);
    }
  }
}

export const playSuccessSound = async () => AudioService.play('SUCCESS');
export const playErrorSound = async () => AudioService.play('ERROR');
export const playNotifySound = async () => AudioService.play('NOTIFY');
