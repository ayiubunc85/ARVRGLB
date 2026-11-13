import React, { useState } from 'react';
import ModelPreview from './ModelPreview';

interface ModelEntry {
  id: string;
  filename: string;
  format: string;
  sizeBytes: number;
  sizeMB: string;
  modified: string;
  arUrl: string;
  hasUsdz?: boolean;
}

interface ModelCardProps {
  model: ModelEntry;
  onSelect: (id: string) => void;
}

export default function ModelCard({ model, onSelect }: ModelCardProps) {
  const [hovered, setHovered] = useState(false);
  const displayName = model.id.replace(/[-_]/g, ' ');

  return (
    <div
      onClick={() => onSelect(model.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 14,
        padding: 16,
        cursor: 'pointer',
        background: 'linear-gradient(145deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.4) 100%)',
        border: hovered ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(0,0,0,0.05)',
        backdropFilter: 'blur(20px)',
        boxShadow: hovered
          ? '0 8px 24px rgba(0,0,0,0.08), 0 20px 48px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.8)'
          : '0 2px 8px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.7)',
        transform: hovered ? 'translateY(-3px)' : 'none',
        transition: 'all 0.3s ease',
      }}
    >
      <ModelPreview
        src={`/models/${model.filename}`}
        style={{
          width: '100%',
          height: 140,
          borderRadius: 10,
          marginBottom: 12,
          overflow: 'hidden',
          background: 'linear-gradient(145deg, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.06) 100%)',
          border: '1px solid rgba(0,0,0,0.04)',
          boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.04)',
        }}
      />

      <h3 style={{
        fontSize: 14, fontWeight: 600, marginBottom: 6,
        textTransform: 'capitalize',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {displayName}
      </h3>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontSize: 10, padding: '3px 8px', borderRadius: 6, fontWeight: 500,
          background: 'rgba(0,0,0,0.04)', color: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(0,0,0,0.04)',
        }}>
          {model.format.toUpperCase()}
        </span>
        {model.hasUsdz && (
          <span style={{
            fontSize: 10, padding: '3px 8px', borderRadius: 6, fontWeight: 500,
            background: 'rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.55)',
            border: '1px solid rgba(0,0,0,0.04)',
          }}>
            USDZ
          </span>
        )}
        <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.35)' }}>
          {model.sizeMB} MB
        </span>
      </div>
    </div>
  );
}
