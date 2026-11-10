import React from 'react';

interface ServerInfo {
  ip: string;
  port: number;
  url: string;
  networkMode: string;
  interfaceName: string;
}

interface ServerStatusProps {
  serverInfo: ServerInfo | null;
  error: string | null;
}

export default function ServerStatus({ serverInfo, error }: ServerStatusProps) {
  const networkLabel: Record<string, string> = {
    wifi: 'WiFi',
    hotspot: 'Hotspot',
    offline: 'Offline',
  };

  const networkHint: Record<string, string> = {
    wifi: 'Phones on the same WiFi can connect',
    hotspot: 'Connect phones to this hotspot, then scan QR',
    offline: 'No network — connect to WiFi or enable a hotspot',
  };

  return (
    <div style={{
      background: '#1a1a24',
      borderRadius: 12,
      padding: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
    }}>
      <div style={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        flexShrink: 0,
        background: serverInfo
          ? serverInfo.networkMode === 'offline' ? '#f59e0b' : '#22c55e'
          : '#ef4444',
      }} />

      {serverInfo ? (
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, color: '#fff' }}>
              Server running at{' '}
              <code style={{ color: '#4361ee' }}>{serverInfo.url}</code>
            </span>
            <span style={{
              fontSize: 11,
              color: serverInfo.networkMode === 'offline' ? '#f59e0b' : '#22c55e',
              background: serverInfo.networkMode === 'offline'
                ? 'rgba(245, 158, 11, 0.1)'
                : 'rgba(34, 197, 94, 0.1)',
              padding: '2px 8px',
              borderRadius: 6,
              whiteSpace: 'nowrap',
            }}>
              {networkLabel[serverInfo.networkMode] || serverInfo.networkMode}
            </span>
          </div>
          <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
            {networkHint[serverInfo.networkMode] || ''}
          </p>
        </div>
      ) : (
        <p style={{ fontSize: 14, color: '#ef4444' }}>
          {error || 'Connecting to local server…'}
        </p>
      )}
    </div>
  );
}
