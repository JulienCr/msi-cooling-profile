import streamDeck, {
  action,
  SingletonAction,
  type DidReceiveSettingsEvent,
  type KeyAction,
  type KeyDownEvent,
  type PropertyInspectorDidAppearEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import { readActiveProfile, readProfileNames, sendSwitch } from "./msi.js";
import { ActiveProfilePoller, type Active } from "./poller.js";
import { nextProfile, normalizeProfiles } from "./profiles.js";
import { keyImage, type KeyState } from "./render.js";

type Settings = { profiles?: number[] };

@action({ UUID: "com.juliencr.msi-cooling.cycle" })
export class CycleAction extends SingletonAction<Settings> {
  private readonly visible = new Map<string, { action: KeyAction<Settings>; profiles: number[] }>();
  private readonly poller = new ActiveProfilePoller(
    () => this.renderAll(),
    (message) => streamDeck.logger.warn(message),
  );

  override onWillAppear(ev: WillAppearEvent<Settings>): void {
    if (!ev.action.isKey()) return;
    this.visible.set(ev.action.id, { action: ev.action, profiles: normalizeProfiles(ev.payload.settings.profiles) });
    this.renderOne(ev.action.id);
    this.poller.start();
  }

  override onWillDisappear(ev: WillDisappearEvent<Settings>): void {
    this.visible.delete(ev.action.id);
    if (this.visible.size === 0) this.poller.stop();
  }

  override onDidReceiveSettings(ev: DidReceiveSettingsEvent<Settings>): void {
    const entry = this.visible.get(ev.action.id);
    if (!entry) return;
    entry.profiles = normalizeProfiles(ev.payload.settings.profiles);
    this.renderOne(ev.action.id);
  }

  override async onPropertyInspectorDidAppear(_ev: PropertyInspectorDidAppearEvent<Settings>): Promise<void> {
    await streamDeck.ui.sendToPropertyInspector({ names: await readProfileNames() });
  }

  override async onKeyDown(ev: KeyDownEvent<Settings>): Promise<void> {
    const profiles = normalizeProfiles(ev.payload.settings.profiles);
    try {
      const current = await readActiveProfile();
      const target = nextProfile(current, profiles);
      await sendSwitch(target);
      streamDeck.logger.info(`switched profile ${current} -> ${target}`);
      this.poller.set(target);
    } catch (e) {
      streamDeck.logger.error(`switch failed: ${(e as Error).message}`);
      await ev.action.showAlert();
    }
  }

  private stateFor(profiles: number[], active: Active): KeyState {
    return active === null ? { kind: "off" } : { kind: "active", profile: active, inCycle: profiles.includes(active) };
  }

  private renderOne(id: string): void {
    const entry = this.visible.get(id);
    if (!entry) return;
    void entry.action.setImage(keyImage(this.stateFor(entry.profiles, this.poller.current)));
  }

  private renderAll(): void {
    for (const id of this.visible.keys()) this.renderOne(id);
  }
}
