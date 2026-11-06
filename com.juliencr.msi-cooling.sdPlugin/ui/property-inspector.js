/* Property Inspector: plain JS, five checkboxes bound to settings.profiles. */
const COUNT = 5;
const DEFAULT_PROFILES = [1, 2];
let socket = null;
let uuid = "";
let profiles = DEFAULT_PROFILES.slice();
let names = [];

const list = document.getElementById("list");

function render() {
  list.replaceChildren();
  for (let n = 1; n <= COUNT; n++) {
    const label = document.createElement("label");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = profiles.includes(n);
    box.addEventListener("change", () => toggle(n, box));
    label.append(box, ` Profil ${n}`);
    const name = names[n - 1];
    if (name && name !== `Profil ${n}`) label.append(` (${name})`);
    list.appendChild(label);
  }
}

function toggle(n, box) {
  const next = box.checked ? [...profiles, n] : profiles.filter((p) => p !== n);
  if (next.length === 0) {
    box.checked = true;
    return;
  }
  profiles = [...new Set(next)].sort((a, b) => a - b);
  socket.send(JSON.stringify({ event: "setSettings", context: uuid, payload: { profiles } }));
}

window.connectElgatoStreamDeckSocket = (port, inUuid, registerEvent) => {
  uuid = inUuid;
  socket = new WebSocket(`ws://127.0.0.1:${port}`);
  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({ event: registerEvent, uuid }));
    socket.send(JSON.stringify({ event: "getSettings", context: uuid }));
  });
  socket.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data);
    if (msg.event === "didReceiveSettings") {
      const saved = msg.payload?.settings?.profiles;
      if (Array.isArray(saved) && saved.length > 0) profiles = saved;
      render();
    } else if (msg.event === "sendToPropertyInspector" && Array.isArray(msg.payload?.names)) {
      names = msg.payload.names;
      render();
    }
  });
};

render();
