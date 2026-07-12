import { useEffect, useRef, useState } from "react";

export function useAudioPlayback() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingBgm, setPlayingBgm] = useState<string | null>(null);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const toggleBgmPlay = (file: string) => {
    if (playingBgm === file) {
      audioRef.current?.pause();
      setPlayingBgm(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(`/api/v1/tts/bgm/${file}`);
      audioRef.current = audio;
      audio.play().catch(() => setPlayingBgm(null));
      setPlayingBgm(file);
      setPlayingVoice(null);
      audio.onended = () => setPlayingBgm(null);
      audio.onerror = () => setPlayingBgm(null);
    }
  };

  const toggleVoicePlay = (voiceId: string) => {
    if (playingVoice === voiceId) {
      audioRef.current?.pause();
      setPlayingVoice(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(`/api/v1/tts/sample/${voiceId}`);
      audioRef.current = audio;
      audio.play().catch(() => setPlayingVoice(null));
      setPlayingVoice(voiceId);
      setPlayingBgm(null);
      audio.onended = () => setPlayingVoice(null);
      audio.onerror = () => setPlayingVoice(null);
    }
  };

  return { playingBgm, playingVoice, toggleBgmPlay, toggleVoicePlay };
}
