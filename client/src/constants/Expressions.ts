export type FacialExpressionName =
  | "neutral"
  | "happy"
  | "sad"
  | "angry"
  | "bored"
  | "listening"
  | "thinking";

export const FACIAL_EXPRESSIONS: Record<
  FacialExpressionName,
  Record<string, number>
> = {
  neutral: {},

  happy: {
    mouthSmile_L: 0.8,
    mouthSmile_R: 0.8,
    cheekSquint_L: 0.35,
    cheekSquint_R: 0.35,
    eyeLookOut_L: 0.6,
    eyeLookOut_R: 0.6,
    eyeSquint_L: 0.2,
    eyeSquint_R: 0.2,
  },

  sad: {
    mouthFrown_L: 0.8,
    mouthFrown_R: 0.8,
    browInnerUp: 0.45,
    eyeLookDown_L: 0.25,
    eyeLookDown_R: 0.25,
  },

  angry: {
    browDown_L: 0.8,
    browDown_R: 0.8,
    eyeSquint_L: 0.35,
    eyeSquint_R: 0.35,
    mouthPress_L: 0.4,
    mouthPress_R: 0.4,
  },

  bored: {
    eyeLookDown_L: 0.25,
    eyeLookDown_R: 0.25,
    mouthPress_L: 0.25,
    mouthPress_R: 0.25,
    browOuterUp_L: 0.2,
    browOuterUp_R: 0.2,
  },

  listening: {
    browInnerUp: 0.85,
    eyeWide_L: 0.85,
    eyeWide_R: 0.85,
    mouthSmile_L: 0.65,
    mouthSmile_R: 0.65,
  },

  thinking: {
    browDown_L: 0.85,
    browDown_R: 0.85,
    eyeLookUp_L: 0.6,
    eyeLookUp_R: 0.6,
    mouthPress_L: 0.85,
    mouthPress_R: 0.85,
  },
};

export const FACIAL_EXPRESSION_MORPH_TARGETS = Array.from(
  new Set(Object.values(FACIAL_EXPRESSIONS).flatMap(Object.keys)),
);
