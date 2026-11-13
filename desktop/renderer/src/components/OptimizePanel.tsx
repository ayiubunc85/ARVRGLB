import React, { useState, useCallback } from 'react';

const API_BASE = '';

interface Analysis {
  vertices: number;
  triangles: number;
  materials: number;
  meshes: number;
  textures: { name: string; mimeType: string; sizeKB: number }[];
  hasDraco: boolean;
  fileSizeMB: string;
}

interface OptimizeResult {
  beforeMB: string;
  afterMB: string;
  reductionPercent: string;
}

interface OptimizePanelProps {
  modelId: string;
  sizeMB: string;
  onOptimized: () => void;
}

export default function OptimizePanel({ modelId, sizeMB, onOptimized }: OptimizePanelProps) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [draco, setDraco] = useState(true);
  const [textureSize, setTextureSize] = useState(1024);
  const [quality, setQuality] = useState(80);

  const analyze = useCallback(async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const r = await fetch(`${API_BASE}/api/models/${modelId}/analyze`);
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setAnalysis(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }, [modelId]);

  const optimize = useCallback(async () => {
    setOptimizing(true);
    setError(null);
    setResult(null);
    setProgress('Starting...');

    try {
      await fetch(`${API_BASE}/api/models/${modelId}/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draco, textureSize, quality }),
      });

      const poll = async () => {
        const r = await fetch(`${API_BASE}/api/models/${modelId}/optimize/status`);
        const data = await r.json();

        if (data.stage === 'done') {
          setResult(data.result);
          setOptimizing(false);
          setProgress('');
          onOptimized();
          return;
        }
        if (data.stage === 'error') {
          setError(data.error);
          setOptimizing(false);
          setProgress('');
          return;
        }

        setProgress(`${data.stage} (${data.percent}%)`);
        setTimeout(poll, 500);
      };

      setTimeout(poll, 500);
    } catch (err: any) {
      setError(err.message);
      setOptimizing(false);
    }
  }, [modelId, draco, textureSize, quality, onOptimized]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)' }}>
          Current size: {sizeMB} MB
        </span>
        <button
          onClick={analyze}
          disabled={analyzing}
          style={{
            fontSize: 11, fontWeight: 500,
            color: analyzing ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.5)',
            background: 'none', border: 'none',
            cursor: analyzing ? 'default' : 'pointer',
          }}
        >
          {analyzing ? 'Analyzing...' : 'Analyze'}
        </button>
      </div>

      {analysis && (
        <div style={{ marginBottom: 12 }}>
          <Row label="Vertices" value={analysis.vertices.toLocaleString()} />
          <Row label="Triangles" value={analysis.triangles.toLocaleString()} />
          <Row label="Materials" value={String(analysis.materials)} />
          <Row label="Textures" value={String(analysis.textures.length)} />
          <Row label="Draco" value={analysis.hasDraco ? 'Yes' : 'No'} />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        <label style={labelStyle}>
          <input type="checkbox" checked={draco} onChange={e => setDraco(e.target.checked)} />
          Draco compression
        </label>
        <div>
          <span style={{ ...labelStyle, display: 'block', marginBottom: 4 }}>
            Max texture: {textureSize}px
          </span>
          <input type="range" min={512} max={2048} step={512} value={textureSize}
            onChange={e => setTextureSize(Number(e.target.value))}
            style={{ width: '100%' }} />
        </div>
        <div>
          <span style={{ ...labelStyle, display: 'block', marginBottom: 4 }}>
            JPEG quality: {quality}%
          </span>
          <input type="range" min={50} max={95} step={5} value={quality}
            onChange={e => setQuality(Number(e.target.value))}
            style={{ width: '100%' }} />
        </div>
      </div>

      <button
        onClick={optimize}
        disabled={optimizing}
        style={{
          width: '100%', padding: '11px 0', border: 'none', borderRadius: 10,
          fontSize: 13, fontWeight: 700, cursor: optimizing ? 'default' : 'pointer',
          color: optimizing ? 'rgba(0,0,0,0.4)' : '#fff',
          background: optimizing ? 'rgba(0,0,0,0.06)' : 'linear-gradient(135deg, #111, #333)',
          boxShadow: optimizing ? 'none' : '0 4px 16px rgba(0,0,0,0.15), 0 1px 0 rgba(255,255,255,0.04) inset',
        }}
      >
        {optimizing ? progress : 'Optimize Model'}
      </button>

      {result && (
        <div style={{
          marginTop: 10, padding: 10, borderRadius: 8,
          fontSize: 12, textAlign: 'center',
          background: 'rgba(0,0,0,0.04)', color: 'rgba(0,0,0,0.6)',
          border: '1px solid rgba(0,0,0,0.04)',
        }}>
          {result.beforeMB} MB → {result.afterMB} MB ({result.reductionPercent}% smaller)
        </div>
      )}

      {error && (
        <div style={{
          marginTop: 10, padding: 10, borderRadius: 8,
          fontSize: 12, textAlign: 'center',
          background: 'rgba(200,0,0,0.06)', color: 'rgba(200,0,0,0.7)',
          border: '1px solid rgba(200,0,0,0.08)',
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 12, color: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      padding: '6px 0', fontSize: 12, borderBottom: '1px solid rgba(0,0,0,0.04)',
    }}>
      <span style={{ color: 'rgba(0,0,0,0.35)' }}>{label}</span>
      <span style={{ fontWeight: 500, color: 'rgba(0,0,0,0.65)' }}>{value}</span>
    </div>
  );
}
