const express = require('express');
const Docker = require('dockerode');
const httpProxy = require('http-proxy');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// ── Config ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const IMAGE_NAME = 'code-sandbox';
const CONTAINER_PREFIX = 'sandbox-';
const PORT_RANGE_START = 9000;
const PORT_RANGE_END = 9100;
const PROJECTS_DIR = path.resolve(__dirname, 'projects');

// ── Docker client ───────────────────────────────────────────────────
const docker = new Docker(); // connects via /var/run/docker.sock

// ── In-memory sandbox registry ──────────────────────────────────────
// Map<sandboxId, { containerId, port, projectId, createdAt }>
const sandboxes = new Map();
const usedPorts = new Set();

// ── Reverse proxy (single instance, shared for HTTP + WebSocket) ────
const proxy = httpProxy.createProxyServer({});
proxy.on('error', (err, req, res) => {
  console.error('[proxy] Error:', err.message);
  if (res && res.writeHead) {
    res.writeHead(502);
    res.end('Proxy error');
  }
});

// ── Helpers ─────────────────────────────────────────────────────────

function findAvailablePort() {
  for (let p = PORT_RANGE_START; p <= PORT_RANGE_END; p++) {
    if (!usedPorts.has(p)) return p;
  }
  return null;
}

function projectDirExists(projectId) {
  const dir = path.join(PROJECTS_DIR, projectId);
  return fs.existsSync(dir) ? dir : null;
}

// Extract port number from a /proxy/<port>/... URL
function extractProxyPort(url) {
  const match = url.match(/^\/proxy\/(\d+)/);
  return match ? match[1] : null;
}

// Strip the /proxy/<port> prefix so code-server sees clean paths
function stripProxyPrefix(url) {
  return url.replace(/^\/proxy\/\d+/, '') || '/';
}

async function waitForReady(port, maxWaitMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (res.ok) return true;
    } catch {
      // not ready yet
    }
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}

// ── Express app ─────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// Bypass ngrok free tier warning + disable iframe restrictions
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  res.removeHeader('X-Frame-Options');
  res.setHeader('Content-Security-Policy', "frame-ancestors *");
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ dest: path.join(__dirname, 'tmp_uploads/') });

// ─────────────────────────────────────────────────────────────────────
// PROXY:  /proxy/:port/*  — reverse proxy HTTP requests to containers
// This MUST be before other routes so it catches all sub-paths
// ─────────────────────────────────────────────────────────────────────
app.all('/proxy/:port/*', (req, res) => {
  const port = req.params.port;
  req.url = stripProxyPrefix(req.originalUrl);
  proxy.web(req, res, { target: `http://127.0.0.1:${port}`, changeOrigin: true });
});

app.all('/proxy/:port', (req, res) => {
  const port = req.params.port;
  req.url = '/';
  proxy.web(req, res, { target: `http://127.0.0.1:${port}`, changeOrigin: true });
});

