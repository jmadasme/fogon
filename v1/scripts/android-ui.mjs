import { execFileSync } from "node:child_process";

const SERIAL = process.env.ANDROID_SERIAL ?? "85LNW19522001349";

function adb(args) {
  return execFileSync("adb", ["-s", SERIAL, ...args], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
}

export function dumpUi() {
  adb(["shell", "uiautomator", "dump", "/sdcard/window.xml"]);
  const xml = adb(["exec-out", "cat", "/sdcard/window.xml"]);
  const nodes = [];
  const regex = /<node\b([^>]*)\/?>/g;
  let match;
  while ((match = regex.exec(xml))) {
    const attrs = {};
    for (const attr of match[1].matchAll(/([\w-]+)="([^"]*)"/g)) {
      attrs[attr[1]] = attr[2];
    }
    if (attrs.bounds) {
      const b = attrs.bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
      if (b) {
        nodes.push({
          text: attrs.text ?? "",
          desc: attrs["content-desc"] ?? "",
          className: attrs.class ?? "",
          clickable: attrs.clickable === "true",
          enabled: attrs.enabled !== "false",
          bounds: {
            x1: Number(b[1]),
            y1: Number(b[2]),
            x2: Number(b[3]),
            y2: Number(b[4]),
          },
        });
      }
    }
  }
  return nodes;
}

export function findAllByText(nodes, text) {
  const needle = text.toLowerCase();
  return nodes.filter((node) => {
    const haystack = `${node.text} ${node.desc}`.toLowerCase();
    return haystack.includes(needle) && node.enabled;
  });
}

export function findByText(nodes, text, options = {}) {
  const matches = findAllByText(nodes, text);
  if (options.clickableOnly) {
    return matches.find((node) => node.clickable) ?? matches[0] ?? null;
  }
  if (options.last) return matches[matches.length - 1] ?? null;
  return matches[options.index ?? 0] ?? null;
}

export function findEditable(nodes) {
  return nodes.find((node) => node.className?.includes("EditText")) ?? null;
}

export async function waitForText(text, timeoutMs = 25000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const nodes = dumpUi();
    const node = findByText(nodes, text);
    if (node) return node;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error(`Timeout esperando "${text}" en Android`);
}

export async function tapTextLast(text) {
  const nodes = dumpUi();
  const node = findByText(nodes, text, { last: true });
  if (!node) throw new Error(`No encontré "${text}" en pantalla`);
  tap(node);
  return node;
}

export function tap(node) {
  if (!node) throw new Error("Nodo no encontrado");
  const x = Math.round((node.bounds.x1 + node.bounds.x2) / 2);
  const y = Math.round((node.bounds.y1 + node.bounds.y2) / 2);
  adb(["shell", "input", "tap", String(x), String(y)]);
  return { x, y };
}

export function tapText(text, options = {}) {
  const nodes = dumpUi();
  const node = findByText(nodes, text, options);
  if (!node) {
    throw new Error(`No encontré "${text}" en pantalla`);
  }
  tap(node);
  return node;
}

export function typeText(text) {
  const safe = text.replace(/ /g, "%s");
  adb(["shell", "input", "text", safe]);
}

export function keyevent(code) {
  adb(["shell", "input", "keyevent", String(code)]);
}

export function screenshot(path) {
  const buffer = execFileSync("adb", ["-s", SERIAL, "exec-out", "screencap", "-p"], {
    maxBuffer: 20 * 1024 * 1024,
  });
  return { path, buffer };
}

export { adb, SERIAL };
