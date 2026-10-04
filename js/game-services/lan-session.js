/* Home-wifi sessions for the web runtime (docs/plans/2026-10-04-brick-lab-multiplayer/
   D1, D2; slice 04). Game-neutral: one JSON object per line between tablets.

   The transport is the Summer Quest Android plugin (LanHub.java). In a browser,
   on a desktop or in Node there is none: `available` is false and every call
   is a harmless no-op, so a game runs solo exactly as before. Tests and
   browser harnesses use createLoopback(): several in-memory "tablets" on one
   pretend wifi, injectable as `globalThis.__sqLanTransport`. */

export const LINE_MAX = 64 * 1024;
const NAME_BYTES = 60; /* NSD service names are 63 bytes */
const TXT_BYTES = 200;

/* Cut a string to `max` UTF-8 bytes without splitting a character. */
export function clipBytes(text, max) {
  let out = "";
  let bytes = 0;
  for (const ch of String(text == null ? "" : text)) {
    const size = new TextEncoder().encode(ch).length;
    if (bytes + size > max) break;
    out += ch;
    bytes += size;
  }
  return out;
}

export function encodeLine(message) {
  let line;
  try { line = JSON.stringify(message); } catch { return null; }
  return typeof line === "string" && line.length <= LINE_MAX ? line : null;
}

export function decodeLine(line) {
  if (typeof line !== "string" || line.length > LINE_MAX) return null;
  try {
    const message = JSON.parse(line);
    return message && typeof message === "object" && !Array.isArray(message) && typeof message.t === "string" ? message : null;
  } catch {
    return null;
  }
}

/* The Android plugin, wrapped to the transport shape, or null. */
export function nativeTransport(win = globalThis) {
  const capacitor = win && win.Capacitor;
  if (!capacitor) return null;
  try {
    if (typeof capacitor.isNativePlatform === "function" && !capacitor.isNativePlatform()) return null;
  } catch {
    return null;
  }
  const plugin = capacitor.Plugins && capacitor.Plugins.SummerQuestNative;
  if (!plugin || typeof plugin.lanHost !== "function") return null; /* an APK from before slice 03 */
  return {
    host: (name, txt) => plugin.lanHost({ name, txt }),
    stop: () => plugin.lanStop({}),
    discover: () => plugin.lanDiscover({}),
    stopDiscover: () => plugin.lanStopDiscover({}),
    join: (host, port) => plugin.lanJoin({ host, port }).then((r) => r.peer),
    send: (peer, line) => plugin.lanSend({ peer, line }),
    close: (peer) => plugin.lanClose({ peer }),
    leave: () => plugin.lanLeave({}),
    keepAwake: (on) => plugin.keepAwake({ on: !!on }),
    on(event, handler) {
      let handle = null;
      let off = false;
      Promise.resolve(plugin.addListener(event, handler)).then((h) => {
        handle = h;
        if (off && handle) handle.remove();
      }).catch(() => {});
      return () => {
        off = true;
        if (handle) handle.remove();
      };
    },
  };
}

