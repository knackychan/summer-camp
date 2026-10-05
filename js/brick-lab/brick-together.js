/* Building together on the home wifi (docs/plans/2026-10-04-brick-lab-multiplayer/
   D4, D5, D6, D9; slices 05–06). The session logic between Brick Lab and the
   LAN session; the lab keeps the scene, this keeps who is connected and in
   what order changes happen.

   Host (the tablet whose world is open): every guest request goes through the
   lab's sequencer, automatically, and every applied change is sent to all
   guests. Guest: requests go to the host; nothing changes on the plate until
   the host's numbered change comes back. Nobody confirms anything.

   Messages (one JSON object per line):
     guest → host  hello {proto, cat, kid} · req {id, op} · resync · bye
     host → guest  welcome {world, seq, roster, name, host, more} · world {pieces} · refuse {why}
                   apply {seq, by, req, op} · reject {req, why} · peers {roster} · bye
   A line is at most 64 KB, so a big world comes as a welcome plus `more`
   world lines, sent back to back; the guest loads it once they are all in. */
import { PROTO, createClient, createUndo } from "./brick-share.js";
import { CATALOG_ID } from "./brick-catalog.js";
import { LINE_MAX } from "../game-services/lan-session.js";

export const GAME = "bricklab";

export class BrickTogether {
  /* lab: the BrickLabRuntime; lan: a lan-session; kid: this tablet's kid id.
     retryMs: how long a guest keeps looking for a host it lost (D9). */
  constructor(lab, lan, kid, { retryMs = 30000 } = {}) {
    this.lab = lab;
    this.lan = lan;
    this.kid = kid;
    this.role = null; /* null | "host" | "guest" */
    this.peers = new Map(); /* host: peer id → kid */
    this.roster = []; /* kids in the world, host first */
    this.undo = createUndo();
    this.pending = new Map(); /* guest: request id → op */
    this.found = new Map(); /* worlds open nearby, by service id */
    this.client = null;
    this.incoming = null; /* guest: { welcome, left } while a big world arrives */
    this.hostInfo = null; /* guest: { kid, world, name, peer } */
    this.lost = null; /* guest: { kid, world, timer } while looking for a lost host */
    this.retryMs = retryMs;
    this.offs = [
      lan.onMessage((peer, message) => this.onMessage(peer, message)),
      lan.onPeer((peer, open) => this.onPeer(peer, open)),
      lan.onFound((service) => this.onFound(service)),
      lan.onLost((service) => this.onLost(service)),
    ];
  }

  get shared() {
    return this.role === "guest" || (this.role === "host" && this.peers.size > 0);
  }

  /* ---------- finding worlds (menu) ---------- */

  startLooking() {
    if (!this.lan.available) return;
    this.found.clear();
    this.lan.discover();
  }

  stopLooking() {
    if (!this.lan.available) return;
    this.lan.stopDiscover();
    this.found.clear();
  }

  onFound(service) {
    const txt = service && service.txt;
    if (!txt || txt.game !== GAME) return;
    const world = { ...service, kid: txt.kid || "", world: txt.world || "", proto: Number(txt.proto) || 0 };
    this.found.set(service.id, world);
    if (this.lost && world.kid === this.lost.kid && world.world === this.lost.world) this.rejoin(world);
    else this.lab.renderJoin();
  }

  onLost(service) {
    if (service && this.found.delete(service.id)) this.lab.renderJoin();
  }

  joinable() {
    return Array.from(this.found.values());
  }

  /* ---------- hosting ---------- */

  async host(worldName) {
    if (!this.lan.available) return;
    this.role = "host";
    this.roster = [this.kid];
    this.undo.clear();
    const name = `${this.lab.kidName(this.kid)} · ${worldName}`;
    await this.lan.host(name, { game: GAME, proto: String(PROTO), kid: this.kid, world: worldName });
  }

  stopHosting() {
    if (this.role !== "host") return;
    if (this.peers.size) this.lan.broadcast({ t: "bye" });
    this.lan.stopHosting();
    this.lan.keepAwake(false);
    this.peers.clear();
    this.roster = [];
    this.role = null;
    this.undo.clear();
  }

