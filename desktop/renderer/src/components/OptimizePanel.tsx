import React, { useState, useCallback } from 'react';

const API_BASE = 'http://localhost:3456';

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
    <div style={{
      width: '100%',
      background: '#111119',
      borderRadius: 8,
      padding: 16,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
          Optimize
        </span>
        <button
          onClick={analyze}
          disabled={analyzing}
          style={{
            fontSize: 11,
            color: '#4361ee',
            background: 'none',
            border: 'none',
            cursor: analyzing ? 'default' : 'pointer',
            opacity: analyzing ? 0.5 : 1,
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
          <Row
            label="Draco"
            value={analysis.hasDraco ? 'Yes' : 'No'}
            valueColor={analysis.hasDraco ? '#22c55e' : '#888'}
          />
        </div>
      )}

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        <label style={labelStyle}>
          <input
            type="checkbox"
            checked={draco}
            onChange={e => setDraco(e.target.checked)}
            style={checkboxStyle}
          />
          Draco compression
        </label>

        <div>
          <span style={{ ...labelStyle, display: 'block', marginBottom: 4 }}>
            Max texture: {textureSize}px
          </span>
          <input
            type="range"
            min={512}
            max={2048}
            step={512}
            value={textureSize}
            onChange={e => setTextureSize(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#4361ee' }}
          />
        </div>

        <div>
          <span style={{ ...labelStyle, display: 'block', marginBottom: 4 }}>
            JPEG quality: {quality}%
          </span>
          <input
            type="range"
            min={50}
            max={95}
            step={5}
            value={quality}
            onChange={e => setQuality(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#4361ee' }}
          />
        </div>
      </div>

      <button
        onClick={optimize}
        disabled={optimizing}
        style={{
          width: '100%',
          padding: '10px 0',
          background: optimizing ? '#2a2a3a' : '#4361ee',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          cursor: optimizing ? 'default' : 'pointer',
        }}
      >
        {optimizing ? progress : 'Optimize Model'}
      </button>

      {result && (
        <div style={{
          marginTop: 10,
          padding: 10,
          background: 'rgba(34, 197, 94, 0.1)',
          borderRadius: 6,
          fontSize: 12,
          color: '#22c55e',
          textAlign: 'center',
        }}>
          {result.beforeMB} MB → {result.afterMB} MB ({result.reductionPercent}% smaller)
        </div>
      )}

      {error && (
        <div style={{
          marginTop: 10,
          padding: 10,
          background: 'rgba(239, 68, 68, 0.1)',
          borderRadius: 6,
          fontSize: 12,
          color: '#ef4444',
          textAlign: 'center',
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#aaa',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'pointer',
};

const checkboxStyle: React.CSSProperties = {
  accentColor: '#4361ee',
};

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '4px 0',
      fontSize: 12,
    }}>
      <span style={{ color: '#666' }}>{label}</span>
      <span style={{ color: valueColor || '#ccc' }}>{value}</span>
    </div>
  );
}
