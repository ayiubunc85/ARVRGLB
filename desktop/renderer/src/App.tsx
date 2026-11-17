import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import ModelCard from './components/ModelCard';
import ModelPreview from './components/ModelPreview';
import QRCode from './components/QRCode';
import OptimizePanel from './components/OptimizePanel';
import UsdzPanel from './components/UsdzPanel';

interface ServerInfo {
  ip: string;
  port: number;
  url: string;
  networkMode: string;
  interfaceName: string;
}

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

type View = 'dashboard' | 'detail';

const API_BASE = '';

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [detailTab, setDetailTab] = useState<'info' | 'optimize' | 'usdz'>('info');
  const [lightExposure, setLightExposure] = useState(1.0);
  const [lightShadow, setLightShadow] = useState(0.4);
  const [lightSoftness, setLightSoftness] = useState(0.5);
  const [lightEnv, setLightEnv] = useState<'neutral' | 'legacy'>('neutral');
  const [showLightPanel, setShowLightPanel] = useState(false);
  const [modelData, setModelData] = useState<{
    vertices: number; triangles: number; materials: number;
    textures: { name: string; mimeType: string; sizeKB: number }[];
    meshes: number; hasDraco: boolean;
  } | null>(null);
  const [modelDataLoading, setModelDataLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const stats = useMemo(() => {
    const totalSize = models.reduce((sum, m) => sum + parseFloat(m.sizeMB), 0);
    const usdzCount = models.filter(m => m.hasUsdz).length;
    const arReady = models.filter(m => parseFloat(m.sizeMB) <= 50).length;
    return { totalSize: totalSize.toFixed(1), usdzCount, arReady };
  }, [models]);

  const fetchData = useCallback(() => {
    fetch(`${API_BASE}/api/info`)
      .then(r => r.json())
      .then(setServerInfo)
      .catch(() => setError('Could not connect to local server'));

    fetch(`${API_BASE}/api/models`)
      .then(r => r.json())
      .then((data: ModelEntry[]) => {
        setModels(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const valid = Array.from(files).filter(f =>
      /\.(glb|gltf|usdz)$/i.test(f.name)
    );
    if (valid.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    valid.forEach(f => formData.append('files', f));

    try {
      const r = await fetch(`${API_BASE}/api/models/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await r.json();
      if (data.uploaded?.length > 0) {
        setSelectedId(data.uploaded[0].id);
        setView('detail');
      }
      fetchData();
    } catch {} finally {
      setUploading(false);
    }
  }, [fetchData]);

  const deleteModel = useCallback(async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/models/${id}`, { method: 'DELETE' });
      setView('dashboard');
      setSelectedId(null);
      fetchData();
    } catch {}
  }, [fetchData]);

  const renameModel = useCallback(async (id: string, newName: string) => {
    try {
      const r = await fetch(`${API_BASE}/api/models/${id}/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName }),
      });
      const data = await r.json();
      if (data.id) setSelectedId(data.id);
      setRenaming(false);
      fetchData();
    } catch {
      setRenaming(false);
    }
  }, [fetchData]);

  const openModel = useCallback((id: string) => {
    setSelectedId(id);
    setView('detail');
    setDetailTab('info');
    setModelData(null);
    setModelDataLoading(true);
    fetch(`${API_BASE}/api/models/${id}/analyze`)
      .then(r => r.json())
      .then(data => {
        if (!data.error) setModelData(data);
      })
      .catch(() => {})
      .finally(() => setModelDataLoading(false));
  }, []);

  const goBack = useCallback(() => {
    setView('dashboard');
    setRenaming(false);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (dragCounter.current === 1) setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
  }, [uploadFiles]);

  const selectedModel = models.find(m => m.id === selectedId) || null;
  const networkLabel: Record<string, string> = { wifi: 'WiFi', hotspot: 'Hotspot', offline: 'Offline' };

  return (
    <div
      style={{ height: '100vh', width: '100%', display: 'flex', overflow: 'hidden', position: 'relative' }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drop overlay */}
      {dragging && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.06)',
          border: '3px dashed rgba(0,0,0,0.2)',
          borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            ...glassCard,
            padding: '32px 48px',
            textAlign: 'center',
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1.5" style={{ marginBottom: 12 }}>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p style={{ fontSize: 16, fontWeight: 600 }}>Drop model files here</p>
            <p style={{ fontSize: 13, color: 'rgba(0,0,0,0.35)', marginTop: 4 }}>.glb, .gltf, or .usdz</p>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,.gltf,.usdz"
        multiple
        style={{ display: 'none' }}
        onChange={e => {
          if (e.target.files) uploadFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {/* ── Sidebar ── */}
      <aside style={sidebarStyle}>
        <div style={brandStyle}>
          <div style={logoStyle}>
            <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, fill: 'none', stroke: '#fff', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
              <path d="M12 2l6 3.5v5L12 14 6 10.5v-5L12 2z"/>
              <path d="M12 14v8"/><path d="M18 10.5l-6 3.5"/><path d="M6 10.5l6 3.5"/>
              <path d="M12 2v4"/><path d="M18 5.5l-2.5-1.5"/><path d="M6 5.5l2.5-1.5"/>
              <line x1="12" y1="22" x2="12" y2="24" strokeWidth="1.2"/>
              <line x1="21" y1="8" x2="23" y2="7" strokeWidth="1.2"/>
              <line x1="1" y1="7" x2="3" y2="8" strokeWidth="1.2"/>
            </svg>
          </div>
          <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: 0.5 }}>ARMV</span>
        </div>

        <nav style={{ padding: '12px 12px 8px' }}>
          <NavItem active={view === 'dashboard'} onClick={goBack} label="Dashboard"
            icon={<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>} />
          <NavItem active={view === 'detail' && detailTab === 'info'} onClick={() => { if (view === 'detail') setDetailTab('info'); else if (models.length > 0) openModel(models[0].id); }} label="Models"
            icon={<svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>} />
          {view === 'detail' && (
            <>
              <SubNavItem active={detailTab === 'optimize'} onClick={() => setDetailTab('optimize')} label="Optimization"
                icon={<svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>} />
              <SubNavItem active={detailTab === 'usdz'} onClick={() => setDetailTab('usdz')} label="USDZ Convert"
                icon={<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0110 10 10 10 0 01-10 10A10 10 0 012 12 10 10 0 0112 2z"/><path d="M2 12h20"/><path d="M12 2a15 15 0 014 10 15 15 0 01-4 10 15 15 0 01-4-10 15 15 0 014-10z"/></svg>} />
            </>
          )}
          <NavItem active={false} onClick={() => {}} label="AR Viewer"
            icon={<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path d="M9 22V12h6v10"/></svg>} />
          <NavItem active={false} onClick={() => {}} label="Settings"
            icon={<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>} />
        </nav>

        <div style={{ flex: 1 }} />

        <div style={serverInfoCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: serverInfo
                ? serverInfo.networkMode === 'offline' ? 'radial-gradient(circle,#888,#555)' : 'radial-gradient(circle,#555,#222)'
                : 'radial-gradient(circle,#999,#666)',
              boxShadow: '0 0 6px rgba(0,0,0,0.15)',
            }} />
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(0,0,0,0.35)' }}>
              Server
            </span>
          </div>
          {serverInfo ? (
            <>
              <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.5)', wordBreak: 'break-all', lineHeight: 1.4, marginBottom: 6 }}>
                {serverInfo.url}
              </div>
              <span style={{
                fontSize: 10, color: 'rgba(0,0,0,0.4)',
                background: 'rgba(0,0,0,0.04)', padding: '3px 8px', borderRadius: 6,
                border: '1px solid rgba(0,0,0,0.04)',
              }}>
                {networkLabel[serverInfo.networkMode] || serverInfo.networkMode} Connected
              </span>
            </>
          ) : (
            <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)' }}>
              {error || 'Connecting...'}
            </div>
          )}
        </div>

        <div style={{ margin: 12, padding: 14, borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(0,0,0,0.08), rgba(0,0,0,0.03))',
            border: '1px solid rgba(0,0,0,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 600, color: 'rgba(0,0,0,0.4)',
          }}>U</div>
          <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.3)' }}>
            <strong style={{ color: 'rgba(0,0,0,0.5)', fontWeight: 500 }}>Storage</strong><br/>
            {stats.totalSize} MB used
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {view === 'dashboard' ? (
          <>
            <div style={{ padding: '20px 32px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.3)' }}>
                Home / <strong style={{ color: '#111', fontWeight: 600 }}>Dashboard</strong>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  style={{ ...primaryBtnStyle, opacity: uploading ? 0.6 : 1, cursor: uploading ? 'default' : 'pointer' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  {uploading ? 'Importing...' : 'Import'}
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '20px 32px 32px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
                <StatCard label="3D Models" value={String(models.length)} sub="All formats" gradient />
                <StatCard label="Total Size" value={`${stats.totalSize} MB`} sub="Combined assets" />
                <StatCard label="AR Ready" value={`${stats.arReady}/${models.length}`} sub={models.length > 0 ? `${Math.round((stats.arReady / models.length) * 100)}% coverage` : 'No models'} />
                <StatCard label="USDZ Files" value={String(stats.usdzCount)} sub="iOS compatible" />
              </div>

              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Models</div>

              {models.length === 0 ? (
                <div style={{ ...glassCard, padding: 48, textAlign: 'center', marginBottom: 28 }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="1.5" style={{ marginBottom: 16 }}>
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                  </svg>
                  <p style={{ fontSize: 14, color: 'rgba(0,0,0,0.4)' }}>No models yet</p>
                  <p style={{ fontSize: 13, color: 'rgba(0,0,0,0.25)', marginTop: 8 }}>
                    Drag and drop .glb or .usdz files here, or click{' '}
                    <span style={{ color: '#111', cursor: 'pointer', fontWeight: 500 }} onClick={() => fileInputRef.current?.click()}>Import</span>
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: 28 }}>
                  {models.map(model => (
                    <ModelCard key={model.id} model={model} onSelect={openModel} />
                  ))}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                <div style={bottomCardStyle}>
                  <h3 style={sectionHeaderStyle}>Recent Activity</h3>
                  {models.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.25)', padding: '12px 0' }}>No activity yet</div>
                  ) : (
                    models.slice(0, 4).map((m, i) => (
                      <div key={m.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 0',
                        borderBottom: i < Math.min(models.length, 4) - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                        fontSize: 12,
                      }}>
                        <div style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: i % 2 === 0 ? 'radial-gradient(circle,#333,#111)' : 'radial-gradient(circle,#888,#555)',
                          boxShadow: '0 0 4px rgba(0,0,0,0.1)',
                        }} />
                        <span style={{ flex: 1, color: 'rgba(0,0,0,0.5)' }}>{m.filename} uploaded</span>
                        <span style={{ color: 'rgba(0,0,0,0.25)', fontSize: 11 }}>{m.sizeMB} MB</span>
                      </div>
                    ))
                  )}
                </div>
                <div style={bottomCardStyle}>
                  <h3 style={sectionHeaderStyle}>Quick Actions</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <QuickBtn label="Import Model" onClick={() => fileInputRef.current?.click()} />
                    <QuickBtn label="Batch Optimize" onClick={() => { if (models.length > 0) openModel(models[0].id); }} />
                    <QuickBtn label="Generate QR" onClick={() => { if (models.length > 0) openModel(models[0].id); }} />
                    <QuickBtn label="View Models" onClick={() => { if (models.length > 0) openModel(models[0].id); }} />
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={{ padding: '18px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span onClick={goBack} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: 'rgba(0,0,0,0.3)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </span>
                <span onClick={goBack} style={{ cursor: 'pointer' }}>Dashboard</span>
                {' / '}
                <span onClick={goBack} style={{ cursor: 'pointer' }}>Models</span>
                {' / '}
                <strong style={{ color: '#111', fontWeight: 600, textTransform: 'capitalize' }}>
                  {selectedModel ? selectedModel.id.replace(/[-_]/g, ' ') : ''}
                </strong>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    if (selectedModel) {
                      setRenameValue(selectedModel.id);
                      setRenaming(true);
                    }
                  }}
                  style={actionBtnStyle}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Rename
                </button>
                <button
                  onClick={() => {
                    if (selectedModel && confirm(`Delete "${selectedModel.id}" and all its files?`)) {
                      deleteModel(selectedModel.id);
                    }
                  }}
                  style={{ ...actionBtnStyle, color: 'rgba(200,0,0,0.6)', borderColor: 'rgba(200,0,0,0.08)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                  </svg>
                  Delete
                </button>
              </div>
            </div>

            {renaming && selectedModel && (
              <div style={{ padding: '0 32px 12px', flexShrink: 0 }}>
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    if (renameValue.trim()) renameModel(selectedModel.id, renameValue);
                  }}
                  style={{ display: 'flex', gap: 8 }}
                >
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') setRenaming(false); }}
                    style={{
                      flex: 1, padding: '9px 14px', fontSize: 13,
                      background: 'rgba(255,255,255,0.5)',
                      border: '1px solid rgba(0,0,0,0.1)',
                      borderRadius: 10, outline: 'none',
                      backdropFilter: 'blur(12px)',
                    }}
                  />
                  <button type="submit" style={primaryBtnStyle}>Save</button>
                  <button type="button" onClick={() => setRenaming(false)} style={actionBtnStyle}>Cancel</button>
                </form>
              </div>
            )}

            {selectedModel && (
              <div style={{ flex: 1, overflow: 'hidden', padding: '0 32px 32px', display: 'flex', gap: 24, minHeight: 0 }}>
                <div style={viewerPanelStyle}>
                  <div style={{
                    flex: 1, minHeight: 0,
                    background: 'linear-gradient(145deg, rgba(0,0,0,0.02), rgba(0,0,0,0.06))',
                  }}>
                    <ModelPreview
                      src={`${API_BASE}/models/${selectedModel.filename}`}
                      style={{ width: '100%', height: '100%' }}
                      disableFilter
                      exposure={lightExposure}
                      shadowIntensity={lightShadow}
                      shadowSoftness={lightSoftness}
                      environmentImage={lightEnv}
                    />
                  </div>
                  {showLightPanel && (
                    <div style={{
                      padding: '12px 16px',
                      borderTop: '1px solid rgba(0,0,0,0.04)',
                      background: 'linear-gradient(135deg, rgba(240,240,240,0.85), rgba(230,230,230,0.7))',
                      backdropFilter: 'blur(20px)',
                      display: 'flex', flexDirection: 'column', gap: 8,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Lighting</span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {(['neutral', 'legacy'] as const).map(env => (
                            <button key={env} onClick={() => setLightEnv(env)} style={{
                              padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                              fontSize: 11, fontWeight: 500,
                              background: lightEnv === env ? 'rgba(0,0,0,0.08)' : 'transparent',
                              color: lightEnv === env ? '#111' : 'rgba(0,0,0,0.35)',
                            }}>{env === 'neutral' ? 'Neutral' : 'Studio'}</button>
                          ))}
                        </div>
                      </div>
                      <LightSlider label="Exposure" value={lightExposure} min={0.2} max={3} step={0.1} onChange={setLightExposure} />
                      <LightSlider label="Shadow" value={lightShadow} min={0} max={2} step={0.1} onChange={setLightShadow} />
                      <LightSlider label="Softness" value={lightSoftness} min={0} max={1} step={0.05} onChange={setLightSoftness} />
                      <button onClick={() => { setLightExposure(1); setLightShadow(0.4); setLightSoftness(0.5); setLightEnv('neutral'); }} style={{
                        padding: '4px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                        fontSize: 11, fontWeight: 600, background: 'rgba(0,0,0,0.04)', color: 'rgba(0,0,0,0.35)',
                      }}>Reset</button>
                    </div>
                  )}
                  <div style={{
                    padding: '16px 20px',
                    borderTop: '1px solid rgba(0,0,0,0.04)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, textTransform: 'capitalize' }}>
                      {selectedModel.id.replace(/[-_]/g, ' ')}
                    </h2>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button onClick={() => setShowLightPanel(!showLightPanel)} title="Lighting" style={{
                        width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: showLightPanel ? 'rgba(0,0,0,0.08)' : 'transparent',
                        color: showLightPanel ? '#111' : 'rgba(0,0,0,0.3)',
                        transition: 'all 0.2s',
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                        </svg>
                      </button>
                      <span style={tagStyle}>{selectedModel.format.toUpperCase()}</span>
                      {selectedModel.hasUsdz && <span style={{ ...tagStyle, background: 'rgba(0,0,0,0.05)', color: 'rgba(0,0,0,0.55)' }}>USDZ</span>}
                    </div>
                  </div>
                </div>

                <div style={{ width: 300, minWidth: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: detailTab === 'info' ? 'space-between' : undefined, gap: detailTab === 'info' ? undefined : 16, overflow: 'auto' }}>
                  {detailTab === 'info' && (
                    <>
                      <div style={detailCardStyle}>
                        <h3 style={sectionHeaderStyle}>Model Info</h3>
                        <DetailRow label="Format" value={selectedModel.format.toUpperCase()} />
                        <DetailRow label="File size" value={`${selectedModel.sizeMB} MB`} />
                        <DetailRow
                          label="Status"
                          value={parseFloat(selectedModel.sizeMB) > 25 ? 'Large — slow on mobile' : 'Ready for AR'}
                        />
                      </div>

                      <div style={detailCardStyle}>
                        <h3 style={sectionHeaderStyle}>Model Data</h3>
                        {modelDataLoading ? (
                          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.3)', padding: '8px 0' }}>Analyzing...</div>
                        ) : modelData ? (
                          <>
                            <DetailRow label="Vertices" value={modelData.vertices.toLocaleString()} />
                            <DetailRow label="Triangles" value={modelData.triangles.toLocaleString()} />
                            <DetailRow label="Materials" value={String(modelData.materials)} />
                            <DetailRow label="Meshes" value={String(modelData.meshes)} />
                            <TextureRow count={modelData.textures.length} textures={modelData.textures} />
                            <DetailRow label="Draco Compressed" value={modelData.hasDraco ? 'Yes' : 'No'} />
                          </>
                        ) : (
                          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.25)', padding: '8px 0' }}>Analysis unavailable</div>
                        )}
                      </div>

                      <div style={{ ...detailCardStyle, textAlign: 'center' }}>
                        <h3 style={sectionHeaderStyle}>AR Quick Link</h3>
                        <QRCode url={selectedModel.arUrl} size={180} label="Scan to view in AR" />
                      </div>
                    </>
                  )}

                  {detailTab === 'optimize' && (
                    <div style={detailCardStyle}>
                      <h3 style={sectionHeaderStyle}>Optimization</h3>
                      <OptimizePanel modelId={selectedModel.id} sizeMB={selectedModel.sizeMB} onOptimized={fetchData} />
                    </div>
                  )}

                  {detailTab === 'usdz' && (
                    <div style={detailCardStyle}>
                      <h3 style={sectionHeaderStyle}>iOS AR (USDZ)</h3>
                      {selectedModel.format === 'glb' ? (
                        <UsdzPanel modelId={selectedModel.id} onConverted={fetchData} />
                      ) : (
                        <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.3)', padding: '8px 0' }}>
                          USDZ conversion is only available for GLB models.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void;
  icon: React.ReactNode; label: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderRadius: 10,
        fontSize: 13, fontWeight: 500, cursor: 'pointer',
        transition: 'all 0.2s',
        color: active ? '#111' : hovered ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.35)',
        background: active
          ? 'linear-gradient(135deg, rgba(0,0,0,0.07) 0%, rgba(0,0,0,0.03) 100%)'
          : hovered ? 'rgba(0,0,0,0.04)' : 'none',
        boxShadow: active ? '0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.5)' : 'none',
      }}
    >
      <span style={{ width: 18, height: 18, display: 'flex', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as React.CSSProperties}>
        {icon}
      </span>
      {label}
    </div>
  );
}

function SubNavItem({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void;
  icon: React.ReactNode; label: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 14px 7px 32px', borderRadius: 8,
        fontSize: 12, fontWeight: 500, cursor: 'pointer',
        transition: 'all 0.2s',
        color: active ? '#111' : hovered ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)',
        background: active
          ? 'linear-gradient(135deg, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.02) 100%)'
          : hovered ? 'rgba(0,0,0,0.03)' : 'none',
      }}
    >
      <span style={{ width: 14, height: 14, display: 'flex', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as React.CSSProperties}>
        {icon}
      </span>
      {label}
    </div>
  );
}

function StatCard({ label, value, sub, gradient }: {
  label: string; value: string; sub: string; gradient?: boolean;
}) {
  return (
    <div style={glassCard}>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>{label}</div>
      <div style={{
        fontSize: 26, fontWeight: 800,
        ...(gradient ? { background: 'linear-gradient(135deg, #111, #555)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } : {}),
      }}>{value}</div>
      <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.25)', marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function QuickBtn({ label, onClick }: { label: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: 14, borderRadius: 10, fontSize: 12, fontWeight: 500,
        textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s',
        color: hovered ? '#111' : 'rgba(0,0,0,0.45)',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.5), rgba(255,255,255,0.25))',
        border: hovered ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(0,0,0,0.04)',
        boxShadow: hovered
          ? '0 4px 12px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)'
          : '0 2px 6px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.6)',
      }}
    >
      {label}
    </div>
  );
}

function TextureRow({ count, textures }: { count: number; textures: { name: string; mimeType: string; sizeKB: number }[] }) {
  const [hovered, setHovered] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (hovered && rowRef.current) {
      const rect = rowRef.current.getBoundingClientRect();
      setPos({ top: rect.top, left: rect.left - 276 });
    }
  }, [hovered]);

  return (
    <div
      ref={rowRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.04)', fontSize: 13,
        cursor: count > 0 ? 'pointer' : 'default',
      }}>
        <span style={{ color: 'rgba(0,0,0,0.35)' }}>Textures</span>
        <span style={{ fontWeight: 500 }}>{count}</span>
      </div>
      {hovered && count > 0 && createPortal(
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            position: 'fixed', top: pos.top, left: pos.left, zIndex: 1000,
            width: 264, padding: 14, borderRadius: 12,
            background: 'linear-gradient(145deg, rgba(255,255,255,0.97), rgba(255,255,255,0.92))',
            border: '1px solid rgba(0,0,0,0.08)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(0,0,0,0.3)', marginBottom: 8 }}>
            Texture Details
          </div>
          {textures.map((t, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '5px 0', fontSize: 11, borderBottom: i < textures.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
            }}>
              <span style={{ color: 'rgba(0,0,0,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                {t.name || `Texture ${i + 1}`}
              </span>
              <span style={{ fontWeight: 500, color: 'rgba(0,0,0,0.6)', whiteSpace: 'nowrap', marginLeft: 8 }}>
                {t.sizeKB} KB · {t.mimeType.split('/')[1]?.toUpperCase() || t.mimeType}
              </span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

function LightSlider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 10, color: 'rgba(0,0,0,0.35)', minWidth: 48 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, height: 3, accentColor: '#999' }}
      />
      <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.45)', minWidth: 28, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {value.toFixed(1)}
      </span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.04)', fontSize: 13,
    }}>
      <span style={{ color: 'rgba(0,0,0,0.35)' }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}

const glassCard: React.CSSProperties = {
  borderRadius: 14, padding: 20,
  background: 'linear-gradient(145deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.4) 100%)',
  border: '1px solid rgba(0,0,0,0.05)',
  backdropFilter: 'blur(20px)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.7)',
};

const sidebarStyle: React.CSSProperties = {
  width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column', padding: '24px 0',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.45) 100%)',
  borderRight: '1px solid rgba(0,0,0,0.06)',
  backdropFilter: 'blur(40px)',
  boxShadow: '4px 0 24px rgba(0,0,0,0.04)',
};

const brandStyle: React.CSSProperties = {
  padding: '0 20px 28px', display: 'flex', alignItems: 'center', gap: 12,
  borderBottom: '1px solid rgba(0,0,0,0.06)', marginBottom: 8,
};

const logoStyle: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 10,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'linear-gradient(135deg, #111 0%, #333 100%)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)',
};

const serverInfoCardStyle: React.CSSProperties = {
  margin: '0 12px', padding: 16,
  background: 'linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.3) 100%)',
  borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.7)',
  backdropFilter: 'blur(20px)',
};

const primaryBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  border: 'none', borderRadius: 10, padding: '9px 20px',
  fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#fff',
  background: 'linear-gradient(135deg, #111 0%, #333 100%)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.15), 0 1px 0 rgba(255,255,255,0.05) inset',
};

const actionBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  borderRadius: 8, padding: '8px 14px',
  fontSize: 12, fontWeight: 500, cursor: 'pointer',
  color: 'rgba(0,0,0,0.45)',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.5), rgba(255,255,255,0.25))',
  border: '1px solid rgba(0,0,0,0.06)',
  boxShadow: '0 2px 6px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.6)',
  backdropFilter: 'blur(12px)',
};

const viewerPanelStyle: React.CSSProperties = {
  flex: 1, minWidth: 0, borderRadius: 16, overflow: 'hidden',
  display: 'flex', flexDirection: 'column', minHeight: 0,
  background: 'linear-gradient(145deg, rgba(255,255,255,0.7), rgba(255,255,255,0.35))',
  border: '1px solid rgba(0,0,0,0.05)',
  backdropFilter: 'blur(20px)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.05), 0 16px 48px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.7)',
};

const detailCardStyle: React.CSSProperties = {
  borderRadius: 14, padding: 20,
  background: 'linear-gradient(145deg, rgba(255,255,255,0.7), rgba(255,255,255,0.4))',
  border: '1px solid rgba(0,0,0,0.05)',
  backdropFilter: 'blur(20px)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.7)',
};

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, marginBottom: 14,
  textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(0,0,0,0.3)',
};

const tagStyle: React.CSSProperties = {
  fontSize: 11, padding: '3px 10px', borderRadius: 6, fontWeight: 500,
  border: '1px solid rgba(0,0,0,0.05)',
  background: 'rgba(0,0,0,0.03)', color: 'rgba(0,0,0,0.4)',
};

const bottomCardStyle: React.CSSProperties = {
  borderRadius: 14, padding: 20,
  background: 'linear-gradient(135deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.35) 100%)',
  border: '1px solid rgba(0,0,0,0.05)',
  backdropFilter: 'blur(20px)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.7)',
};