  hostHello(peer, message) {
    /* Another app version, or the same protocol with other parts (more-parts D6). */
    if (Number(message.proto) !== PROTO || message.cat !== CATALOG_ID) {
      this.lan.send(peer, { t: "refuse", why: "proto" });
      setTimeout(() => this.lan.close(peer), 200);
      this.lab.versionRefused();
      return;
    }
    const kid = typeof message.kid === "string" ? message.kid.slice(0, 64) : "";
    if (!kid) { this.lan.close(peer); return; }
    /* The same kid on a second connection replaces the first (D9). */
    for (const [other, otherKid] of this.peers) {
      if (otherKid === kid && other !== peer) {
        /* Told first, so the old tablet goes home instead of looking again. */
        this.peers.delete(other);
        this.lan.send(other, { t: "refuse", why: "replaced" });
        setTimeout(() => this.lan.close(other), 200);
      }
    }
    const fresh = !Array.from(this.peers.values()).includes(kid);
    this.peers.set(peer, kid);
    /* The world first, then everyone hears the new roster. */
    this.sendWelcome(peer, kid);
    this.updateRoster();
    if (fresh) this.lab.crewToast(kid, true);
    this.lan.keepAwake(true);
    this.lab.sharedChanged();
  }

  /* The world in lines that each fit, the welcome first. */
  welcome(joining) {
    const roster = this.roster.slice();
    if (joining && !roster.includes(joining)) roster.push(joining);
    const budget = LINE_MAX - 4096; /* room for the welcome's other fields */
    const chunks = [[]];
    let size = 0;
    for (const piece of this.lab.pieces.values()) {
      const length = JSON.stringify(piece).length + 1;
      if (size + length > budget && chunks[chunks.length - 1].length) { chunks.push([]); size = 0; }
      chunks[chunks.length - 1].push(piece);
      size += length;
    }
    const head = {
      t: "welcome",
      world: chunks[0],
      seq: this.lab.sequencer.seq,
      roster,
      name: this.lab.currentWorldName(),
      host: this.kid,
      more: chunks.length - 1,
    };
    return [head, ...chunks.slice(1).map((pieces) => ({ t: "world", pieces }))];
  }

  sendWelcome(peer, kid) {
    this.welcome(kid).forEach((message) => this.lan.send(peer, message));
  }

  /* Guest: a welcome, then its `more` world lines. */
  guestWorld(message) {
    if (message.t === "welcome") {
      const more = Math.max(0, Math.floor(Number(message.more) || 0));
      this.incoming = { welcome: { ...message, world: Array.isArray(message.world) ? message.world.slice() : [] }, left: more };
    } else if (this.incoming && Array.isArray(message.pieces)) {
      this.incoming.welcome.world.push(...message.pieces);
      this.incoming.left -= 1;
    } else {
      return;
    }
    if (this.incoming.left > 0) return;
    const { welcome } = this.incoming;
    this.incoming = null;
    this.guestWelcome(welcome);
  }

  updateRoster() {
    const kids = [this.kid];
    this.peers.forEach((kid) => { if (!kids.includes(kid)) kids.push(kid); });
    this.roster = kids;
    this.lan.broadcast({ t: "peers", roster: kids });
    this.lab.renderCrew();
  }

  /* A guest's request: through the same sequencer as the host's own changes. */
  hostRequest(peer, message) {
    const kid = this.peers.get(peer);
    if (!kid || !message || typeof message.id !== "string") return;
    const result = this.lab.sequencer.submit(kid, { id: message.id, op: message.op });
    if (result.t !== "apply") {
      this.lan.send(peer, { t: "reject", req: result.req, why: result.why });
      return;
    }
    this.lab.showOp(result.op, result.inverse);
    this.lab.afterRemoteOp(result.op);
    this.broadcastApply(result);
  }

