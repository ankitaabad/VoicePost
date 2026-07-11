export type VoiceProfile = {
  id: string;
  name: string;
  gender: "male" | "female";
  leadingSilence: number;
  paragraphPause: number;
  /** Weighted speech units per second (calibrated from TTS samples). */
  speechRate: number;
  pauses: {
    period: number;
    comma: number;
    question: number;
    exclamation: number;
    semicolon: number;
    colon: number;
  };
};

// Calibrated from actual TTS silence detection on zipup script (2026-07-11)
// speechRate: median weighted units/sec across 6 scripts per voice
export const VOICE_PROFILES: VoiceProfile[] = [
  {
    id: "af_heart",
    name: "American Female (Heart)",
    gender: "female",
    leadingSilence: 0.32,
    paragraphPause: 0.5,
    speechRate: 5.823,
    pauses: {
      period: 0.45,
      comma: 0.14,
      question: 0.4,
      exclamation: 0.38,
      semicolon: 0.22,
      colon: 0.18,
    },
  },
  {
    id: "af_sarah",
    name: "American Female (Sarah)",
    gender: "female",
    leadingSilence: 0.48,
    paragraphPause: 0.65,
    speechRate: 5.967,
    pauses: {
      period: 0.5,
      comma: 0.15,
      question: 0.45,
      exclamation: 0.42,
      semicolon: 0.24,
      colon: 0.2,
    },
  },
  {
    id: "am_adam",
    name: "American Male (Adam)",
    gender: "male",
    leadingSilence: 0.3,
    paragraphPause: 0.55,
    speechRate: 5.932,
    pauses: {
      period: 0.4,
      comma: 0.1,
      question: 0.38,
      exclamation: 0.3,
      semicolon: 0.18,
      colon: 0.14,
    },
  },
  {
    id: "am_liam",
    name: "American Male (Liam)",
    gender: "male",
    leadingSilence: 0.25,
    paragraphPause: 0.5,
    speechRate: 6.403,
    pauses: {
      period: 0.38,
      comma: 0.1,
      question: 0.32,
      exclamation: 0.3,
      semicolon: 0.16,
      colon: 0.14,
    },
  },
];

export const DEFAULT_VOICE_PROFILE: VoiceProfile = {
  id: "af_heart",
  name: "American Female (Heart)",
  gender: "female",
  leadingSilence: 0.32,
  paragraphPause: 0.5,
  speechRate: 5.823,
  pauses: {
    period: 0.45,
    comma: 0.14,
    question: 0.4,
    exclamation: 0.38,
    semicolon: 0.22,
    colon: 0.18,
  },
};

export function getVoiceProfile(voiceId: string): VoiceProfile {
  return VOICE_PROFILES.find((v) => v.id === voiceId) ?? DEFAULT_VOICE_PROFILE;
}
