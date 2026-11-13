import React, { useEffect, useRef, useState } from 'react';

interface QRCodeProps {
  url: string;
  size?: number;
  label?: string;
}

export default function QRCode({ url, size = 200, label }: QRCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;

    import('qrcode').then((QRCodeLib) => {
      const qr = QRCodeLib.default || QRCodeLib;
      qr.toDataURL(url, {
        width: size,
        margin: 2,
        color: { dark: '#111111ff', light: '#00000000' },
        errorCorrectionLevel: 'M',
      }).then((dataUrl: string) => {
        setDataUrl(dataUrl);
      });
    });
  }, [url, size]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: size, height: size, borderRadius: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, rgba(0,0,0,0.03), rgba(0,0,0,0.06))',
        border: '1px solid rgba(0,0,0,0.04)',
        boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.04)',
      }}>
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={`QR code for ${url}`}
            width={size - 24}
            height={size - 24}
            style={{ imageRendering: 'pixelated' }}
          />
        ) : (
          <span style={{ color: 'rgba(0,0,0,0.25)', fontSize: 13 }}>Generating...</span>
        )}
      </div>

      {label && (
        <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.3)', textAlign: 'center', maxWidth: size }}>
          {label}
        </span>
      )}

      <button
        onClick={() => navigator.clipboard.writeText(url)}
        style={{
          color: '#fff', border: 'none', borderRadius: 8,
          padding: '8px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          background: 'linear-gradient(135deg, #111, #333)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        }}
      >
        Copy AR link
      </button>
    </div>
  );
}
