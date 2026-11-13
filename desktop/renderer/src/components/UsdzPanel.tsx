import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = '';

interface UsdzPanelProps {
  modelId: string;
  onConverted: () => void;
}

export default function UsdzPanel({ modelId, onConverted }: UsdzPanelProps) {
  const [hasUsdz, setHasUsdz] = useState(false);
  const [usdzSizeMB, setUsdzSizeMB] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const checkUsdz = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/models/${modelId}`);
      const data = await r.json();
      setHasUsdz(data.hasUsdz || false);
      setUsdzSizeMB(data.usdzSizeMB || null);
    } catch {}
  }, [modelId]);

  useEffect(() => {
    checkUsdz();
  }, [checkUsdz]);

  const convert = useCallback(async () => {
    setConverting(true);
    setError(null);
    setProgress('Converting...');

    try {
      await fetch(`${API_BASE}/api/models/${modelId}/convert-usdz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });

      const poll = async () => {
        const r = await fetch(`${API_BASE}/api/models/${modelId}/convert-usdz/status`);
        const data = await r.json();

        if (data.stage === 'done') {
          setConverting(false);
          setProgress('');
          checkUsdz();
          onConverted();
          return;
        }
        if (data.stage === 'error') {
          setError(data.error);
          setConverting(false);
          setProgress('');
          return;
        }

        setProgress(`Converting (${data.percent}%)`);
        setTimeout(poll, 500);
      };

      setTimeout(poll, 500);
    } catch (err: any) {
      setError(err.message);
      setConverting(false);
    }
  }, [modelId, checkUsdz, onConverted]);

  return (
    <div>
      {hasUsdz && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 10, fontSize: 12,
        }}>
          <span style={{ color: 'rgba(0,0,0,0.45)' }}>
            USDZ file: {usdzSizeMB || '—'} MB
          </span>
          <span style={{ color: 'rgba(0,0,0,0.5)', fontWeight: 500 }}>Ready</span>
        </div>
      )}

      <button
        onClick={convert}
        disabled={converting}
        style={{
          width: '100%', padding: '11px 0', borderRadius: 10,
          fontSize: 13, fontWeight: 600, cursor: converting ? 'default' : 'pointer',
          color: converting ? 'rgba(0,0,0,0.4)' : hasUsdz ? 'rgba(0,0,0,0.5)' : '#fff',
          background: converting
            ? 'rgba(0,0,0,0.06)'
            : hasUsdz
              ? 'linear-gradient(135deg, rgba(255,255,255,0.5), rgba(255,255,255,0.25))'
              : 'linear-gradient(135deg, #111, #333)',
          border: hasUsdz && !converting ? '1px solid rgba(0,0,0,0.06)' : 'none',
          boxShadow: converting
            ? 'none'
            : hasUsdz
              ? '0 2px 6px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.6)'
              : '0 4px 16px rgba(0,0,0,0.15), 0 1px 0 rgba(255,255,255,0.04) inset',
        }}
      >
        {converting ? progress : hasUsdz ? 'Reconvert USDZ' : 'Convert to USDZ'}
      </button>

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
