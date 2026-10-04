/* Building together on the home wifi (docs/plans/2026-10-04-brick-lab-multiplayer/
   D4, D5, D6, D9; slices 05–06). The session logic between Brick Lab and the
   LAN session; the lab keeps the scene, this keeps who is connected and in
   what order changes happen.

   Host (the tablet whose world is open): every guest request goes through the
   lab's sequencer, automatically, and every applied change is sent to all
   guests. Guest: requests go to the host; nothing changes on the plate until
   the host's numbered change comes back. Nobody confirms anything.

   Messages (one JSON object per line):
     guest → host  hello {proto, kid} · req {id, op} · resync · bye
     host → guest  welcome {world, seq, roster, name, host} · refuse {why}
                   apply {seq, by, req, op} · reject {req, why} · peers {roster} · bye */
import { PROTO, createClient, createUndo } from "./brick-share.js";

export const GAME = "bricklab";

export class BrickTogether {
  /* lab: the BrickLabRuntime; lan: a lan-session; kid: this tablet's kid id. */
  constructor(lab, lan, kid) {
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
    this.hostInfo = null; /* guest: { kid, name, peer } */
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
    this.found.set(service.id, { ...service, kid: txt.kid || "", world: txt.world || "", proto: Number(txt.proto) || 0 });
    this.lab.renderJoin();
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
    if (Number(message.proto) !== PROTO) {
      this.lan.send(peer, { t: "refuse", why: "proto" });
      setTimeout(() => this.lan.close(peer), 200);
      return;
    }
    const kid = typeof message.kid === "string" ? message.kid.slice(0, 64) : "";
    if (!kid) { this.lan.close(peer); return; }
    /* The same kid on a second connection replaces the first (D9). */
    for (const [other, otherKid] of this.peers) {
      if (otherKid === kid && other !== peer) {
        this.peers.delete(other);
        this.lan.close(other);
      }
    }
    const fresh = !Array.from(this.peers.values()).includes(kid);
    this.peers.set(peer, kid);
    /* The world first, then everyone hears the new roster. */
    this.lan.send(peer, this.welcome(kid));
    this.updateRoster();
    if (fresh) this.lab.crewToast(kid, true);
    this.lan.keepAwake(true);
    this.lab.sharedChanged();
  }

  welcome(joining) {
    const roster = this.roster.slice();
    if (joining && !roster.includes(joining)) roster.push(joining);
    return {
      t: "welcome",
      world: Array.from(this.lab.pieces.values()),
      seq: this.lab.sequencer.seq,
      roster,
      name: this.lab.currentWorldName(),
      host: this.kid,
    };
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
    this.hostInfo = { kid: service.kid, name: service.world, peer };
    this.pending.clear();
    this.undo.clear();
    this.lan.send(peer, { t: "hello", proto: PROTO, kid: this.kid });
    return true;
  }

  leave() {
    if (this.role !== "guest") return;
    this.lan.send(this.hostInfo.peer, { t: "bye" });
    this.lan.leave();
    this.endGuest();
  }

  endGuest() {
    this.role = null;
    this.client = null;
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
      else if (message.t === "resync" && this.peers.has(peer)) this.lan.send(peer, this.welcome(this.peers.get(peer)));
      else if (message.t === "bye") this.lan.close(peer);
      return;
    }
    if (this.role !== "guest" || peer !== this.hostInfo.peer) return;
    if (message.t === "welcome") this.guestWelcome(message);
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
      const host = this.hostInfo.kid;
      this.endGuest();
      this.lab.sessionEnded("lost", host);
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
