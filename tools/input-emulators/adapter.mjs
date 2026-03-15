import dgram from 'node:dgram';
import http from 'node:http';

const cfg = JSON.parse(process.env.ADAPTER_CONFIG || '{}');
const {
  id,
  label,
  protocol,
  type,
  mode = 'synthetic',
  targetHost,
  targetPort,
  ingestHost = '0.0.0.0',
  ingestPort,
  statusPort,
  bitrateMbps = 4,
  jitterPct = 0.03,
  lossPct = 0.001,
  startupDelayMs = 200,
} = cfg;

if (!id || !targetHost || !targetPort || !statusPort) {
  console.error('[adapter] Missing required config:', cfg);
  process.exit(1);
}

// relay requires ingestPort; physical requires ingestPort for monitoring
if ((mode === 'relay' || mode === 'physical') && !ingestPort) {
  console.error(`[adapter] mode="${mode}" requires ingestPort`);
  process.exit(1);
}

const egressSocket = mode !== 'physical' ? dgram.createSocket('udp4') : null;
// For relay: forward incoming traffic to target.
// For physical: listen-only (monitor) – no egress socket, no synthetic generation.
const ingressSocket = (mode === 'relay' || mode === 'physical') ? dgram.createSocket('udp4') : null;
const startAt = Date.now();
const TICK_MS = 100;
const PACKET_SIZE = 188;
const BITS_PER_PACKET = PACKET_SIZE * 8;
const DEVICE_TTL_MS = 15_000;

let continuityCounter = 0;
let sentPackets = 0;
let receivedPackets = 0;
let receivedBytes = 0;
let droppedPackets = 0;
let sendErrors = 0;
let tickHandle = null;
const devices = new Map();

const bitrateBps = Math.max(0.2, Number(bitrateMbps)) * 1_000_000;
const packetsPerTickBase = Math.max(1, Math.floor((bitrateBps * (TICK_MS / 1000)) / BITS_PER_PACKET));

function buildTsPacket() {
  const packet = Buffer.alloc(PACKET_SIZE, 0xff);
  packet[0] = 0x47;
  packet[1] = 0x40 | ((continuityCounter >> 4) & 0x1f);
  packet[2] = continuityCounter & 0xff;
  packet[3] = 0x10 | (continuityCounter & 0x0f);
  continuityCounter = (continuityCounter + 1) & 0x0f;
  return packet;
}

function maybeDrop() {
  return Math.random() < lossPct;
}

function dynamicPacketsPerTick() {
  const delta = (Math.random() * 2 - 1) * jitterPct;
  return Math.max(1, Math.floor(packetsPerTickBase * (1 + delta)));
}

function emitTick() {
  const packets = dynamicPacketsPerTick();
  for (let i = 0; i < packets; i += 1) {
    if (maybeDrop()) {
      droppedPackets += 1;
      continue;
    }
    const packet = buildTsPacket();
    egressSocket.send(packet, targetPort, targetHost, (error) => {
      if (error) sendErrors += 1;
    });
    sentPackets += 1;
  }
}

function packetCountFor(datagramLength) {
  return Math.max(1, Math.floor(datagramLength / PACKET_SIZE));
}

function updateDevice(rinfo, datagramLength) {
  const key = `${rinfo.address}:${rinfo.port}`;
  const now = Date.now();
  const row = devices.get(key) ?? {
    id: key,
    address: rinfo.address,
    port: rinfo.port,
    packets: 0,
    bytes: 0,
    firstSeenAt: now,
    lastSeenAt: now,
  };
  row.packets += packetCountFor(datagramLength);
  row.bytes += datagramLength;
  row.lastSeenAt = now;
  devices.set(key, row);
}

function pruneDevices() {
  const now = Date.now();
  for (const [key, row] of devices) {
    if (now - row.lastSeenAt > DEVICE_TTL_MS) devices.delete(key);
  }
}

function relayDatagram(msg, rinfo) {
  const packets = packetCountFor(msg.length);
  receivedPackets += packets;
  receivedBytes += msg.length;
  updateDevice(rinfo, msg.length);

  // physical mode: monitor only, do not forward
  if (mode === 'physical') return;

  if (maybeDrop()) {
    droppedPackets += packets;
    return;
  }

  egressSocket.send(msg, targetPort, targetHost, (error) => {
    if (error) sendErrors += 1;
  });
  sentPackets += packets;
}

function isMulticast(host) {
  const first = Number(String(host).split('.')[0]);
  return first >= 224 && first <= 239;
}

if (egressSocket) {
  egressSocket.on('error', (error) => {
    console.error(`[${id}] socket error:`, error.message);
  });

  egressSocket.bind(0, '0.0.0.0', () => {
    if (isMulticast(targetHost)) {
      try {
        egressSocket.setMulticastTTL(32);
      } catch {
        // noop
      }
    }

    if (mode === 'synthetic') {
      setTimeout(() => {
        tickHandle = setInterval(emitTick, TICK_MS);
      }, startupDelayMs);
    }
  });
}

if (ingressSocket) {
  ingressSocket.on('error', (error) => {
    console.error(`[${id}] ingest socket error:`, error.message);
  });

  ingressSocket.on('message', (msg, rinfo) => {
    relayDatagram(msg, rinfo);
  });

  ingressSocket.bind(ingestPort, ingestHost, () => {
    console.log(`[${id}] ingest listening on udp://${ingestHost}:${ingestPort}`);
  });
}

setInterval(pruneDevices, 2_000).unref();

function getConnectedDevices() {
  const now = Date.now();
  return [...devices.values()]
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
    .map((d) => ({
      ...d,
      alive: now - d.lastSeenAt <= DEVICE_TTL_MS,
      lastSeenAgoMs: now - d.lastSeenAt,
    }));
}

const server = http.createServer((req, res) => {
  if (req.url !== '/status') {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const uptimeSec = Math.floor((Date.now() - startAt) / 1000);
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    id,
    label,
    mode,
    type,
    protocol,
    ingest: ingestPort ? `${ingestHost}:${ingestPort}` : null,
    target: mode === 'physical' ? null : `${targetHost}:${targetPort}`,
    bitrateMbps: mode === 'physical' ? null : bitrateMbps,
    jitterPct: mode === 'physical' ? null : jitterPct,
    lossPct: mode === 'physical' ? null : lossPct,
    receivedPackets,
    receivedBytes,
    sentPackets,
    droppedPackets,
    sendErrors,
    connectedDevices: getConnectedDevices(),
    uptimeSec,
  }));
});

server.listen(statusPort, '0.0.0.0', () => {
  const ingressPart = ingestPort ? ` | ingest udp://${ingestHost}:${ingestPort}` : '';
  const targetPart = mode === 'physical' ? ' [monitor only]' : ` -> ${targetHost}:${targetPort}`;
  console.log(`[${id}] running (${mode})${targetPart}${ingressPart} | status http://127.0.0.1:${statusPort}/status`);
});

function shutdown(signal) {
  if (tickHandle) clearInterval(tickHandle);
  server.close(() => {
    const closeIngress = () => {
      if (!ingressSocket) {
        console.log(`[${id}] stopped (${signal})`);
        process.exit(0);
        return;
      }
      ingressSocket.close(() => {
        console.log(`[${id}] stopped (${signal})`);
        process.exit(0);
      });
    };

    if (!egressSocket) {
      closeIngress();
      return;
    }
    egressSocket.close(() => {
      closeIngress();
    });
  });

  setTimeout(() => process.exit(0), 250).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
