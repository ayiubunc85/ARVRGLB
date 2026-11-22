import React from 'react';

export interface LightingSettings {
  exposure: number;
  shadowIntensity: number;
  shadowSoftness: number;
  envRotation: number;
}

export const defaultLighting: LightingSettings = {
  exposure: 1.0,
  shadowIntensity: 0.4,
  shadowSoftness: 0.5,
  envRotation: 0,
};

interface LightingPanelProps {
  settings: LightingSettings;
  onChange: (settings: LightingSettings) => void;
}

export default function LightingPanel({ settings, onChange }: LightingPanelProps) {
  const update = (key: keyof LightingSettings, value: number) => {
    onChange({ ...settings, [key]: value });
  };

  const isDefault =
    settings.exposure === defaultLighting.exposure &&
    settings.shadowIntensity === defaultLighting.shadowIntensity &&
    settings.shadowSoftness === defaultLighting.shadowSoftness &&
    settings.envRotation === defaultLighting.envRotation;

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
        marginBottom: 14,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
          Lighting
        </span>
        {!isDefault && (
          <button
            onClick={() => onChange(defaultLighting)}
            style={{
              fontSize: 11,
              color: '#4361ee',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        )}
      </div>

      <Slider
        label="Ambient"
        value={settings.exposure}
        min={0}
        max={2}
        step={0.05}
        displayValue={formatPercent(settings.exposure)}
        onChange={v => update('exposure', v)}
      />

      <Slider
        label="Sun"
        value={settings.shadowIntensity}
        min={0}
        max={2}
        step={0.05}
        displayValue={formatPercent(settings.shadowIntensity)}
        onChange={v => update('shadowIntensity', v)}
      />

      <Slider
        label="Shadow Softness"
        value={settings.shadowSoftness}
        min={0}
        max={1}
        step={0.05}
        displayValue={formatPercent(settings.shadowSoftness)}
        onChange={v => update('shadowSoftness', v)}
      />

      <Slider
        label="Env Rotation"
        value={settings.envRotation}
        min={0}
        max={360}
        step={1}
        displayValue={`${Math.round(settings.envRotation)}°`}
        onChange={v => update('envRotation', v)}
        last
      />
    </div>
  );
}

function formatPercent(val: number): string {
  return `${Math.round(val * 100)}%`;
}

function Slider({ label, value, min, max, step, displayValue, onChange, last }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  onChange: (v: number) => void;
  last?: boolean;
}) {
  return (
    <div style={{ marginBottom: last ? 0 : 12 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
      }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>{label}</span>
        <span style={{ fontSize: 12, color: '#ccc', fontVariantNumeric: 'tabular-nums' }}>
          {displayValue}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#4361ee' }}
      />
    </div>
  );
}
