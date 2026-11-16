import { useCallback } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { speakJapanese } from '@/services/tts';

export const useSpeech = (): ((text: string) => void) => {
  const settings = useSettings();
  const voiceUri =
    settings.status === 'ready' && settings.profile !== null ? settings.profile.ttsVoiceUri : null;
  return useCallback(
    (text: string): void => {
      speakJapanese(text, voiceUri);
    },
    [voiceUri],
  );
};
