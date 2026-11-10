const path = require('path');
const fs = require('fs');
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const sharp = require('sharp');
const fflate = require('fflate');

async function getIO() {
  let draco3d;
  try { draco3d = require('draco3dgltf'); } catch { /* optional */ }

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  if (draco3d) {
    const [enc, dec] = await Promise.all([
      draco3d.createEncoderModule(),
      draco3d.createDecoderModule(),
    ]);
    io.registerDependencies({ 'draco3d.encoder': enc, 'draco3d.decoder': dec });
  }
  return io;
}

async function glbToUsdz(glbPath, usdzPath, options = {}) {
  const { textureMaxSize = 2048 } = options;
  const io = await getIO();
  const doc = await io.read(glbPath);
  const root = doc.getRoot();

  const textureFiles = {};
  const textureMap = new Map();

  for (const tex of root.listTextures()) {
    const image = tex.getImage();
    if (!image || image.byteLength === 0) continue;

    const name = tex.getName() || `texture_${textureMap.size}`;
    const mime = tex.getMimeType();
    const buf = Buffer.from(image);
    let img = sharp(buf);
    const meta = await img.metadata();

    if (meta.width > textureMaxSize || meta.height > textureMaxSize) {
      img = img.resize(textureMaxSize, textureMaxSize, { fit: 'inside', withoutEnlargement: true });
    }

    let outBuf;
    let ext;
    if (mime === 'image/png') {
      outBuf = await img.png().toBuffer();
      ext = '.png';
    } else {
      outBuf = await img.jpeg({ quality: 90 }).toBuffer();
      ext = '.jpg';
    }

    const filename = sanitize(name) + ext;
    textureFiles[filename] = new Uint8Array(outBuf);
    textureMap.set(tex, filename);
  }

  let usda = '#usda 1.0\n(\n    defaultPrim = "Root"\n    metersPerUnit = 1\n    upAxis = "Y"\n)\n\n';
  usda += 'def Xform "Root"\n{\n';

  let meshIdx = 0;
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const meshName = sanitize(mesh.getName() || `mesh_${meshIdx}`);
      const mat = prim.getMaterial();

      const posAccessor = prim.getAttribute('POSITION');
      const normAccessor = prim.getAttribute('NORMAL');
      const uvAccessor = prim.getAttribute('TEXCOORD_0');
      const idxAccessor = prim.getIndices();

      if (!posAccessor) continue;

      const positions = [];
      for (let i = 0; i < posAccessor.getCount(); i++) {
        const v = posAccessor.getElement(i, [0, 0, 0]);
        positions.push(`(${v[0]}, ${v[1]}, ${v[2]})`);
      }

      let normals = [];
      if (normAccessor) {
        for (let i = 0; i < normAccessor.getCount(); i++) {
          const n = normAccessor.getElement(i, [0, 0, 0]);
          normals.push(`(${n[0]}, ${n[1]}, ${n[2]})`);
        }
      }

      let uvs = [];
      if (uvAccessor) {
        for (let i = 0; i < uvAccessor.getCount(); i++) {
          const uv = uvAccessor.getElement(i, [0, 0]);
          uvs.push(`(${uv[0]}, ${1 - uv[1]})`);
        }
      }

      let indices = [];
      if (idxAccessor) {
        for (let i = 0; i < idxAccessor.getCount(); i++) {
          indices.push(idxAccessor.getScalar(i));
        }
      }

      const faceVertexCounts = [];
      for (let i = 0; i < indices.length / 3; i++) {
        faceVertexCounts.push(3);
      }

      usda += `    def Mesh "${meshName}_${meshIdx}" (\n`;
      usda += `        active = true\n`;
      usda += `    )\n    {\n`;
      usda += `        int[] faceVertexCounts = [${faceVertexCounts.join(', ')}]\n`;
      usda += `        int[] faceVertexIndices = [${indices.join(', ')}]\n`;
      usda += `        point3f[] points = [${positions.join(', ')}]\n`;

      if (normals.length > 0) {
        usda += `        normal3f[] normals = [${normals.join(', ')}] (\n`;
        usda += `            interpolation = "vertex"\n`;
        usda += `        )\n`;
      }

      if (uvs.length > 0) {
        usda += `        texCoord2f[] primvars:st = [${uvs.join(', ')}] (\n`;
        usda += `            interpolation = "vertex"\n`;
        usda += `        )\n`;
      }

      if (mat) {
        const matName = sanitize(mat.getName() || `material_${meshIdx}`);
        usda += `        rel material:binding = </Root/Materials/${matName}>\n`;
      }

      usda += `    }\n\n`;
      meshIdx++;
    }
  }

  usda += '    def Scope "Materials"\n    {\n';
  for (const mat of root.listMaterials()) {
    const matName = sanitize(mat.getName() || 'material');
    const baseColor = mat.getBaseColorFactor();
    const roughness = mat.getRoughnessFactor();
    const metallic = mat.getMetallicFactor();

    usda += `        def Material "${matName}"\n        {\n`;
    usda += `            token outputs:surface.connect = </Root/Materials/${matName}/PBRShader.outputs:surface>\n\n`;
    usda += `            def Shader "PBRShader"\n            {\n`;
    usda += `                uniform token info:id = "UsdPreviewSurface"\n`;
    usda += `                color3f inputs:diffuseColor = (${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]})\n`;
    usda += `                float inputs:roughness = ${roughness}\n`;
    usda += `                float inputs:metallic = ${metallic}\n`;
    usda += `                float inputs:opacity = ${baseColor[3]}\n`;

    const baseColorTex = mat.getBaseColorTexture();
    if (baseColorTex && textureMap.has(baseColorTex)) {
      const texFile = textureMap.get(baseColorTex);
      usda += `                color3f inputs:diffuseColor.connect = </Root/Materials/${matName}/diffuseTexture.outputs:rgb>\n`;
      usda += `            }\n\n`;
      usda += `            def Shader "diffuseTexture"\n            {\n`;
      usda += `                uniform token info:id = "UsdUVTexture"\n`;
      usda += `                asset inputs:file = @${texFile}@\n`;
      usda += `                float2 inputs:st.connect = </Root/Materials/${matName}/stReader.outputs:result>\n`;
      usda += `                token inputs:wrapS = "repeat"\n`;
      usda += `                token inputs:wrapT = "repeat"\n`;
      usda += `                color3f outputs:rgb\n`;
    }

    usda += `            }\n\n`;

    const normalTex = mat.getNormalTexture();
    if (normalTex && textureMap.has(normalTex)) {
      const texFile = textureMap.get(normalTex);
      usda += `            def Shader "normalTexture"\n            {\n`;
      usda += `                uniform token info:id = "UsdUVTexture"\n`;
      usda += `                asset inputs:file = @${texFile}@\n`;
      usda += `                float2 inputs:st.connect = </Root/Materials/${matName}/stReader.outputs:result>\n`;
      usda += `                normal3f outputs:rgb\n`;
      usda += `            }\n\n`;
    }

    usda += `            def Shader "stReader"\n            {\n`;
    usda += `                uniform token info:id = "UsdPrimvarReader_float2"\n`;
    usda += `                token inputs:varname = "st"\n`;
    usda += `                float2 outputs:result\n`;
    usda += `            }\n`;

    usda += `        }\n\n`;
  }
  usda += '    }\n';
  usda += '}\n';

  const files = { 'model.usda': fflate.strToU8(usda) };
  for (const [name, data] of Object.entries(textureFiles)) {
    files[name] = data;
  }

  const zipData = fflate.zipSync(files, { level: 0 });
  fs.writeFileSync(usdzPath, zipData);

  const stats = fs.statSync(usdzPath);
  return {
    sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
    sizeBytes: stats.size,
    textures: Object.keys(textureFiles).length,
  };
}

function sanitize(name) {
  return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
}

module.exports = { glbToUsdz };
