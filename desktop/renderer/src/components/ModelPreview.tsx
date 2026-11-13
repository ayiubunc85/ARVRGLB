import React, { useEffect, useRef, useState } from 'react';

interface ModelPreviewProps {
  src: string;
  style?: React.CSSProperties;
}

function filterOversizedMesh(buf: ArrayBuffer): string | null {
  try {
    if (buf.byteLength < 20) return null;
    const dv = new DataView(buf);
    const jsonLen = dv.getUint32(12, true);
    const jsonStr = new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen));
    const g = JSON.parse(jsonStr);
    if (!g.meshes || !g.accessors || !g.nodes || !g.scenes) return null;

    const boxes: { ni: number; maxDim: number }[] = [];

    function visitNode(ni: number, parentTranslation: number[]) {
      const nd = g.nodes[ni];
      if (!nd) return;
      const nt = nd.translation || [0, 0, 0];
      const t = [parentTranslation[0] + nt[0], parentTranslation[1] + nt[1], parentTranslation[2] + nt[2]];
      if (nd.mesh != null) {
        const nmin = [Infinity, Infinity, Infinity];
        const nmax = [-Infinity, -Infinity, -Infinity];
        g.meshes[nd.mesh].primitives.forEach((p: any) => {
          const ac = g.accessors[p.attributes?.POSITION];
          if (!ac || !ac.min || !ac.max) return;
          for (let a = 0; a < 3; a++) {
            nmin[a] = Math.min(nmin[a], ac.min[a] + t[a]);
            nmax[a] = Math.max(nmax[a], ac.max[a] + t[a]);
          }
        });
        if (nmin[0] < Infinity) {
          const d = Math.max(nmax[0] - nmin[0], nmax[1] - nmin[1], nmax[2] - nmin[2]);
          boxes.push({ ni, maxDim: d });
        }
      }
      (nd.children || []).forEach((c: number) => visitNode(c, t));
    }

    (g.scenes[g.scene || 0].nodes || []).forEach((ni: number) => visitNode(ni, [0, 0, 0]));

    if (boxes.length < 2) return null;
    boxes.sort((a, b) => a.maxDim - b.maxDim);
    if (boxes[boxes.length - 1].maxDim <= boxes[0].maxDim * 5) return null;

    const excludeNi = boxes[boxes.length - 1].ni;
    const g2 = JSON.parse(jsonStr);
    g2.nodes.forEach((nd: any) => {
      if (nd.children) nd.children = nd.children.filter((c: number) => c !== excludeNi);
    });
    g2.scenes.forEach((sc: any) => {
      if (sc.nodes) sc.nodes = sc.nodes.filter((n: number) => n !== excludeNi);
    });

    let newJson = JSON.stringify(g2);
    while (newJson.length % 4 !== 0) newJson += ' ';
    const jsonBytes = new TextEncoder().encode(newJson);
    const binOff = 20 + jsonLen;
    const binLen = dv.getUint32(binOff, true);
    const binData = new Uint8Array(buf, binOff + 8, binLen);
    const total = 12 + 8 + jsonBytes.length + 8 + binLen;
    const nb = new ArrayBuffer(total);
    const nv = new DataView(nb);
    const na = new Uint8Array(nb);
    nv.setUint32(0, 0x46546c67, true);
    nv.setUint32(4, 2, true);
    nv.setUint32(8, total, true);
    nv.setUint32(12, jsonBytes.length, true);
    nv.setUint32(16, 0x4e4f534a, true);
    na.set(jsonBytes, 20);
    const bo = 20 + jsonBytes.length;
    nv.setUint32(bo, binLen, true);
    nv.setUint32(bo + 4, 0x004e4942, true);
    na.set(binData, bo + 8);

    return URL.createObjectURL(new Blob([nb], { type: 'model/gltf-binary' }));
  } catch {
    return null;
  }
}

export default function ModelPreview({ src, style }: ModelPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewSrc, setPreviewSrc] = useState(src);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    import('@google/model-viewer');
  }, []);

  useEffect(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    if (!src.endsWith('.glb')) {
      setPreviewSrc(src);
      return;
    }

    let cancelled = false;
    fetch(src)
      .then(r => r.ok ? r.arrayBuffer() : null)
      .then(buf => {
        if (cancelled || !buf) { setPreviewSrc(src); return; }
        const filtered = filterOversizedMesh(buf);
        if (filtered) {
          blobUrlRef.current = filtered;
          setPreviewSrc(filtered);
        } else {
          setPreviewSrc(src);
        }
      })
      .catch(() => { if (!cancelled) setPreviewSrc(src); });

    return () => { cancelled = true; };
  }, [src]);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} style={style}>
      {/* @ts-ignore — model-viewer is a web component */}
      <model-viewer
        src={previewSrc}
        auto-rotate
        auto-rotate-delay="0"
        rotation-per-second="20deg"
        camera-controls
        disable-zoom
        interaction-prompt="none"
        shadow-intensity="0.4"
        environment-image="neutral"
        bounds="tight"
        style={{
          width: '100%',
          height: '100%',
          background: 'transparent',
          '--poster-color': 'transparent',
          '--progress-bar-color': '#333',
        } as React.CSSProperties}
      />
    </div>
  );
}
