const express = require('express');
const path = require('path');
const os = require('os');
const fs = require('fs');
const optimizer = require('./optimizer');
const converter = require('./converter');
const multer = require('multer');

let serverInstance = null;
let currentPort = 3456;

// Categorize network interfaces to detect hotspot vs normal WiFi
function getNetworkMode() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const iface of addrs) {
      if (iface.family !== 'IPv4' || iface.internal) continue;

      const lowerName = name.toLowerCase();
      const isHotspot =
        lowerName.includes('hosted') ||       // Windows Mobile Hotspot
        lowerName.includes('local area') ||    // Windows ICS
        iface.address.startsWith('192.168.137') || // Windows hotspot default
        iface.address.startsWith('172.20.');   // macOS Internet Sharing

      candidates.push({
        name,
        address: iface.address,
        netmask: iface.netmask,
        isHotspot,
      });
    }
  }

  // Prefer hotspot interface if one exists, otherwise first LAN
  const hotspot = candidates.find(c => c.isHotspot);
  if (hotspot) {
    return { mode: 'hotspot', ip: hotspot.address, interfaceName: hotspot.name, all: candidates };
  }

  const lan = candidates[0];
  if (lan) {
    return { mode: 'wifi', ip: lan.address, interfaceName: lan.name, all: candidates };
  }

  return { mode: 'offline', ip: '127.0.0.1', interfaceName: 'loopback', all: [] };
}

function getLanIp() {
  return getNetworkMode().ip;
}

function getServerUrl(port) {
  return `http://${getLanIp()}:${port || currentPort}`;
}

// Watch for IP changes (laptop switches network, hotspot on/off)
let lastIp = null;
let ipChangeCallbacks = [];

function onIpChange(callback) {
  ipChangeCallbacks.push(callback);
}

function startIpWatcher(intervalMs = 5000) {
  lastIp = getLanIp();
  setInterval(() => {
    const newIp = getLanIp();
    if (newIp !== lastIp) {
      const oldIp = lastIp;
      lastIp = newIp;
      for (const cb of ipChangeCallbacks) {
        cb({ oldIp, newIp, network: getNetworkMode() });
      }
    }
  }, intervalMs);
}

// Try a port, fall back to next available if taken
function findAvailablePort(startPort) {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();
    server.listen(startPort, () => {
      server.close(() => resolve(startPort));
    });
    server.on('error', () => {
      resolve(findAvailablePort(startPort + 1));
    });
  });
}

