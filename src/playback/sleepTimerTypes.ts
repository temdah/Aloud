export type SleepTimer = {
  active: boolean;
  minutesLeft: number;
  start: (minutes: number) => void;
  cancel: () => void;
};