// ─────────────────────────────────────────────────────────────────────
// API:  POST /api/upload-project   — upload a custom folder
// ─────────────────────────────────────────────────────────────────────
app.post('/api/upload-project', upload.array('files'), (req, res) => {
  try {
    const paths = req.body.paths;
    const pathList = Array.isArray(paths) ? paths : [paths];

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const customId = `custom-${uuidv4().slice(0, 8)}`;
    const projectDir = path.join(PROJECTS_DIR, customId);

    req.files.forEach((file, index) => {
      const relPath = pathList[index] || file.originalname;
      const targetPath = path.join(projectDir, relPath);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.renameSync(file.path, targetPath);
    });

    res.json({ projectId: customId });
  } catch (err) {
    console.error('[sandbox] Upload failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────
// API:  POST /api/sandbox   — create a new sandbox
// Body: { "projectId": "project-1" }
// ─────────────────────────────────────────────────────────────────────
app.post('/api/sandbox', async (req, res) => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const projectDir = projectDirExists(projectId);
    if (!projectDir) {
      return res.status(404).json({ error: `Project "${projectId}" not found` });
    }

    // Check if a sandbox already exists for this project
    for (const [id, meta] of sandboxes) {
      if (meta.projectId === projectId) {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        return res.status(200).json({
          sandboxId: id,
          projectId: meta.projectId,
          port: meta.port,
          url: `${baseUrl}/proxy/${meta.port}/?folder=/home/coder/project`,
          existing: true,
        });
      }
    }

    const hostPort = findAvailablePort();
    if (!hostPort) {
      return res.status(503).json({ error: 'No available ports — too many active sandboxes' });
    }

    const sandboxId = uuidv4().slice(0, 8);
    usedPorts.add(hostPort);

    // Create and start the container
    // Let the Dockerfile ENTRYPOINT handle all code-server args
    const container = await docker.createContainer({
      Image: IMAGE_NAME,
      name: `${CONTAINER_PREFIX}${sandboxId}`,
      ExposedPorts: { '8080/tcp': {} },
      HostConfig: {
        PortBindings: {
          '8080/tcp': [{ HostPort: String(hostPort) }],
        },
        Binds: [
          `${projectDir}:/home/coder/project`,
        ],
      },
    });

    await container.start();

    sandboxes.set(sandboxId, {
      containerId: container.id,
      port: hostPort,
      projectId,
      createdAt: new Date().toISOString(),
    });

    console.log(`[sandbox] Created ${sandboxId} → :${hostPort}  (project: ${projectId})`);

    // Wait for code-server to be ready
    const ready = await waitForReady(hostPort);
    if (!ready) {
      console.warn(`[sandbox] Warning: ${sandboxId} may not be fully ready`);
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    res.status(201).json({
      sandboxId,
      projectId,
      port: hostPort,
      url: `${baseUrl}/proxy/${hostPort}/?folder=/home/coder/project`,
    });
  } catch (err) {
    console.error('[sandbox] Create failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────
// API:  GET /api/sandbox   — list active sandboxes
// ─────────────────────────────────────────────────────────────────────
app.get('/api/sandbox', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const list = [];
  for (const [id, meta] of sandboxes) {
    list.push({
      sandboxId: id,
      ...meta,
      url: `${baseUrl}/proxy/${meta.port}/?folder=/home/coder/project`,
    });
  }
  res.json(list);
});

// ─────────────────────────────────────────────────────────────────────
// API:  DELETE /api/sandbox/:id   — destroy a sandbox
// ─────────────────────────────────────────────────────────────────────
app.delete('/api/sandbox/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const meta = sandboxes.get(id);

    if (!meta) {
      return res.status(404).json({ error: 'Sandbox not found' });
    }

    const container = docker.getContainer(meta.containerId);

    try {
      await container.stop();
    } catch {
      // already stopped — that's fine
    }

    await container.remove({ force: true });

    usedPorts.delete(meta.port);
    sandboxes.delete(id);

    console.log(`[sandbox] Destroyed ${id}`);
    res.json({ message: `Sandbox ${id} destroyed` });
  } catch (err) {
    console.error('[sandbox] Destroy failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────
// EMBED:  GET /sandbox/:id   — serves a full-page iframe wrapper
// ─────────────────────────────────────────────────────────────────────
app.get('/sandbox/:id', (req, res) => {
  const meta = sandboxes.get(req.params.id);
  if (!meta) {
    return res.status(404).send('Sandbox not found');
  }

  // iframe points to /proxy/PORT on the SAME origin — no cross-port issues
  const codeServerUrl = `${req.protocol}://${req.get('host')}/proxy/${meta.port}/?folder=/home/coder/project`;

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sandbox — ${meta.projectId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #1e1e1e; overflow: hidden; }
    .toolbar {
      height: 40px;
      background: #0d1117;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      border-bottom: 1px solid #30363d;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #e6edf3;
      font-size: 0.85rem;
    }
    .toolbar .info { opacity: 0.7; }
    .toolbar a {
      color: #58a6ff;
      text-decoration: none;
      font-weight: 500;
    }
    .toolbar a:hover { text-decoration: underline; }
    iframe {
      width: 100vw;
      height: calc(100vh - 40px);
      border: none;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <span class="info">📦 ${meta.projectId} — sandbox ${req.params.id}</span>
    <a href="/">← Back to projects</a>
  </div>
  <iframe src="${codeServerUrl}" allow="clipboard-read; clipboard-write"></iframe>
</body>
</html>`);
});

// ── Graceful shutdown — destroy all containers ──────────────────────
async function cleanup() {
  console.log('\n[sandbox] Shutting down — destroying all containers...');
  for (const [id, meta] of sandboxes) {
    try {
      const container = docker.getContainer(meta.containerId);
      await container.stop().catch(() => { });
      await container.remove({ force: true });
      console.log(`[sandbox]   Destroyed ${id}`);
    } catch {
      // ignore
    }
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// ── Start ─────────────────────────────────────────────────────────
// CRITICAL: Capture the server instance so we can bind WebSocket upgrades
const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║   VS Code Sandbox Server                       ║
║   http://localhost:${PORT}                        ║
║                                                ║
║   Docker image : ${IMAGE_NAME.padEnd(28)}║
║   Projects dir : ./projects/                   ║
║   Port range   : ${PORT_RANGE_START}–${PORT_RANGE_END}                       ║
╚════════════════════════════════════════════════╝
  `);
});

// CRITICAL: Forward WebSocket upgrade requests to the proxy
// Without this, VS Code kills the connection immediately
server.on('upgrade', (req, socket, head) => {
  const port = extractProxyPort(req.url);
  if (port) {
    req.url = stripProxyPrefix(req.url);
    proxy.ws(req, socket, head, { target: `http://127.0.0.1:${port}`, changeOrigin: true });
  }
});
