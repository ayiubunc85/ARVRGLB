import React from 'react';
import QRCode from './QRCode';
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
  selected: boolean;
  onSelect: (id: string) => void;
}

export default function ModelCard({ model, selected, onSelect }: ModelCardProps) {
  const displayName = model.id.replace(/[-_]/g, ' ');
  const sizeMB = parseFloat(model.sizeMB);
  const sizeColor = sizeMB > 25 ? '#ef4444' : sizeMB > 15 ? '#f59e0b' : '#22c55e';

  return (
    <div
      onClick={() => onSelect(model.id)}
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: 20,
        border: selected ? '2px solid #4361ee' : '1px solid rgba(0,0,0,0.06)',
        cursor: 'pointer',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: selected
          ? '0 2px 12px rgba(67,97,238,0.12)'
          : '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <ModelPreview
        src={`/models/${model.filename}`}
        style={{
          width: '100%',
          height: 160,
          background: '#f0f0f2',
          borderRadius: 8,
          marginBottom: 14,
          overflow: 'hidden',
        }}
      />

      {/* Model info */}
      <h3 style={{
        fontSize: 15,
        fontWeight: 600,
        color: '#1d1d1f',
        marginBottom: 6,
        textTransform: 'capitalize',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {displayName}
      </h3>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontSize: 11,
          color: 'rgba(0,0,0,0.45)',
          background: '#f0f0f2',
          padding: '2px 8px',
          borderRadius: 4,
          textTransform: 'uppercase',
        }}>
          {model.format}
        </span>
        {model.hasUsdz && (
          <span style={{
            fontSize: 10,
            color: '#22c55e',
            background: 'rgba(34, 197, 94, 0.08)',
            padding: '2px 6px',
            borderRadius: 4,
          }}>
            USDZ
          </span>
        )}
        <span style={{ fontSize: 12, color: sizeColor }}>
          {model.sizeMB} MB
        </span>
      </div>

      {/* QR Code — shown when selected */}
      {selected && (
        <div style={{
          marginTop: 16,
          paddingTop: 16,
          borderTop: '1px solid rgba(0,0,0,0.06)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <QRCode url={model.arUrl} size={180} label="Scan to view in AR" />
          <p style={{
            fontSize: 11,
            color: 'rgba(0,0,0,0.3)',
            marginTop: 8,
            wordBreak: 'break-all',
            textAlign: 'center',
          }}>
            {model.arUrl}
          </p>
        </div>
      )}
    </div>
  );
}
