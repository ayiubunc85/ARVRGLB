import React, { useEffect, useRef } from 'react';
import { LightingSettings, defaultLighting } from './LightingPanel';

interface ModelPreviewProps {
  src: string;
  style?: React.CSSProperties;
  lighting?: LightingSettings;
}

export default function ModelPreview({ src, style, lighting = defaultLighting }: ModelPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    import('@google/model-viewer');
  }, []);

  useEffect(() => {
    const mv = containerRef.current?.querySelector('model-viewer') as HTMLElement | null;
    if (!mv) return;

    mv.setAttribute('exposure', String(lighting.exposure));
    mv.setAttribute('shadow-intensity', String(lighting.shadowIntensity));
    mv.setAttribute('shadow-softness', String(lighting.shadowSoftness));
  }, [lighting.exposure, lighting.shadowIntensity, lighting.shadowSoftness]);

  useEffect(() => {
    const mv = containerRef.current?.querySelector('model-viewer') as any;
    if (!mv) return;

    const rotationRad = (lighting.envRotation * Math.PI) / 180;

    const applyEnvRotation = () => {
      try {
        const symbols = Object.getOwnPropertySymbols(mv);
        for (const sym of symbols) {
          try {
            const val = mv[sym];
            if (val && typeof val === 'object' && val.isScene && val.environmentRotation) {
              val.environmentRotation.y = rotationRad;
              return;
            }
          } catch {}
        }
      } catch {}
    };

    applyEnvRotation();
    mv.addEventListener('load', applyEnvRotation);
    return () => mv.removeEventListener('load', applyEnvRotation);
  }, [lighting.envRotation]);

  return (
    <div ref={containerRef} style={style}>
      {/* @ts-ignore — model-viewer is a web component */}
      <model-viewer
        src={src}
        auto-rotate
        auto-rotate-delay="0"
        rotation-per-second="20deg"
        camera-controls
        disable-zoom
        interaction-prompt="none"
        shadow-intensity={String(lighting.shadowIntensity)}
        shadow-softness={String(lighting.shadowSoftness)}
        exposure={String(lighting.exposure)}
        environment-image="neutral"
        style={{
          width: '100%',
          height: '100%',
          background: 'transparent',
          '--poster-color': 'transparent',
          '--progress-bar-color': '#4361ee',
        } as React.CSSProperties}
      />
    </div>
  );
}
