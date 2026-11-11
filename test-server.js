const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 8080;
const modelsDir = path.join(__dirname, 'models');
const arViewerDir = path.join(__dirname, 'ar-viewer');

app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use('/models', express.static(modelsDir, {
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.glb': 'model/gltf-binary',
      '.gltf': 'model/gltf+json',
      '.usdz': 'model/vnd.usdz+zip',
    };
    if (mimeTypes[ext]) res.set('Content-Type', mimeTypes[ext]);
    res.set('Accept-Ranges', 'bytes');
  },
}));

app.use('/ar', express.static(arViewerDir));

app.get('/ar/:modelId', (req, res) => {
  res.sendFile(path.join(arViewerDir, 'index.html'));
});

app.get('/api/models/:modelId', (req, res) => {
  const { modelId } = req.params;
  const glbPath = path.join(modelsDir, `${modelId}.glb`);
  const usdzPath = path.join(modelsDir, `${modelId}.usdz`);
  const hasGlb = fs.existsSync(glbPath);
  const hasUsdz = fs.existsSync(usdzPath);

  if (!hasGlb && !hasUsdz) return res.status(404).json({ error: 'Not found' });

  const glbStats = hasGlb ? fs.statSync(glbPath) : null;
  const usdzStats = hasUsdz ? fs.statSync(usdzPath) : null;

  res.json({
    id: modelId,
    hasGlb,
    hasUsdz,
    glbSizeMB: glbStats ? (glbStats.size / (1024 * 1024)).toFixed(2) : null,
    usdzSizeMB: usdzStats ? (usdzStats.size / (1024 * 1024)).toFixed(2) : null,
  });
});

app.get('/api/models', (req, res) => {
  const files = fs.readdirSync(modelsDir).filter(f => /\.(glb|gltf|usdz)$/i.test(f));
  const models = [];
  const seen = new Set();
  for (const f of files) {
    const id = path.parse(f).name;
    if (seen.has(id)) continue;
    seen.add(id);
    models.push({ id, filename: f });
  }
  res.json(models);
});

app.get('/', (req, res) => {
  const files = fs.readdirSync(modelsDir).filter(f => /\.glb$/i.test(f));
  const links = files.map(f => {
    const id = path.parse(f).name;
    return `<li><a href="/ar/${id}">${id}</a></li>`;
  }).join('\n');
  res.send(`<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width"><title>Models</title>
<style>body{font-family:system-ui;padding:24px;background:#f5f5f7}
a{display:block;padding:12px 16px;margin:4px 0;background:#fff;border-radius:8px;
text-decoration:none;color:#4361ee;font-weight:500;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
a:active{background:#eef}</style></head>
<body><h2>Available Models</h2><ul style="list-style:none;padding:0">${links}</ul></body></html>`);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Test server running on port ${PORT}`);
});
