import { execFile } from "node:child_process";
import { connect } from "node:net";
import { buildSwitchFrame } from "./profiles.js";

const COMPONENT = "HKLM\\SOFTWARE\\WOW6432Node\\MSI\\MSI Center\\Component";
const REPLY_TIMEOUT_MS = 3000;

function run(file: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true, timeout: 5000 }, (err, stdout) => (err ? reject(err) : resolve(stdout)));
  });
}

/** Reads one value through `reg query`; throws if it is missing. */
async function regValue(key: string, name: string): Promise<string> {
  const out = await run("reg.exe", ["query", key, "/v", name]);
  const match = out.match(new RegExp(`^\\s*${name}\\s+REG_[A-Z_]+\\s+(.*)$`, "m"));
  if (!match) throw new Error(`registry value not found: ${key}\\${name}`);
  return match[1]!.trim();
}

let cachedSid: string | undefined;

async function currentSid(): Promise<string> {
  if (cachedSid) return cachedSid;
  try {
    cachedSid = await regValue(`${COMPONENT}\\Cooling Wizard`, "CurUserSID");
  } catch {
    const out = await run("whoami.exe", ["/user", "/fo", "csv", "/nh"]);
    const sid = out.match(/S-1-[\d-]+/)?.[0];
    if (!sid) throw new Error("cannot determine the user SID");
    cachedSid = sid;
  }
  return cachedSid;
}

/** Active profile as the 1-based number shown in MSI Center. */
export async function readActiveProfile(): Promise<number> {
  const data = await regValue(`${COMPONENT}\\Cooling Wizard\\${await currentSid()}`, "CurIndex");
  const index = Number.parseInt(data, 16);
  if (!Number.isInteger(index) || index < 0 || index > 4) throw new Error(`unexpected CurIndex: ${data}`);
  return index + 1;
}

/** Profile display names, or an empty list if unavailable. */
export async function readProfileNames(): Promise<string[]> {
  try {
    const data = await regValue(`${COMPONENT}\\Cooling Wizard\\${await currentSid()}`, "ProfileNames");
    return data.split("\\0").map((s) => s.replace(/^"|"$/g, "").trim());
  } catch {
    return [];
  }
}

export async function isUiRunning(): Promise<boolean> {
  try {
    const out = await run("tasklist.exe", ["/FI", "IMAGENAME eq DCv2.exe", "/FO", "CSV", "/NH"]);
    return out.toLowerCase().includes("dcv2.exe");
  } catch {
    return false;
  }
}

async function readPort(): Promise<number> {
  const data = await regValue(`${COMPONENT}\\SDK`, "Server Port");
  const port = Number.parseInt(data, 16);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error(`unexpected Server Port: ${data}`);
  return port;
}

/** Sends the switch frame to MSI.CentralServer. Throws with a readable reason on any failure. */
export async function sendSwitch(profile: number): Promise<void> {
  if (!(await isUiRunning())) throw new Error("MSI Center UI (DCv2.exe) is not running");
  const port = await readPort();
  const frame = buildSwitchFrame(profile);
  const reply = await new Promise<Buffer>((resolve, reject) => {
    const socket = connect({ host: "127.0.0.1", port });
    const chunks: Buffer[] = [];
    socket.setTimeout(REPLY_TIMEOUT_MS, () => {
      socket.destroy();
      if (chunks.length > 0) resolve(Buffer.concat(chunks));
      else reject(new Error("no reply from CentralServer (timeout)"));
    });
    socket.once("connect", () => socket.write(frame));
    socket.on("data", (d) => {
      chunks.push(d);
      socket.end();
    });
    socket.once("error", (e) => reject(new Error(`connection to port ${port} failed: ${e.message}`)));
    socket.once("close", () => resolve(Buffer.concat(chunks)));
  });
  if (reply.length === 0 || reply[reply.length - 1] !== 1) {
    throw new Error(`unexpected reply [${[...reply].map((b) => b.toString(16).padStart(2, "0")).join(" ")}]`);
  }
}
