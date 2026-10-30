// Set speeds
const SLOW = 0.0001;
const MEDIUM = 0.001;
const FAST = 0.01;

// Set layout ratios
const SLIVER = 0.475;
const TRIPTYCH = 0.34;
const DESERT = 0.1;

// Narrative
const PROGRESSIONS = {
  FOLLOW: {
    SS: [SLOW, SLOW],
    MM: [MEDIUM, MEDIUM],
    FF: [FAST, FAST],
    SM: [SLOW, MEDIUM],
    MS: [MEDIUM, SLOW],
    MF: [MEDIUM, FAST],
    FM: [FAST, MEDIUM],
    SF: [SLOW, FAST],
    FS: [FAST, SLOW],
  },
  DIVERGE: {
    SS: [-SLOW, SLOW],
    MM: [-MEDIUM, MEDIUM],
    FF: [-FAST, FAST],
    SM: [-SLOW, MEDIUM],
    MS: [-MEDIUM, SLOW],
    MF: [-MEDIUM, FAST],
    FM: [-FAST, MEDIUM],
    SF: [-SLOW, FAST],
    FS: [-FAST, SLOW],
  },
  CONVERGE: {
    SS: [SLOW, -SLOW],
    MM: [MEDIUM, -MEDIUM],
    FF: [FAST, -FAST],
    SM: [SLOW, -MEDIUM],
    MS: [MEDIUM, -SLOW],
    MF: [MEDIUM, -FAST],
    FM: [FAST, -MEDIUM],
    SF: [SLOW, -FAST],
    FS: [FAST, -SLOW],
  }
}

// Sets
const SCORE = {
  1: {
    layout: SLIVER,
    progression: PROGRESSIONS.CONVERGE.FF,
    dir : 1,
    fade_time: 3,
    hold_time: 1
  },
  2: {
    layout: TRIPTYCH,
    progression: PROGRESSIONS.DIVERGE.MM,
    dir : 1,
    fade_time: 10,
    hold_time: 3
  },
  3: {
    layout: DESERT,
    progression: PROGRESSIONS.FOLLOW.MS,
    dir : 1,
    fade_time: 5,
    hold_time: 10
  }
}