function startServer(port = 3456) {
  return new Promise(async (resolve, reject) => {
    const availablePort = await findAvailablePort(port);
    currentPort = availablePort;

    const app = express();

    // CORS for all routes — phones on the LAN need this
    app.use((req, res, next) => {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') return res.sendStatus(204);
      next();
    });

    // Serve 3D model files with proper MIME types and headers for AR viewers
    const modelsDir = path.join(__dirname, '..', '..', 'models');
    app.use('/models', express.static(modelsDir, {
      setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
          '.glb': 'model/gltf-binary',
          '.gltf': 'model/gltf+json',
          '.usdz': 'model/vnd.usdz+zip',
          '.bin': 'application/octet-stream',
        };
        if (mimeTypes[ext]) {
          res.set('Content-Type', mimeTypes[ext]);
        }
        // Scene Viewer and Quick Look may fetch models in their own process;
        // allow range requests and inline display
        res.set('Accept-Ranges', 'bytes');
        if (ext === '.usdz') {
          res.set('Content-Disposition', 'inline');
        }
      },
    }));

    // Serve the AR viewer page
    const arViewerDir = path.join(__dirname, '..', '..', 'ar-viewer');
    app.use('/ar', express.static(arViewerDir));

    // AR route — serves the viewer with the model ID
    app.get('/ar/:modelId', (req, res) => {
      res.sendFile(path.join(arViewerDir, 'index.html'));
    });

    // API: server info including network mode
    app.get('/api/info', (req, res) => {
      const network = getNetworkMode();
      res.json({
        ip: network.ip,
        port: currentPort,
        url: getServerUrl(),
        networkMode: network.mode,
        interfaceName: network.interfaceName,
        allInterfaces: network.all,
      });
    });

    // API: list available models
    app.get('/api/models', (req, res) => {
      try {
        if (!fs.existsSync(modelsDir)) {
          fs.mkdirSync(modelsDir, { recursive: true });
        }
        const files = fs.readdirSync(modelsDir).filter(f =>
          /\.(glb|gltf|usdz)$/i.test(f)
        );
        const modelsMap = new Map();
        for (const f of files) {
          const id = path.parse(f).name;
          const ext = path.extname(f).toLowerCase();
          const stats = fs.statSync(path.join(modelsDir, f));

          if (modelsMap.has(id)) {
            const existing = modelsMap.get(id);
            if (ext === '.glb' || ext === '.gltf') {
              existing.filename = f;
              existing.format = ext.slice(1);
              existing.sizeBytes = stats.size;
              existing.sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            }
            existing.hasUsdz = existing.hasUsdz || ext === '.usdz';
            if (stats.mtime > new Date(existing.modified)) existing.modified = stats.mtime;
          } else {
            modelsMap.set(id, {
              id,
              filename: f,
              format: ext.slice(1),
              sizeBytes: stats.size,
              sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
              modified: stats.mtime,
              arUrl: `${getServerUrl()}/ar/${id}`,
              hasUsdz: ext === '.usdz',
            });
          }
        }
        res.json(Array.from(modelsMap.values()));
      } catch {
        res.json([]);
      }
    });

    // API: single model details
    app.get('/api/models/:modelId', (req, res) => {
      const { modelId } = req.params;
      const glbPath = path.join(modelsDir, `${modelId}.glb`);
      const usdzPath = path.join(modelsDir, `${modelId}.usdz`);

      const hasGlb = fs.existsSync(glbPath);
      const hasUsdz = fs.existsSync(usdzPath);

      if (!hasGlb && !hasUsdz) {
        return res.status(404).json({ error: 'Model not found' });
      }

      const glbStats = hasGlb ? fs.statSync(glbPath) : null;
      const usdzStats = hasUsdz ? fs.statSync(usdzPath) : null;

      res.json({
        id: modelId,
        hasGlb,
        hasUsdz,
        glbSizeMB: glbStats ? (glbStats.size / (1024 * 1024)).toFixed(2) : null,
        usdzSizeMB: usdzStats ? (usdzStats.size / (1024 * 1024)).toFixed(2) : null,
        arUrl: `${getServerUrl()}/ar/${modelId}`,
        glbUrl: hasGlb ? `${getServerUrl()}/models/${modelId}.glb` : null,
        usdzUrl: hasUsdz ? `${getServerUrl()}/models/${modelId}.usdz` : null,
      });
    });

    // JSON body parsing for POST routes
    app.use(express.json());

    // File upload config
    const upload = multer({
      storage: multer.diskStorage({
        destination: (req, file, cb) => {
          if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });
          cb(null, modelsDir);
        },
        filename: (req, file, cb) => {
          const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
          cb(null, safeName);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowed = ['.glb', '.gltf', '.usdz'];
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, allowed.includes(ext));
      },
      limits: { fileSize: 500 * 1024 * 1024 },
    });

    // API: upload model files
    app.post('/api/models/upload', upload.array('files', 20), (req, res) => {
      const uploaded = (req.files || []).map(f => ({
        filename: f.filename,
        id: path.parse(f.filename).name,
        sizeMB: (f.size / (1024 * 1024)).toFixed(2),
      }));
      res.json({ uploaded });
    });

    // API: rename a model
    app.put('/api/models/:modelId/rename', (req, res) => {
      const { modelId } = req.params;
      const { newName } = req.body;
      if (!newName || !newName.trim()) {
        return res.status(400).json({ error: 'newName is required' });
      }

      const safeName = newName.trim().replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
      if (!safeName) {
        return res.status(400).json({ error: 'Invalid name' });
      }

      const extensions = ['.glb', '.gltf', '.usdz'];
      let renamed = 0;

      for (const ext of extensions) {
        const oldPath = path.join(modelsDir, `${modelId}${ext}`);
        const newPath = path.join(modelsDir, `${safeName}${ext}`);
        if (fs.existsSync(oldPath)) {
          if (fs.existsSync(newPath) && oldPath !== newPath) {
            return res.status(409).json({ error: `A model named "${safeName}" already exists` });
          }
          fs.renameSync(oldPath, newPath);
          renamed++;
        }
      }

      if (renamed === 0) {
        return res.status(404).json({ error: 'Model not found' });
      }

      res.json({ id: safeName, renamed });
    });

    // API: delete a model
    app.delete('/api/models/:modelId', (req, res) => {
      const { modelId } = req.params;
      const extensions = ['.glb', '.gltf', '.usdz', '.glb.pre-optimize'];
      let deleted = 0;

      for (const ext of extensions) {
        const filePath = path.join(modelsDir, `${modelId}${ext}`);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          deleted++;
        }
      }

      if (deleted === 0) {
        return res.status(404).json({ error: 'Model not found' });
      }

      res.json({ deleted, id: modelId });
    });

    // API: get models directory path
    app.get('/api/models-dir', (req, res) => {
      res.json({ path: modelsDir });
    });

    // API: analyze model (vertex count, textures, compression status)
    app.get('/api/models/:modelId/analyze', async (req, res) => {
      const { analyzeModel } = optimizer;
      const glbPath = path.join(modelsDir, `${req.params.modelId}.glb`);
      if (!fs.existsSync(glbPath)) {
        return res.status(404).json({ error: 'Model not found' });
      }
      try {
        const analysis = await analyzeModel(glbPath);
        res.json({ id: req.params.modelId, ...analysis });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // API: optimize a single model
    const optimizeJobs = new Map();

    app.post('/api/models/:modelId/optimize', async (req, res) => {
      const { optimizeModel } = optimizer;
      const modelId = req.params.modelId;
      const glbPath = path.join(modelsDir, `${modelId}.glb`);

      if (!fs.existsSync(glbPath)) {
        return res.status(404).json({ error: 'Model not found' });
      }
      if (optimizeJobs.has(modelId)) {
        return res.status(409).json({ error: 'Optimization already running', progress: optimizeJobs.get(modelId) });
      }

      const options = {
        useDraco: req.body.draco !== false,
        textureMaxSize: req.body.textureSize || 1024,
        textureQuality: req.body.quality || 80,
        deduplicate: req.body.dedup !== false,
        removeUnused: req.body.prune !== false,
        useQuantize: req.body.quantize === true,
        onProgress: (p) => optimizeJobs.set(modelId, p),
      };

      optimizeJobs.set(modelId, { stage: 'starting', percent: 0 });
      res.json({ status: 'started', modelId });

      try {
        const backupPath = glbPath + '.pre-optimize';
        fs.copyFileSync(glbPath, backupPath);

        const tempPath = glbPath.replace(/\.glb$/, '.optimized.glb');
        const result = await optimizeModel(glbPath, tempPath, options);
        fs.renameSync(tempPath, glbPath);

        optimizeJobs.set(modelId, { stage: 'done', percent: 100, result });
      } catch (err) {
        const backupPath = glbPath + '.pre-optimize';
        if (fs.existsSync(backupPath)) {
          fs.renameSync(backupPath, glbPath);
        }
        optimizeJobs.set(modelId, { stage: 'error', error: err.message });
      }
    });

    // API: check optimization progress
    app.get('/api/models/:modelId/optimize/status', (req, res) => {
      const progress = optimizeJobs.get(req.params.modelId);
      if (!progress) {
        return res.json({ status: 'idle' });
      }
      res.json(progress);
      if (progress.stage === 'done' || progress.stage === 'error') {
        optimizeJobs.delete(req.params.modelId);
      }
    });

    // API: batch optimize all models
    app.post('/api/optimize/batch', async (req, res) => {
      const { batchOptimize } = optimizer;
      const options = {
        useDraco: req.body.draco !== false,
        textureMaxSize: req.body.textureSize || 1024,
        textureQuality: req.body.quality || 80,
      };
      try {
        const results = await batchOptimize(modelsDir, options);
        res.json({ results });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // API: convert GLB to USDZ for iOS AR Quick Look
    const convertJobs = new Map();

    app.post('/api/models/:modelId/convert-usdz', async (req, res) => {
      const modelId = req.params.modelId;
      const glbPath = path.join(modelsDir, `${modelId}.glb`);
      const usdzPath = path.join(modelsDir, `${modelId}.usdz`);

      if (!fs.existsSync(glbPath)) {
        return res.status(404).json({ error: 'GLB model not found' });
      }
      if (convertJobs.has(modelId)) {
        return res.status(409).json({ error: 'Conversion already running' });
      }

      convertJobs.set(modelId, { stage: 'converting', percent: 50 });
      res.json({ status: 'started', modelId });

      try {
        const result = await converter.glbToUsdz(glbPath, usdzPath);
        convertJobs.set(modelId, { stage: 'done', percent: 100, result });
      } catch (err) {
        convertJobs.set(modelId, { stage: 'error', error: err.message });
      }
    });

    app.get('/api/models/:modelId/convert-usdz/status', (req, res) => {
      const progress = convertJobs.get(req.params.modelId);
      if (!progress) {
        return res.json({ status: 'idle' });
      }
      res.json(progress);
      if (progress.stage === 'done' || progress.stage === 'error') {
        convertJobs.delete(req.params.modelId);
      }
    });

    // Health check — phones can ping this to verify connectivity
    app.get('/api/ping', (req, res) => {
      res.json({ ok: true, timestamp: Date.now() });
    });

    serverInstance = app.listen(currentPort, '0.0.0.0', () => {
      startIpWatcher();
      resolve({ server: serverInstance, port: currentPort });
    });

    serverInstance.on('error', reject);
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (serverInstance) {
      serverInstance.close(resolve);
      serverInstance = null;
    } else {
      resolve();
    }
  });
}

module.exports = {
  startServer,
  stopServer,
  getServerUrl,
  getLanIp,
  getNetworkMode,
  onIpChange,
};
