import React, { useEffect, useRef } from 'react';

interface ModelPreviewProps {
  src: string;
  style?: React.CSSProperties;
}

export default function ModelPreview({ src, style }: ModelPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    import('@google/model-viewer');
  }, []);

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
        shadow-intensity="0.4"
        environment-image="neutral"
        bounds="tight"
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
