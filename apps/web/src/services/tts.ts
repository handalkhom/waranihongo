const pickVoice = (
  voices: ReadonlyArray<SpeechSynthesisVoice>,
  voiceUri: string | null,
): SpeechSynthesisVoice | null =>
  voices.find((voice) => voiceUri !== null && voice.voiceURI === voiceUri) ??
  voices.find((voice) => voice.lang.toLowerCase().startsWith('ja')) ??
  null;

export const speakJapanese = (text: string, voiceUri: string | null): void => {
  if (!('speechSynthesis' in window)) {
    return;
  }
  const { speechSynthesis } = window;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.voice = pickVoice(speechSynthesis.getVoices(), voiceUri);
  speechSynthesis.speak(utterance);
};
