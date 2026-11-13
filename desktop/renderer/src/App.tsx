import React, { useEffect, useState, useCallback, useRef } from 'react';
import ServerStatus from './components/ServerStatus';
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

const API_BASE = '';

export default function App() {
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const fetchData = useCallback(() => {
    fetch(`${API_BASE}/api/info`)
      .then(r => r.json())
      .then(setServerInfo)
      .catch(() => setError('Could not connect to local server'));

    fetch(`${API_BASE}/api/models`)
      .then(r => r.json())
      .then((models: ModelEntry[]) => {
        setModels(models);
        if (models.length > 0 && !selectedId) {
          setSelectedId(models[0].id);
        }
      })
      .catch(() => {});
  }, [selectedId]);

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
      }
      fetchData();
    } catch {} finally {
      setUploading(false);
    }
  }, [fetchData]);

  const deleteModel = useCallback(async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/models/${id}`, { method: 'DELETE' });
      if (selectedId === id) {
        setSelectedId(models.find(m => m.id !== id)?.id || null);
      }
      fetchData();
    } catch {}
  }, [selectedId, models, fetchData]);

  const renameModel = useCallback(async (id: string, newName: string) => {
    try {
      const r = await fetch(`${API_BASE}/api/models/${id}/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName }),
      });
      const data = await r.json();
      if (data.id) {
        setSelectedId(data.id);
      }
      setRenaming(false);
      fetchData();
    } catch {
      setRenaming(false);
    }
  }, [fetchData]);

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
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  }, [uploadFiles]);

  const selectedModel = models.find(m => m.id === selectedId) || null;

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drop overlay */}
      {dragging && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(67, 97, 238, 0.08)',
          border: '3px dashed #4361ee',
          borderRadius: 12,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 16,
            padding: '32px 48px',
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4361ee" strokeWidth="1.5" style={{ marginBottom: 12 }}>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#1d1d1f' }}>Drop model files here</p>
            <p style={{ fontSize: 13, color: 'rgba(0,0,0,0.45)', marginTop: 4 }}>.glb, .gltf, or .usdz</p>
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

      {/* Header */}
      <header style={{
        padding: '20px 28px',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1d1d1f' }}>AR Model Viewer</h1>
            <p style={{ fontSize: 13, color: 'rgba(0,0,0,0.4)', marginTop: 2 }}>
              Serve 3D models to phones via AR
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.35)' }}>
              {models.length} model{models.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{
                background: '#4361ee',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: uploading ? 'default' : 'pointer',
                opacity: uploading ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {uploading ? 'Importing...' : 'Import'}
            </button>
          </div>
        </div>
      </header>

      {/* Server status */}
      <div style={{ padding: '16px 28px 0', flexShrink: 0 }}>
        <ServerStatus serverInfo={serverInfo} error={error} />
      </div>

      {/* Main content */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        padding: '16px 28px 28px',
        gap: 24,
      }}>
        {/* Model grid */}
        <div style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#1d1d1f' }}>
              Models
            </h2>
          </div>

          {models.length === 0 ? (
            <div style={{
              background: '#fff',
              borderRadius: 12,
              padding: 48,
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <svg
                width="48" height="48" viewBox="0 0 24 24"
                fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5"
                style={{ marginBottom: 16 }}
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              <p style={{ fontSize: 14, color: 'rgba(0,0,0,0.5)' }}>
                No models yet
              </p>
              <p style={{ fontSize: 13, color: 'rgba(0,0,0,0.35)', marginTop: 8 }}>
                Drag and drop <code style={{ color: '#4361ee' }}>.glb</code> or{' '}
                <code style={{ color: '#4361ee' }}>.usdz</code> files here, or click{' '}
                <span style={{ color: '#4361ee', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
                  Import
                </span>
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 14,
            }}>
              {models.map(model => (
                <ModelCard
                  key={model.id}
                  model={model}
                  selected={model.id === selectedId}
                  onSelect={setSelectedId}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedModel && (
          <aside style={{
            width: 300,
            flexShrink: 0,
            background: '#fff',
            borderRadius: 12,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
            overflow: 'auto',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            {renaming ? (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  if (renameValue.trim()) renameModel(selectedModel.id, renameValue);
                }}
                style={{ width: '100%', display: 'flex', gap: 8 }}
              >
                <input
                  autoFocus
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  style={{
                    flex: 1,
                    background: '#f5f5f7',
                    border: '1px solid #4361ee',
                    borderRadius: 6,
                    padding: '6px 10px',
                    color: '#1d1d1f',
                    fontSize: 14,
                    outline: 'none',
                  }}
                  onKeyDown={e => { if (e.key === 'Escape') setRenaming(false); }}
                />
                <button type="submit" style={{
                  background: '#4361ee', color: '#fff', border: 'none',
                  borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>Save</button>
              </form>
            ) : (
              <h3 style={{
                fontSize: 16,
                fontWeight: 600,
                color: '#1d1d1f',
                textTransform: 'capitalize',
                textAlign: 'center',
              }}>
                {selectedModel.id.replace(/[-_]/g, ' ')}
              </h3>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  setRenameValue(selectedModel.id);
                  setRenaming(true);
                }}
                style={actionBtnStyle}
                title="Rename"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Rename
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete "${selectedModel.id}" and all its files?`)) {
                    deleteModel(selectedModel.id);
                  }
                }}
                style={{ ...actionBtnStyle, color: '#ef4444' }}
                title="Delete"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
                Delete
              </button>
            </div>

            {/* 3D Preview */}
            <ModelPreview
              src={`${API_BASE}/models/${selectedModel.filename}`}
              style={{
                width: '100%',
                height: 200,
                background: '#f0f0f2',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            />

            {/* QR Code */}
            <QRCode
              url={selectedModel.arUrl}
              size={220}
              label="Scan with phone camera to view in AR"
            />

            {/* Model details */}
            <div style={{ width: '100%' }}>
              <DetailRow label="Format" value={selectedModel.format.toUpperCase()} />
              <DetailRow label="File size" value={`${selectedModel.sizeMB} MB`} />
              <DetailRow
                label="Status"
                value={parseFloat(selectedModel.sizeMB) > 25 ? 'Large — may be slow on mobile' : 'Ready for AR'}
                valueColor={parseFloat(selectedModel.sizeMB) > 25 ? '#f59e0b' : '#22c55e'}
              />
            </div>

            {/* Optimize */}
            <OptimizePanel
              modelId={selectedModel.id}
              sizeMB={selectedModel.sizeMB}
              onOptimized={fetchData}
            />

            {/* USDZ Conversion */}
            {selectedModel.format === 'glb' && (
              <UsdzPanel
                modelId={selectedModel.id}
                onConverted={fetchData}
              />
            )}

            {/* AR URL */}
            <div style={{
              width: '100%',
              background: '#f0f0f2',
              borderRadius: 8,
              padding: 12,
              wordBreak: 'break-all',
              fontSize: 11,
              color: 'rgba(0,0,0,0.35)',
              textAlign: 'center',
              lineHeight: 1.5,
            }}>
              {selectedModel.arUrl}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  background: 'none',
  border: '1px solid rgba(0,0,0,0.1)',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 11,
  color: 'rgba(0,0,0,0.5)',
  cursor: 'pointer',
};

function DetailRow({ label, value, valueColor }: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 0',
      borderBottom: '1px solid rgba(0,0,0,0.06)',
    }}>
      <span style={{ fontSize: 13, color: 'rgba(0,0,0,0.45)' }}>{label}</span>
      <span style={{ fontSize: 13, color: valueColor || '#1d1d1f', fontWeight: 500 }}>{value}</span>
    </div>
  );
}
