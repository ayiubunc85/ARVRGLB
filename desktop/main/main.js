const { app, BrowserWindow, powerSaveBlocker, ipcMain } = require('electron');
const path = require('path');
const { startServer, stopServer, getServerUrl, getNetworkMode, onIpChange } = require('./server');

let mainWindow;
let powerBlockerId;
let serverPort;

const isDev = process.env.NODE_ENV !== 'production';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'AR Model Viewer',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(
      path.join(__dirname, '..', 'renderer', 'dist', 'index.html')
    );
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Prevent laptop sleep while server is active
  powerBlockerId = powerSaveBlocker.start('prevent-app-suspension');

  // Start the local LAN server (auto-finds available port)
  const { port } = await startServer(3456);
  serverPort = port;

  const network = getNetworkMode();
  console.log(`AR server running at ${getServerUrl()}`);
  console.log(`Network mode: ${network.mode} (${network.interfaceName})`);

  if (network.mode === 'offline') {
    console.log('WARNING: No network interface found. Phone connections will not work.');
    console.log('Connect to WiFi or enable a mobile hotspot.');
  }

  // Watch for IP changes and notify the renderer
  onIpChange(({ oldIp, newIp, network }) => {
    console.log(`IP changed: ${oldIp} → ${newIp} (${network.mode})`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ip-changed', { oldIp, newIp, network });
    }
  });

  // IPC: renderer can request server info
  ipcMain.handle('get-server-info', () => {
    const net = getNetworkMode();
    return {
      ip: net.ip,
      port: serverPort,
      url: getServerUrl(),
      networkMode: net.mode,
      interfaceName: net.interfaceName,
    };
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', async () => {
  await stopServer();
});

app.on('window-all-closed', () => {
  if (powerBlockerId !== undefined) {
    powerSaveBlocker.stop(powerBlockerId);
  }
  if (process.platform !== 'darwin') app.quit();
});
