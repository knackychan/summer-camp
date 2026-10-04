package com.summerquest.app;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.net.wifi.WifiManager;

import com.getcapacitor.JSObject;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.Reader;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Home-wifi sessions between Summer Quest tablets
 * (docs/plans/2026-10-04-brick-lab-multiplayer/ D1, slice 03).
 *
 * Game-neutral plumbing only: a tablet hosts a small TCP server and announces
 * it on the local network (NSD / mDNS); other tablets find it and connect.
 * Messages are single lines of UTF-8 text; a line over 64 KB drops that
 * peer. What the lines mean is entirely up to the web runtime.
 */
final class LanHub {
    interface Events {
        void emit(String name, JSObject data);
    }

    static final String SERVICE_TYPE = "_sqplay._tcp.";
    static final int LINE_MAX = 64 * 1024;
    private static final int CONNECT_TIMEOUT_MS = 5000;

    private final Context context;
    private final Events events;
    private final NsdManager nsd;
    private final WifiManager wifi;
    private final ExecutorService writer = Executors.newSingleThreadExecutor();
    private final Map<String, Peer> peers = new ConcurrentHashMap<>();
    private final AtomicInteger peerCount = new AtomicInteger();

    private ServerSocket server;
    private NsdManager.RegistrationListener registration;
    private NsdManager.DiscoveryListener discovery;
    private final ArrayDeque<NsdServiceInfo> toResolve = new ArrayDeque<>();
    private boolean resolving = false;
    private WifiManager.MulticastLock multicast;

    private static final class Peer {
        final String id;
        final Socket socket;
        final OutputStream out;

        Peer(String id, Socket socket) throws IOException {
            this.id = id;
            this.socket = socket;
            this.out = socket.getOutputStream();
        }
    }

    LanHub(Context context, Events events) {
        this.context = context.getApplicationContext();
        this.events = events;
        this.nsd = (NsdManager) this.context.getSystemService(Context.NSD_SERVICE);
        this.wifi = (WifiManager) this.context.getSystemService(Context.WIFI_SERVICE);
    }

    /* ---------- hosting ---------- */

    interface HostResult {
        void done(int port, String name, String error);
    }

    synchronized void host(String name, Map<String, String> txt, HostResult result) {
        stopHosting();
        try {
            server = new ServerSocket(0);
        } catch (IOException error) {
            result.done(0, null, "socket");
            return;
        }
        final ServerSocket listening = server;
        Thread accept = new Thread(() -> {
            while (!listening.isClosed()) {
                try {
                    Socket socket = listening.accept();
                    socket.setTcpNoDelay(true);
                    open("p" + peerCount.incrementAndGet(), socket);
                } catch (IOException error) {
                    break;
                }
            }
        }, "sq-lan-accept");
        accept.setDaemon(true);
        accept.start();

        if (nsd == null) {
            result.done(listening.getLocalPort(), name, null);
            return;
        }
        NsdServiceInfo info = new NsdServiceInfo();
        info.setServiceName(name);
        info.setServiceType(SERVICE_TYPE);
        info.setPort(listening.getLocalPort());
        for (Map.Entry<String, String> entry : txt.entrySet()) {
            try {
                info.setAttribute(entry.getKey(), entry.getValue());
            } catch (IllegalArgumentException ignored) {
                // an entry over 255 bytes is left out; the web side keeps them short
            }
        }
        acquireMulticast();
        registration = new NsdManager.RegistrationListener() {
            @Override public void onServiceRegistered(NsdServiceInfo registered) {
                result.done(listening.getLocalPort(), registered.getServiceName(), null);
            }
            @Override public void onRegistrationFailed(NsdServiceInfo failed, int code) {
                result.done(listening.getLocalPort(), name, "announce");
            }
            @Override public void onServiceUnregistered(NsdServiceInfo gone) {}
            @Override public void onUnregistrationFailed(NsdServiceInfo gone, int code) {}
        };
        nsd.registerService(info, NsdManager.PROTOCOL_DNS_SD, registration);
    }

    synchronized void stopHosting() {
        if (registration != null && nsd != null) {
            try { nsd.unregisterService(registration); } catch (RuntimeException ignored) {}
        }
        registration = null;
        if (server != null) {
            try { server.close(); } catch (IOException ignored) {}
        }
        server = null;
        closeAll();
        releaseMulticastIfIdle();
    }

    /* ---------- finding ---------- */