  /* After any applied change on the host: every guest gets it, in order. */
  broadcastApply(result) {
    if (this.role !== "host" || !this.peers.size) return;
    this.lan.broadcast({ t: "apply", seq: result.seq, by: result.by, req: result.req, op: result.op });
  }

  /* ---------- joining ---------- */

  async join(service) {
    if (!this.lan.available || !service) return false;
    this.stopLooking();
    const peer = await this.lan.join(service);
    if (!peer) return false;
    this.role = "guest";
    this.hostInfo = { kid: service.kid, world: service.world, name: service.world, peer };
    this.pending.clear();
    this.undo.clear();
    this.lan.send(peer, { t: "hello", proto: PROTO, cat: CATALOG_ID, kid: this.kid });
    return true;
  }

  leave() {
    if (this.role !== "guest") return;
    if (this.hostInfo.peer) this.lan.send(this.hostInfo.peer, { t: "bye" });
    this.lan.leave();
    if (this.lost) this.stopLooking();
    this.endGuest();
  }

  /* The link to the host dropped (wifi, distance): keep the plate as it is and
     look for that world again for a while; then go home (D9). */
  lostHost() {
    const info = this.hostInfo;
    this.client = null;
    this.incoming = null;
    this.pending.clear();
    this.hostInfo = { ...info, peer: null };
    clearTimeout(this.lost && this.lost.timer);
    this.lost = { kid: info.kid, world: info.world, timer: setTimeout(() => this.giveUp(), this.retryMs) };
    this.lab.connectionLost(info.kid);
    this.startLooking();
  }

  async rejoin(service) {
    if (this.rejoining) return;
    this.rejoining = true;
    this.stopLooking();
    const peer = await this.lan.join(service);
    this.rejoining = false;
    if (!this.lost) {
      if (peer) this.lan.leave();
      return;
    }
    if (!peer) {
      this.startLooking();
      return;
    }
    clearTimeout(this.lost.timer);
    this.lost = null;
    this.hostInfo.peer = peer;
    /* The welcome brings a fresh copy; own undo stays (its checks still hold). */
    this.lan.send(peer, { t: "hello", proto: PROTO, cat: CATALOG_ID, kid: this.kid });
  }

  giveUp() {
    if (!this.lost) return;
    const kid = this.lost.kid;
    this.stopLooking();
    this.endGuest();
    this.lab.sessionEnded("closed", kid);
  }

  endGuest() {
    if (this.lost) clearTimeout(this.lost.timer);
    this.lost = null;
    this.role = null;
    this.client = null;
    this.incoming = null;
    this.hostInfo = null;
    this.pending.clear();
    this.undo.clear();
    this.roster = [];
  }

  guestWelcome(message) {
    const world = Array.isArray(message.world) ? message.world : [];
    this.hostInfo.kid = typeof message.host === "string" ? message.host : this.hostInfo.kid;
    this.hostInfo.name = typeof message.name === "string" ? message.name : this.hostInfo.name;
    this.roster = Array.isArray(message.roster) ? message.roster.filter((k) => typeof k === "string") : [];
    this.pending.clear();
    this.lab.loadShared(world);
    this.client = createClient({ world: this.lab.pieces, seq: Number(message.seq) || 0 });
    this.lab.renderCrew();
    this.lab.sharedChanged();
  }

  guestApply(message) {
    if (!this.client) return;
    const result = this.client.apply(message);
    if (result === "stale") return;
    if (result === "resync") {
      this.lan.send(this.hostInfo.peer, { t: "resync" });
      return;
    }
    this.lab.showOp(message.op, result);
    this.lab.afterRemoteOp(message.op);
    const mine = this.pending.get(message.req);
    if (mine) {
      this.pending.delete(message.req);
      if (message.by === this.kid) this.undo.push(result);
      this.lab.ownChangeApplied(message.op, mine);
    }
    this.lab.updateUndoUI();
  }

  guestReject(message) {
    const op = this.pending.get(message.req);
    if (!op) return;
    this.pending.delete(message.req);
    this.lab.ownChangeRefused(op, message.why);
  }

  /* ---------- changes from this tablet ---------- */

