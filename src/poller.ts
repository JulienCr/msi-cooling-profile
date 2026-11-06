import { isUiRunning, readActiveProfile } from "./msi.js";

/** null = MSI Center unreachable (UI not running or registry unreadable). */
export type Active = number | null;

const POLL_MS = 2000;

/** One shared poller for all visible keys; runs only between start() and stop(). */
export class ActiveProfilePoller {
  private timer: NodeJS.Timeout | undefined;
  private busy = false;
  current: Active = null;

  constructor(
    private readonly onChange: (active: Active) => void,
    private readonly onError: (message: string) => void,
  ) {}

  start(): void {
    if (this.timer) return;
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), POLL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  /** Reads now; notifies only if the value changed. */
  async refresh(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const [ui, profile] = await Promise.all([isUiRunning(), readActiveProfile().catch((e: Error) => e)]);
      if (profile instanceof Error) {
        this.onError(`CurIndex read failed: ${profile.message}`);
        this.set(null);
      } else {
        this.set(ui ? profile : null);
      }
    } finally {
      this.busy = false;
    }
  }

  /** Also used right after a successful switch. */
  set(next: Active): void {
    if (next === this.current) return;
    this.current = next;
    this.onChange(next);
  }
}