    synchronized void discover() {
        if (nsd == null || discovery != null) return;
        acquireMulticast();
        discovery = new NsdManager.DiscoveryListener() {
            @Override public void onDiscoveryStarted(String type) {}
            @Override public void onDiscoveryStopped(String type) {}
            @Override public void onStartDiscoveryFailed(String type, int code) {
                synchronized (LanHub.this) { discovery = null; }
                JSObject data = new JSObject();
                data.put("why", "discover");
                events.emit("lanError", data);
            }
            @Override public void onStopDiscoveryFailed(String type, int code) {}
            @Override public void onServiceFound(NsdServiceInfo found) {
                queueResolve(found);
            }
            @Override public void onServiceLost(NsdServiceInfo lost) {
                JSObject data = new JSObject();
                data.put("id", lost.getServiceName());
                events.emit("lanLost", data);
            }
        };
        nsd.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, discovery);
    }

    synchronized void stopDiscovery() {
        if (discovery != null && nsd != null) {
            try { nsd.stopServiceDiscovery(discovery); } catch (RuntimeException ignored) {}
        }
        discovery = null;
        toResolve.clear();
        releaseMulticastIfIdle();
    }

    /* Older Android resolves one service at a time. */
    private synchronized void queueResolve(NsdServiceInfo found) {
        toResolve.add(found);
        if (!resolving) resolveNext();
    }

    @SuppressWarnings("deprecation")
    private synchronized void resolveNext() {
        NsdServiceInfo next = toResolve.poll();
        if (next == null || nsd == null) { resolving = false; return; }
        resolving = true;
        nsd.resolveService(next, new NsdManager.ResolveListener() {
            @Override public void onResolveFailed(NsdServiceInfo info, int code) {
                resolveNext();
            }
            @Override public void onServiceResolved(NsdServiceInfo info) {
                JSObject data = new JSObject();
                data.put("id", info.getServiceName());
                data.put("name", info.getServiceName());
                data.put("host", info.getHost() == null ? "" : info.getHost().getHostAddress());
                data.put("port", info.getPort());
                JSObject txt = new JSObject();
                for (Map.Entry<String, byte[]> entry : info.getAttributes().entrySet()) {
                    byte[] value = entry.getValue();
                    txt.put(entry.getKey(), value == null ? "" : new String(value, StandardCharsets.UTF_8));
                }
                data.put("txt", txt);
                events.emit("lanFound", data);
                resolveNext();
            }
        });
    }

    /* ---------- joining ---------- */

    interface JoinResult {
        void done(String peer, String error);
    }

    void join(String host, int port, JoinResult result) {
        Thread connect = new Thread(() -> {
            Socket socket = new Socket();
            try {
                socket.connect(new InetSocketAddress(host, port), CONNECT_TIMEOUT_MS);
                socket.setTcpNoDelay(true);
                open("host", socket);
                result.done("host", null);
            } catch (IOException error) {
                try { socket.close(); } catch (IOException ignored) {}
                result.done(null, "connect");
            }
        }, "sq-lan-join");
        connect.setDaemon(true);
        connect.start();
    }

    void leave() {
        Peer host = peers.get("host");
        if (host != null) close(host);
    }

    /* ---------- lines ---------- */

    /* `peer` "*" sends to every connected peer. */
    void send(String peer, String line) {
        if (line == null || line.length() > LINE_MAX || line.indexOf('\n') >= 0) return;
        final byte[] bytes = (line + "\n").getBytes(StandardCharsets.UTF_8);
        writer.execute(() -> {
            for (Peer target : peers.values()) {
                if (!"*".equals(peer) && !target.id.equals(peer)) continue;
                try {
                    target.out.write(bytes);
                    target.out.flush();
                } catch (IOException error) {
                    close(target);
                }
            }
        });
    }

    void closePeer(String id) {
        Peer peer = peers.get(id);
        if (peer != null) close(peer);
    }

    private void open(String id, Socket socket) throws IOException {
        Peer existing = peers.get(id);
        if (existing != null) close(existing);
        final Peer peer = new Peer(id, socket);
        peers.put(id, peer);
        JSObject data = new JSObject();
        data.put("peer", id);
        events.emit("lanPeerOpen", data);
        Thread read = new Thread(() -> readLines(peer), "sq-lan-read-" + id);
        read.setDaemon(true);
        read.start();
    }

    private void readLines(Peer peer) {
        try {
            InputStream in = peer.socket.getInputStream();
            Reader reader = new InputStreamReader(in, StandardCharsets.UTF_8);
            StringBuilder line = new StringBuilder();
            char[] buffer = new char[4096];
            int read;
            while ((read = reader.read(buffer)) != -1) {
                for (int i = 0; i < read; i++) {
                    char c = buffer[i];
                    if (c == '\n') {
                        JSObject data = new JSObject();
                        data.put("peer", peer.id);
                        data.put("line", line.toString());
                        events.emit("lanLine", data);
                        line.setLength(0);
                    } else if (c != '\r') {
                        line.append(c);
                        if (line.length() > LINE_MAX) throw new IOException("line too long");
                    }
                }
            }
        } catch (IOException ignored) {
            // closed below
        }
        close(peer);
    }

    private void close(Peer peer) {
        if (!peers.remove(peer.id, peer)) return;
        try { peer.socket.close(); } catch (IOException ignored) {}
        JSObject data = new JSObject();
        data.put("peer", peer.id);
        events.emit("lanPeerClosed", data);
    }

    private void closeAll() {
        for (Peer peer : peers.values()) {
            if (!"host".equals(peer.id)) close(peer);
        }
    }

    /* ---------- multicast lock (some tablets drop mDNS without it) ---------- */

    private synchronized void acquireMulticast() {
        if (wifi == null) return;
        if (multicast == null) {
            multicast = wifi.createMulticastLock("summer-quest-lan");
            multicast.setReferenceCounted(false);
        }
        if (!multicast.isHeld()) multicast.acquire();
    }

    private synchronized void releaseMulticastIfIdle() {
        if (multicast != null && multicast.isHeld() && discovery == null && registration == null) multicast.release();
    }

    synchronized void shutdown() {
        stopDiscovery();
        stopHosting();
        leave();
        writer.shutdownNow();
        if (multicast != null && multicast.isHeld()) multicast.release();
    }
}
