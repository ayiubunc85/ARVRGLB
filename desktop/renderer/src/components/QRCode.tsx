import React, { useEffect, useRef, useState } from 'react';

interface QRCodeProps {
  url: string;
  size?: number;
  label?: string;
}

export default function QRCode({ url, size = 200, label }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;

    import('qrcode').then((QRCodeLib) => {
      const qr = QRCodeLib.default || QRCodeLib;
      qr.toDataURL(url, {
        width: size,
        margin: 2,
        color: { dark: '#1d1d1fff', light: '#00000000' },
        errorCorrectionLevel: 'M',
      }).then((dataUrl: string) => {
        setDataUrl(dataUrl);
      });
    });
  }, [url, size]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 12,
    }}>
      <div style={{
        width: size,
        height: size,
        background: '#f5f5f7',
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid rgba(0,0,0,0.06)',
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
          <span style={{ color: 'rgba(0,0,0,0.3)', fontSize: 13 }}>Generating…</span>
        )}
      </div>

      {label && (
        <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', textAlign: 'center', maxWidth: size }}>
          {label}
        </span>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => navigator.clipboard.writeText(url)}
          style={{
            background: '#f0f0f2',
            color: '#1d1d1f',
            border: 'none',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Copy link
        </button>
      </div>
    </div>
  );
}
