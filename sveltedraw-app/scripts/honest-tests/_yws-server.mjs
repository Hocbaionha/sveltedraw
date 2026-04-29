// In-process y-websocket relay server for honest-tests. Spawned as a
// child process by collab-a1-convergence.mjs (and any future collab
// tests); prints "yws://localhost:PORT\n" on stdout when ready so the
// driver can read the bound port and forward it as ?collab= to the
// browser tabs.
//
// This is a minimal port of the canonical y-websocket server reference
// (yjs/y-websocket/bin/utils.cjs). It supports sync (full state +
// incremental updates) and awareness (per-client metadata gossip) for
// arbitrary rooms — that's all the editor uses. No persistence, no
// auth, no garbage collection of empty rooms.
//
// Run standalone for manual testing:
//   PORT=1234 node sveltedraw-app/scripts/honest-tests/_yws-server.mjs

import { WebSocketServer } from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import http from "node:http";

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

/**
 * Per-room state. Each room owns one Y.Doc + one Awareness instance,
 * and a Set of connected websockets that share the same doc/awareness.
 * Updates from any one socket are broadcast to all others (origin tag
 * keeps the sender from seeing its own write twice).
 */
class Room {
  constructor(name) {
    this.name = name;
    this.doc = new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.doc);
    this.awareness.setLocalState(null); // server doesn't participate
    this.clients = new Set();

    this.doc.on("update", (update, origin) => {
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MESSAGE_SYNC);
      syncProtocol.writeUpdate(enc, update);
      const msg = encoding.toUint8Array(enc);
      for (const c of this.clients) {
        if (c !== origin && c.readyState === 1) c.send(msg);
      }
    });

    this.awareness.on("update", ({ added, updated, removed }) => {
      const changed = added.concat(updated, removed);
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        enc,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed),
      );
      const msg = encoding.toUint8Array(enc);
      for (const c of this.clients) {
        if (c.readyState === 1) c.send(msg);
      }
    });
  }
}

const rooms = new Map();
const getRoom = (name) => {
  let r = rooms.get(name);
  if (!r) {
    r = new Room(name);
    rooms.set(name, r);
  }
  return r;
};

const httpServer = http.createServer();
const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws, req) => {
  const roomName = (req.url || "/").slice(1).split("?")[0] || "default";
  const room = getRoom(roomName);
  ws.binaryType = "arraybuffer";
  room.clients.add(ws);

  // Track which awareness clientIds belong to this socket so we can
  // remove them on disconnect (otherwise stale users linger forever).
  const ownedAwarenessIds = new Set();

  // 1) Sync step 1 — ask the client what it has so we can send deltas.
  {
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(enc, room.doc);
    ws.send(encoding.toUint8Array(enc));
  }
  // 2) Awareness snapshot — push current peers' state to the new client.
  const awarenessStates = room.awareness.getStates();
  if (awarenessStates.size > 0) {
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      enc,
      awarenessProtocol.encodeAwarenessUpdate(room.awareness, [
        ...awarenessStates.keys(),
      ]),
    );
    ws.send(encoding.toUint8Array(enc));
  }

  ws.on("message", (data) => {
    try {
      const dec = decoding.createDecoder(new Uint8Array(data));
      const messageType = decoding.readVarUint(dec);
      if (messageType === MESSAGE_SYNC) {
        const enc = encoding.createEncoder();
        encoding.writeVarUint(enc, MESSAGE_SYNC);
        syncProtocol.readSyncMessage(dec, enc, room.doc, ws);
        // readSyncMessage may write a sync step 2 / update reply; only
        // send back if there's actually content past the message-type tag.
        if (encoding.length(enc) > 1) {
          ws.send(encoding.toUint8Array(enc));
        }
      } else if (messageType === MESSAGE_AWARENESS) {
        const update = decoding.readVarUint8Array(dec);
        // Track the clientIds the client just claimed so we can clean
        // them up on disconnect.
        const before = new Set(room.awareness.getStates().keys());
        awarenessProtocol.applyAwarenessUpdate(room.awareness, update, ws);
        for (const id of room.awareness.getStates().keys()) {
          if (!before.has(id)) ownedAwarenessIds.add(id);
        }
      }
    } catch (err) {
      console.error("[yws-server] message handler:", err);
    }
  });

  ws.on("close", () => {
    room.clients.delete(ws);
    if (ownedAwarenessIds.size > 0) {
      awarenessProtocol.removeAwarenessStates(
        room.awareness,
        [...ownedAwarenessIds],
        ws,
      );
    }
  });

  ws.on("error", (err) => {
    console.error("[yws-server] socket error:", err.message);
  });
});

const port = Number(process.env.PORT ?? 0);
httpServer.listen(port, "127.0.0.1", () => {
  const addr = httpServer.address();
  // First line of stdout is the URL. Driver reads + parses this; any
  // other diagnostic logging goes to stderr.
  process.stdout.write(`yws://127.0.0.1:${addr.port}\n`);
});

// Graceful shutdown so the driver's child.kill() doesn't leak ports.
const shutdown = () => {
  for (const r of rooms.values()) {
    for (const c of r.clients) {
      try { c.close(); } catch { /* swallow */ }
    }
  }
  httpServer.close(() => process.exit(0));
  // Hard timeout in case ws connections won't close cleanly.
  setTimeout(() => process.exit(0), 1000).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
