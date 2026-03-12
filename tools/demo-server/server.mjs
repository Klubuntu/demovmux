import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import NodeMediaServer from 'node-media-server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const MEDIA_DIR = path.join(ROOT, 'media');
const RUNTIME_CONFIG_PATH = path.join(PUBLIC_DIR, 'runtime-config.json');

const RTMP_PORT = Number(process.env.RTMP_PORT ?? 1935);
const HTTP_PORT = Number(process.env.HTTP_PORT ?? 8000);
const INFO_PORT = Number(process.env.INFO_PORT ?? 8010);
const STREAM_APP = process.env.STREAM_APP ?? 'live';
const STREAM_KEY = process.env.STREAM_KEY ?? 'demo';
const transcoders = new Map();

function resolveFfmpegPath() {
  const envPath = process.env.FFMPEG_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  const result = spawnSync('bash', ['-lc', `command -v ${envPath || 'ffmpeg'}`], {
    encoding: 'utf8',
  });

  const resolved = result.stdout?.trim();
  if (resolved) return resolved;
  return envPath || 'ffmpeg';
}

const FFMPEG_PATH = resolveFfmpegPath();

fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.mkdirSync(MEDIA_DIR, { recursive: true });

function getLanHosts() {
  const hosts = new Set(['127.0.0.1', 'localhost']);
  const nets = os.networkInterfaces();
  for (const values of Object.values(nets)) {
    for (const net of values ?? []) {
      if (net.family === 'IPv4' && !net.internal) hosts.add(net.address);
    }
  }
  return [...hosts];
}

function buildUrls(host, streamKey = STREAM_KEY) {
  return {
    publishUrl: `rtmp://${host}:${RTMP_PORT}/${STREAM_APP}/${streamKey}`,
    playUrl: `http://${host}:${HTTP_PORT}/${STREAM_APP}/${streamKey}/index.m3u8`,
    flvUrl: `http://${host}:${HTTP_PORT}/${STREAM_APP}/${streamKey}.flv`,
    infoUrl: `http://${host}:${INFO_PORT}`,
  };
}

function writeRuntimeConfig(host) {
  const urls = buildUrls(host);
  const runtimeConfig = {
    host,
    rtmpPort: RTMP_PORT,
    httpPort: HTTP_PORT,
    infoPort: INFO_PORT,
    streamApp: STREAM_APP,
    streamKey: STREAM_KEY,
    publishUrl: urls.publishUrl,
    playUrl: urls.playUrl,
    flvUrl: urls.flvUrl,
    ffmpegCommand: `ffmpeg -re -stream_loop -1 -i ./sample.mp4 -c:v libx264 -preset veryfast -tune zerolatency -c:a aac -ar 48000 -b:a 128k -f flv ${urls.publishUrl}`,
  };
  fs.writeFileSync(RUNTIME_CONFIG_PATH, JSON.stringify(runtimeConfig, null, 2));
}

function serveInfo() {
  const server = http.createServer((req, res) => {
    const requestedPath = req.url === '/' ? '/index.html' : req.url;
    const filePath = path.join(PUBLIC_DIR, decodeURIComponent(requestedPath));
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }

      const ext = path.extname(filePath);
      const types = {
        '.html': 'text/html; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
      };

      res.writeHead(200, { 'Content-Type': types[ext] ?? 'application/octet-stream' });
      res.end(data);
    });
  });

  server.listen(INFO_PORT, '0.0.0.0', () => {});

  return server;
}

function getStreamOutput(streamPath) {
  const cleanPath = streamPath.replace(/^\//, '');
  const outputDir = path.join(MEDIA_DIR, cleanPath);
  const playlistPath = path.join(outputDir, 'index.m3u8');
  return { outputDir, playlistPath };
}

function startTranscoder(streamPath) {
  if (transcoders.has(streamPath)) return;

  const { outputDir, playlistPath } = getStreamOutput(streamPath);
  fs.mkdirSync(outputDir, { recursive: true });

  const inputUrl = `rtmp://127.0.0.1:${RTMP_PORT}${streamPath}`;
  const args = [
    '-y',
    '-loglevel', 'warning',
    '-rtmp_live', 'live',
    '-i', inputUrl,
    '-map', '0:v:0',
    '-map', '0:a:0?',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-tune', 'zerolatency',
    '-pix_fmt', 'yuv420p',
    '-profile:v', 'main',
    '-g', '48',
    '-sc_threshold', '0',
    '-c:a', 'aac',
    '-ar', '48000',
    '-b:a', '128k',
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '6',
    '-hls_flags', 'delete_segments+append_list+omit_endlist+independent_segments',
    playlistPath,
  ];

  const child = spawn(FFMPEG_PATH, args, {
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    const line = String(chunk).trim();
    if (line) console.log(`[ffmpeg ${streamPath}] ${line}`);
  });

  child.on('exit', (code, signal) => {
    transcoders.delete(streamPath);
    console.log(`🧹 HLS transcoder stopped for ${streamPath} (code=${code ?? 'null'}, signal=${signal ?? 'none'})`);
  });

  transcoders.set(streamPath, child);
  console.log(`🎬 HLS transcoder started for ${streamPath}`);
}

function stopTranscoder(streamPath) {
  const child = transcoders.get(streamPath);
  if (!child) return;
  child.kill('SIGTERM');
  transcoders.delete(streamPath);
}

const host = getLanHosts().find((item) => item !== 'localhost') ?? '127.0.0.1';
writeRuntimeConfig(host);

const config = {
  logType: 2,
  rtmp: {
    port: RTMP_PORT,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60,
  },
  http: {
    port: HTTP_PORT,
    mediaroot: MEDIA_DIR,
    allow_origin: '*',
  },
};

const nms = new NodeMediaServer(config);
const infoServer = serveInfo();

nms.on('postPublish', (id, streamPath) => {
  console.log(`▶️  Publish started: ${streamPath}`);
  setTimeout(() => startTranscoder(streamPath), 400);
});

nms.on('donePublish', (id, streamPath) => {
  console.log(`⏹️  Publish ended: ${streamPath}`);
  stopTranscoder(streamPath);
});

nms.on('postPlay', (id, streamPath) => {
  console.log(`👀 Playback started: ${streamPath}`);
});

nms.run();

const urls = buildUrls(host);
console.log('');
console.log('════════════════════════════════════════════════════════════');
console.log(' demo-server · vMUX IPTV helper');
console.log('════════════════════════════════════════════════════════════');
console.log(`RTMP publish : ${urls.publishUrl}`);
console.log(`HLS playback : ${urls.playUrl}`);
console.log(`HTTP-FLV     : ${urls.flvUrl}`);
console.log(`Info page    : ${urls.infoUrl}`);
console.log('');
console.log('OBS / encoder:');
console.log(`  Server     : rtmp://${host}:${RTMP_PORT}/${STREAM_APP}`);
console.log(`  Stream key : ${STREAM_KEY}`);
console.log('');
console.log('vMUX channel settings:');
console.log(`  Adres strumienia  = ${urls.playUrl}`);
console.log('  Protokół strumienia = HLS');
console.log('');
console.log('FFmpeg test command:');
console.log(`  ffmpeg -re -stream_loop -1 -i ./sample.mp4 -c:v libx264 -preset veryfast -tune zerolatency -c:a aac -ar 48000 -b:a 128k -f flv ${urls.publishUrl}`);
console.log('════════════════════════════════════════════════════════════');
console.log('');

const shutdown = (signal) => {
  console.log(`\n${signal} received, closing demo-server...`);
  for (const [streamPath] of transcoders) stopTranscoder(streamPath);
  infoServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 300).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
