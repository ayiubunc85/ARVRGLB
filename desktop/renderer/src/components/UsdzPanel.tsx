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
    <div style={{
      width: '100%',
      background: '#f5f5f7',
      borderRadius: 8,
      padding: 16,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: hasUsdz ? 8 : 12,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1d1d1f' }}>
          iOS AR (USDZ)
        </span>
        {hasUsdz && (
          <span style={{ fontSize: 11, color: '#22c55e' }}>
            Ready
          </span>
        )}
      </div>

      {hasUsdz && usdzSizeMB && (
        <div style={{
          fontSize: 12,
          color: 'rgba(0,0,0,0.45)',
          marginBottom: 10,
        }}>
          USDZ file: {usdzSizeMB} MB
        </div>
      )}

      <button
        onClick={convert}
        disabled={converting}
        style={{
          width: '100%',
          padding: '10px 0',
          background: converting ? 'rgba(0,0,0,0.08)' : hasUsdz ? 'rgba(0,0,0,0.08)' : '#4361ee',
          color: converting ? 'rgba(0,0,0,0.4)' : hasUsdz ? '#1d1d1f' : '#fff',
          border: 'none',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          cursor: converting ? 'default' : 'pointer',
        }}
      >
        {converting ? progress : hasUsdz ? 'Reconvert USDZ' : 'Convert to USDZ'}
      </button>

      {error && (
        <div style={{
          marginTop: 10,
          padding: 10,
          background: 'rgba(239, 68, 68, 0.08)',
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
