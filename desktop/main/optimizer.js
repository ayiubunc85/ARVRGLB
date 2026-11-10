const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const draco3d = require('draco3dgltf');

let ioInstance = null;

async function getIO() {
  if (ioInstance) return ioInstance;
  const { NodeIO } = await import('@gltf-transform/core');
  const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
  const [encoderModule, decoderModule] = await Promise.all([
    draco3d.createEncoderModule(),
    draco3d.createDecoderModule(),
  ]);
  ioInstance = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.encoder': encoderModule,
      'draco3d.decoder': decoderModule,
    });
  return ioInstance;
}

async function resizeAllTextures(doc, maxSize) {
  const textures = doc.getRoot().listTextures();
  for (const tex of textures) {
    const image = tex.getImage();
    if (!image || image.byteLength === 0) continue;

    try {
      const buf = Buffer.from(image);
      const meta = await sharp(buf).metadata();
      if (meta.width > maxSize || meta.height > maxSize) {
        const resized = await sharp(buf)
          .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
          .toBuffer();
        tex.setImage(new Uint8Array(resized));
      }
    } catch {
      // skip textures sharp can't process
    }
  }
}

async function analyzeModel(filePath) {
  const io = await getIO();
  const doc = await io.read(filePath);
  const root = doc.getRoot();

  let totalVertices = 0;
  let totalTriangles = 0;
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (pos) totalVertices += pos.getCount();
      const idx = prim.getIndices();
      if (idx) totalTriangles += idx.getCount() / 3;
    }
  }

  const textures = root.listTextures().map(tex => {
    const img = tex.getImage();
    const size = img ? img.byteLength : 0;
    return {
      name: tex.getName() || tex.getURI() || 'unnamed',
      mimeType: tex.getMimeType(),
      sizeKB: Math.round(size / 1024),
    };
  });

  const hasDraco = doc.getRoot().listExtensionsUsed()
    .some(ext => ext.extensionName === 'KHR_draco_mesh_compression');

  const stats = fs.statSync(filePath);

  return {
    fileSizeMB: (stats.size / (1024 * 1024)).toFixed(2),
    vertices: totalVertices,
    triangles: Math.round(totalTriangles),
    materials: root.listMaterials().length,
    meshes: root.listMeshes().length,
    textures,
    hasDraco,
  };
}

async function optimizeModel(filePath, outputPath, options = {}) {
  const {
    useDraco = true,
    textureMaxSize = 1024,
    textureQuality = 80,
    deduplicate = true,
    removeUnused = true,
    useQuantize = false,
    onProgress = () => {},
  } = options;

  const beforeStats = fs.statSync(filePath);
  const beforeMB = (beforeStats.size / (1024 * 1024)).toFixed(2);

  onProgress({ stage: 'reading', percent: 5 });
  const io = await getIO();
  const doc = await io.read(filePath);

  // Resize textures first (manual step, not a transform)
  if (textureMaxSize) {
    onProgress({ stage: 'resizing textures', percent: 15 });
    await resizeAllTextures(doc, textureMaxSize);
  }

  // Build transform pipeline
  const { draco, textureCompress, dedup, prune, quantize } = await import('@gltf-transform/functions');
  const transforms = [];

  if (deduplicate) {
    transforms.push(dedup());
  }

  if (removeUnused) {
    transforms.push(prune());
  }

  onProgress({ stage: 'compressing textures', percent: 40 });
  transforms.push(
    textureCompress({
      encoder: sharp,
      targetFormat: 'jpeg',
      quality: textureQuality,
    })
  );

  if (useQuantize) {
    transforms.push(quantize());
  }

  if (useDraco) {
    onProgress({ stage: 'draco compression', percent: 70 });
    transforms.push(draco());
  }

  onProgress({ stage: 'applying transforms', percent: 85 });
  await doc.transform(...transforms);

  onProgress({ stage: 'writing', percent: 95 });
  await io.write(outputPath, doc);

  const afterStats = fs.statSync(outputPath);
  const afterMB = (afterStats.size / (1024 * 1024)).toFixed(2);
  const reduction = ((1 - afterStats.size / beforeStats.size) * 100).toFixed(1);

  onProgress({ stage: 'done', percent: 100 });

  return {
    beforeMB,
    afterMB,
    reductionPercent: reduction,
    beforeBytes: beforeStats.size,
    afterBytes: afterStats.size,
  };
}

async function batchOptimize(modelsDir, options = {}) {
  const files = fs.readdirSync(modelsDir).filter(f => /\.glb$/i.test(f));
  const results = [];

  for (const file of files) {
    const filePath = path.join(modelsDir, file);
    const backupPath = filePath + '.backup';
    const tempPath = filePath.replace(/\.glb$/, '.optimized.glb');

    try {
      fs.copyFileSync(filePath, backupPath);

      const result = await optimizeModel(filePath, tempPath, options);
      fs.renameSync(tempPath, filePath);

      results.push({
        file,
        status: 'success',
        ...result,
      });
    } catch (err) {
      if (fs.existsSync(backupPath)) {
        fs.renameSync(backupPath, filePath);
      }
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      results.push({
        file,
        status: 'error',
        error: err.message,
      });
    } finally {
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
    }
  }

  return results;
}

module.exports = { analyzeModel, optimizeModel, batchOptimize };
