const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getServerInfo: () => ipcRenderer.invoke('get-server-info'),
  getModels: () => fetch('http://localhost:3456/api/models').then(r => r.json()),
  onIpChanged: (callback) => {
    ipcRenderer.on('ip-changed', (event, data) => callback(data));
  },
});