/* Pretend wifi for tests: network.device() is one tablet's transport. */
export function createLoopback() {
  const services = new Map(); /* name → { name, txt, device } */
  const devices = new Set();
  let peerSeq = 0;

  function device() {
    const listeners = new Map();
    const links = new Map(); /* my peer id → { other, theirId } */
    const self = { hosting: null, discovering: false, awake: false };
    const emit = (event, data) => Promise.resolve().then(() => (listeners.get(event) || []).slice().forEach((f) => f(data)));
    const found = (service) => ({ id: service.name, name: service.name, host: service.name, port: 1, txt: { ...service.txt } });

    function unlink(id) {
      const link = links.get(id);
      if (!link) return;
      links.delete(id);
      link.other.links.delete(link.theirId);
      emit("lanPeerClosed", { peer: id });
      link.other.emit("lanPeerClosed", { peer: link.theirId });
    }

    const api = {
      self,
      links,
      emit,
      on(event, handler) {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event).push(handler);
        return () => listeners.set(event, (listeners.get(event) || []).filter((f) => f !== handler));
      },
      async host(name, txt) {
        await api.stop();
        let unique = name;
        for (let n = 2; services.has(unique); n += 1) unique = `${name} (${n})`;
        const service = { name: unique, txt: { ...txt }, device: api };
        services.set(unique, service);
        self.hosting = unique;
        devices.forEach((d) => { if (d !== api && d.self.discovering) d.emit("lanFound", found(service)); });
        return { port: 1, name: unique };
      },
      async stop() {
        if (!self.hosting) return;
        services.delete(self.hosting);
        const gone = self.hosting;
        self.hosting = null;
        devices.forEach((d) => { if (d !== api && d.self.discovering) d.emit("lanLost", { id: gone }); });
        Array.from(links.keys()).filter((id) => id !== "host").forEach(unlink);
      },
      async discover() {
        self.discovering = true;
        services.forEach((service) => { if (service.device !== api) emit("lanFound", found(service)); });
      },
      async stopDiscover() { self.discovering = false; },
      async join(host) {
        const service = services.get(host);
        if (!service) throw new Error("connect");
        unlink("host");
        const theirs = `p${++peerSeq}`;
        links.set("host", { other: service.device, theirId: theirs });
        service.device.links.set(theirs, { other: api, theirId: "host" });
        service.device.emit("lanPeerOpen", { peer: theirs });
        emit("lanPeerOpen", { peer: "host" });
        return "host";
      },
      async send(peer, line) {
        if (typeof line !== "string" || line.length > LINE_MAX) return;
        links.forEach((link, id) => {
          if (peer === "*" || peer === id) link.other.emit("lanLine", { peer: link.theirId, line });
        });
      },
      async close(peer) { unlink(peer); },
      async leave() { unlink("host"); },
      async keepAwake(on) { self.awake = !!on; },
      /* Test helper: this tablet drops off the wifi. */
      drop() {
        Array.from(links.keys()).forEach(unlink);
        if (self.hosting) api.stop();
      },
    };
    devices.add(api);
    return api;
  }

  return { device, services };
}

/* The session a game uses. `transport` defaults to the test hook, then the
   Android plugin; null means building together isn't available here. */
export function createLanSession(transport) {
  const t = transport === undefined ? (globalThis.__sqLanTransport || nativeTransport()) : transport;
  const offs = [];
  const handlers = { message: [], peer: [], found: [], lost: [] };
  const call = (fn) => { try { return Promise.resolve(fn()).catch(() => null); } catch { return Promise.resolve(null); } };
  const fire = (kind, ...args) => handlers[kind].slice().forEach((f) => { try { f(...args); } catch (e) { console.error(e); } });

  if (t) {
    offs.push(t.on("lanLine", (e) => {
      const message = decodeLine(e && e.line);
      if (message) fire("message", e.peer, message);
    }));
    offs.push(t.on("lanPeerOpen", (e) => fire("peer", e.peer, true)));
    offs.push(t.on("lanPeerClosed", (e) => fire("peer", e.peer, false)));
    offs.push(t.on("lanFound", (e) => fire("found", e)));
    offs.push(t.on("lanLost", (e) => fire("lost", e)));
  }
  const listen = (kind) => (handler) => {
    handlers[kind].push(handler);
    return () => { handlers[kind] = handlers[kind].filter((f) => f !== handler); };
  };

  return {
    available: !!t,
    onMessage: listen("message"),
    onPeer: listen("peer"),
    onFound: listen("found"),
    onLost: listen("lost"),
    /* Resolves { port, name } (the name may change on a clash) or null. */
    host(name, txt = {}) {
      if (!t) return Promise.resolve(null);
      const clean = {};
      Object.keys(txt).forEach((key) => { clean[key] = clipBytes(txt[key], TXT_BYTES); });
      return call(() => t.host(clipBytes(name, NAME_BYTES) || "Summer Quest", clean));
    },
    stopHosting: () => (t ? call(() => t.stop()) : Promise.resolve()),
    discover: () => (t ? call(() => t.discover()) : Promise.resolve()),
    stopDiscover: () => (t ? call(() => t.stopDiscover()) : Promise.resolve()),
    /* Resolves the peer id of the host, or null when it can't connect. */
    join: (service) => (t && service ? call(() => t.join(service.host, service.port)) : Promise.resolve(null)),
    send(peer, message) {
      const line = encodeLine(message);
      if (!t || !line) return false;
      call(() => t.send(peer, line));
      return true;
    },
    broadcast(message) { return this.send("*", message); },
    close: (peer) => (t ? call(() => t.close(peer)) : Promise.resolve()),
    leave: () => (t ? call(() => t.leave()) : Promise.resolve()),
    keepAwake: (on) => (t ? call(() => t.keepAwake(on)) : Promise.resolve()),
    dispose() {
      offs.forEach((off) => { try { off(); } catch {} });
      offs.length = 0;
      Object.keys(handlers).forEach((k) => { handlers[k] = []; });
    },
  };
}
