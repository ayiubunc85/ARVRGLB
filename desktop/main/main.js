const { app, BrowserWindow, powerSaveBlocker, ipcMain } = require('electron');
const path = require('path');
const { startServer, stopServer, getServerUrl, getHttpUrl, getNetworkMode, onIpChange } = require('./server');

let mainWindow;
let powerBlockerId;
let serverPort;
let serverHttpsPort;

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
  powerBlockerId = powerSaveBlocker.start('prevent-app-suspension');

  const result = await startServer(3456);
  serverPort = result.port;
  serverHttpsPort = result.httpsPort;

  const network = getNetworkMode();
  console.log(`HTTP server: ${getHttpUrl()}`);
  if (serverHttpsPort) {
    console.log(`HTTPS server: ${getServerUrl()} (for phones / AR)`);
    console.log('Phones will see a certificate warning on first visit — tap "Advanced" → "Proceed" to continue.');
  } else {
    console.log('WARNING: HTTPS not available. AR on phones may not work.');
  }
  console.log(`Network mode: ${network.mode} (${network.interfaceName})`);

  if (network.mode === 'offline') {
    console.log('WARNING: No network interface found. Phone connections will not work.');
    console.log('Connect to WiFi or enable a mobile hotspot.');
  }

  onIpChange(({ oldIp, newIp, network }) => {
    console.log(`IP changed: ${oldIp} → ${newIp} (${network.mode})`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ip-changed', { oldIp, newIp, network });
    }
  });

  ipcMain.handle('get-server-info', () => {
    const net = getNetworkMode();
    return {
      ip: net.ip,
      port: serverPort,
      httpsPort: serverHttpsPort,
      url: getServerUrl(),
      httpUrl: getHttpUrl(),
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