  /* Guest: send the op to the host; it shows when the host's change comes back. */
  request(op, meta = {}) {
    if (!this.hostInfo || !this.hostInfo.peer) return null;
    const id = `${this.kid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    this.pending.set(id, { ...op, meta });
    this.lan.send(this.hostInfo.peer, { t: "req", id, op });
    return { pending: true, id };
  }

  /* Host: remember the inverse of the host kid's own change. */
  applied(result) {
    if (this.role === "host" && result.by === this.kid) this.undo.push(result.inverse);
    this.broadcastApply(result);
  }

  /* Own last change only; refused once a sibling changed that brick (D6). */
  undoLast() {
    const inverse = this.undo.pop();
    if (!inverse) return false;
    if (this.role === "guest") {
      this.request(inverse, { undo: true });
      return true;
    }
    const result = this.lab.sequencer.submit(this.kid, { id: `undo-${Date.now().toString(36)}`, op: inverse });
    if (result.t !== "apply") {
      this.lab.ownChangeRefused(inverse, result.why, true);
      return true;
    }
    this.lab.showOp(result.op, result.inverse);
    this.lab.afterRemoteOp(result.op);
    this.broadcastApply(result);
    return true;
  }

  /* ---------- wire ---------- */

  onMessage(peer, message) {
    if (this.role === "host") {
      if (message.t === "hello") this.hostHello(peer, message);
      else if (message.t === "req") this.hostRequest(peer, message);
      else if (message.t === "resync" && this.peers.has(peer)) this.sendWelcome(peer, this.peers.get(peer));
      else if (message.t === "bye") this.lan.close(peer);
      return;
    }
    if (this.role !== "guest" || peer !== this.hostInfo.peer) return;
    if (message.t === "welcome" || message.t === "world") this.guestWorld(message);
    else if (message.t === "apply") this.guestApply(message);
    else if (message.t === "reject") this.guestReject(message);
    else if (message.t === "peers") {
      if (!this.client) return; /* the welcome carries the first roster */
      const before = this.roster;
      this.roster = Array.isArray(message.roster) ? message.roster.filter((k) => typeof k === "string") : [];
      this.roster.filter((k) => !before.includes(k) && k !== this.kid).forEach((k) => this.lab.crewToast(k, true));
      before.filter((k) => !this.roster.includes(k) && k !== this.kid).forEach((k) => this.lab.crewToast(k, false));
      this.lab.renderCrew();
    } else if (message.t === "refuse") {
      const why = message.why;
      this.lan.leave();
      this.endGuest();
      this.lab.sessionEnded(why === "proto" ? "proto" : "closed");
    } else if (message.t === "bye") {
      const host = this.hostInfo.kid;
      this.lan.leave();
      this.endGuest();
      this.lab.sessionEnded("closed", host);
    }
  }

  onPeer(peer, open) {
    if (open) return;
    if (this.role === "host" && this.peers.has(peer)) {
      const kid = this.peers.get(peer);
      this.peers.delete(peer);
      const stillHere = Array.from(this.peers.values()).includes(kid);
      this.updateRoster();
      if (!stillHere) this.lab.crewToast(kid, false);
      if (!this.peers.size) this.lan.keepAwake(false);
      this.lab.sharedChanged();
    } else if (this.role === "guest" && this.hostInfo && peer === this.hostInfo.peer) {
      this.lostHost();
    }
  }

  snapshot() {
    return {
      role: this.role,
      shared: this.shared,
      roster: this.roster.slice(),
      peers: this.peers.size,
      seq: this.role === "guest" ? (this.client ? this.client.seq : 0) : (this.lab.sequencer ? this.lab.sequencer.seq : 0),
      pending: this.pending.size,
      lost: !!this.lost,
      undo: this.undo.size,
      joinable: this.joinable().map((s) => ({ id: s.id, kid: s.kid, world: s.world })),
    };
  }

  dispose() {
    if (this.role === "host") this.stopHosting();
    if (this.role === "guest") this.leave();
    this.stopLooking();
    this.offs.forEach((off) => off());
  }
}
