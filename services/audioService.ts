import { getSystemConfig } from "./logic";
import { AudioType, SystemConfig } from "../types";

export class AudioService {
  private static audioCache = new Map<string, HTMLAudioElement>();

  static async play(soundType: AudioType): Promise<void> {
    try {
      const config = await getSystemConfig();

      if (config.notificationSounds && config.notificationSounds.enabled === false) return;

      const soundData = this.getSoundData(config, soundType);

      if (!soundData || typeof soundData !== "string" || soundData.trim() === "") return;

      const audio = this.getAudioInstance(soundData);

      audio.currentTime = 0;

      if (config.notificationSounds?.volume !== undefined) {
        audio.volume = config.notificationSounds.volume;
      } else {
        audio.volume = 1.0;
      }

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          if ((import.meta as any).env?.DEV) {
            console.warn(`[AudioService] Falha ao reproduzir som (${soundType}):`, error);
          }
        });
      }
    } catch (error) {
      if ((import.meta as any).env?.DEV) {
        console.error(`[AudioService] Erro crítico ao tentar tocar ${soundType}:`, error);
      }
    }
  }

  private static getSoundData(config: SystemConfig, soundType: AudioType): string | undefined {
    const specificSounds: Record<AudioType, string | undefined> = {
      NOTIFICATION: (config as any).notificationSound,
      ALERT: (config as any).alertSound,
      SUCCESS: (config as any).successSound,
      WARNING: (config as any).warningSound,
    };

    return specificSounds[soundType] || (config as any).notificationSounds?.sound;
  }

  private static getAudioInstance(soundData: string): HTMLAudioElement {
    if (!this.audioCache.has(soundData)) {
      const audio = new Audio(soundData);
      this.audioCache.set(soundData, audio);
    }
    return this.audioCache.get(soundData)!;
  }

  static async preload(): Promise<void> {
    try {
      const config = await getSystemConfig();
      const sounds = [
        (config as any).notificationSounds?.sound,
        (config as any).notificationSound,
        (config as any).alertSound,
        (config as any).successSound,
        (config as any).warningSound,
      ];

      sounds.forEach((soundData) => {
        if (soundData && typeof soundData === "string" && soundData.trim() !== "") {
          this.getAudioInstance(soundData);
        }
      });
    } catch {
      // ignora
    }
  }
}

/**
 * Exports auxiliares (compatibilidade com imports antigos/novos)
 * - Mantém AudioService.play(...) como API principal
 * - Permite imports diretos: playSuccessSound(), etc.
 */
export const playSuccessSound = async (): Promise<void> => {
  await AudioService.play("SUCCESS");
};

export const playNotificationSound = async (): Promise<void> => {
  await AudioService.play("NOTIFICATION");
};

export const playAlertSound = async (): Promise<void> => {
  await AudioService.play("ALERT");
};

export const playWarningSound = async (): Promise<void> => {
  await AudioService.play("WARNING");
};
