import streamDeck from "@elgato/streamdeck";
import { CycleAction } from "./cycle-action.js";
import { readActiveProfile } from "./msi.js";

streamDeck.logger.setLevel("info");
streamDeck.actions.registerAction(new CycleAction());
await streamDeck.connect();

readActiveProfile().then(
  (profile) => streamDeck.logger.info(`started; CurIndex read OK: active profile ${profile} (index ${profile - 1})`),
  (e: Error) => streamDeck.logger.warn(`started; CurIndex read failed: ${e.message}`),
);
