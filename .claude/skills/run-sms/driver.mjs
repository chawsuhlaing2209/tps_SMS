#!/usr/bin/env node
// CDP driver for the tps_SMS web app. Drives the *running* app (web :3000 + api
// :4000) with headless Google Chrome over the DevTools protocol — no Playwright
// needed (only Node's `ws`, already in node_modules).
//
// Usage (run from repo root, stack already up — see SKILL.md):
//   node .claude/skills/run-sms/driver.mjs shot /            out.png   # screenshot a path, no login
//   node .claude/skills/run-sms/driver.mjs login dash.png              # tenant-owner login -> dashboard
//   node .claude/skills/run-sms/driver.mjs login fin.png /dashboard/finance/invoices
//
// Env overrides: WEB_URL (default http://localhost:3000), CHROME, TENANT, EMAIL, PASSWORD.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";
import WebSocket from "ws";

const WEB = process.env.WEB_URL || "http://localhost:3000";
const CHROME =
  process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const CREDS = {
  tenant: process.env.TENANT || "demo-alpha",
  email: process.env.EMAIL || "owner@demo-alpha.example.edu.mm",
  password: process.env.PASSWORD || "ChangeMe123!",
};
const PORT = 9333;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJSON = (url) =>
  new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let b = "";
        res.on("data", (d) => (b += d));
        res.on("end", () => resolve(JSON.parse(b)));
      })
      .on("error", reject);
  });

// Minimal CDP client over a single browser socket. A second ws to the page
// target gets rejected (HTTP 500) on modern Chrome, so we attach in "flatten"
// mode and tag every page command with its sessionId.
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      }
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const msg = { id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    this.ws.send(JSON.stringify(msg));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  // Bind a page session to ergonomic send/eval/goto/shot helpers.
  page(sessionId) {
    const send = (m, p) => this.send(m, p, sessionId);
    return {
      send,
      eval: async (expression) => {
        const r = await send("Runtime.evaluate", {
          expression,
          awaitPromise: true,
          returnByValue: true,
        });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || "eval threw");
        return r.result.value;
      },
      goto: async (url) => {
        await send("Page.navigate", { url });
        await sleep(1500); // let Next.js client render + redirects settle
      },
      shot: async (path) => {
        const { data } = await send("Page.captureScreenshot", { format: "png" });
        writeFileSync(path, Buffer.from(data, "base64"));
      },
    };
  }
}

// React-hook-form / controlled inputs ignore a raw `.value =`; you must call the
// native setter and dispatch a bubbling 'input' event. This is THE gotcha.
const fillJS = (selector, value) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return 'NO_EL:' + ${JSON.stringify(selector)};
  const proto = Object.getPrototypeOf(el);
  const set = Object.getOwnPropertyDescriptor(proto, 'value').set;
  set.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return 'OK';
})()`;

async function main() {
  const [cmd, out, pathArg, selector] = process.argv.slice(2);
  if (!cmd || !out) {
    console.error("usage: driver.mjs <shot|login|click> <out.png> [path] [selector(,selector)]");
    process.exit(2);
  }

  const profile = mkdtempSync(join(tmpdir(), "sms-chrome-"));
  const chrome = spawn(CHROME, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--window-size=1440,900",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ]);
  chrome.on("error", (e) => {
    console.error("chrome failed:", e.message);
    process.exit(1);
  });

  try {
    // Wait for the debugger endpoint. Modern Chrome blocks GET /json/new, so we
    // drive the browser-level socket and create a page target ourselves.
    let browserWsUrl;
    for (let i = 0; i < 40; i++) {
      try {
        const v = await getJSON(`http://localhost:${PORT}/json/version`);
        browserWsUrl = v.webSocketDebuggerUrl;
        if (browserWsUrl) break;
      } catch {
        await sleep(250);
      }
    }
    if (!browserWsUrl) throw new Error("chrome devtools endpoint never came up");

    const browserWs = new WebSocket(browserWsUrl);
    await new Promise((res, rej) => {
      browserWs.on("open", res);
      browserWs.on("error", rej);
    });
    const browser = new CDP(browserWs);
    const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await browser.send("Target.attachToTarget", {
      targetId,
      flatten: true,
    });
    const cdp = browser.page(sessionId);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");

    const doLogin = async () => {
      await cdp.goto(WEB + "/");
      const a = await cdp.eval(fillJS('input[name="tenant"]', CREDS.tenant));
      const b = await cdp.eval(fillJS('input[name="identifier"]', CREDS.email));
      const c = await cdp.eval(fillJS('input[type="password"]', CREDS.password));
      if ([a, b, c].some((r) => r !== "OK"))
        throw new Error(`field fill failed: ${a}/${b}/${c} (login form changed?)`);
      await cdp.eval(`document.querySelector('form.auth-form button[type="submit"]').click()`);
      await sleep(3500); // auth round-trip + redirect to /dashboard
      const url = await cdp.eval("location.pathname");
      if (!url.startsWith("/dashboard"))
        throw new Error(`login did not reach /dashboard (still at ${url})`);
    };

    if (cmd === "shot") {
      await cdp.goto(WEB + (out && pathArg ? pathArg : "/"));
      await cdp.shot(out);
    } else if (cmd === "login") {
      await doLogin();
      if (pathArg) await cdp.goto(WEB + pathArg);
      await cdp.shot(out);
      console.log("landed on", await cdp.eval("location.pathname"));
    } else if (cmd === "click") {
      // login -> goto path -> click selector(s) (comma-separated) -> screenshot.
      await doLogin();
      if (pathArg) await cdp.goto(WEB + pathArg);
      for (const sel of (selector ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
        const r = await cdp.eval(
          `(() => { const el = document.querySelector(${JSON.stringify(sel)});
            if (!el) return 'NO_EL'; el.click(); return 'OK'; })()`
        );
        if (r === "NO_EL") throw new Error(`selector not found: ${sel}`);
        await sleep(900); // let the panel/modal open and position
      }
      await cdp.shot(out);
      console.log("clicked", selector, "on", await cdp.eval("location.pathname"));
    } else {
      throw new Error(`unknown command: ${cmd}`);
    }
    console.log("wrote", out);
  } finally {
    chrome.kill("SIGKILL");
    rmSync(profile, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error("DRIVER ERROR:", e.message);
  process.exit(1);
});
