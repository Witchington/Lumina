// The only bridge between the editor page and the computer: a short list of file actions.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('lumina', {
  desktop: true,
  info: ipcRenderer.sendSync('app:info'),
  pathFor: file => { try { return webUtils.getPathForFile(file) || ''; } catch { return ''; } },
  mediaURL: p => 'lumina://app/@media/' + encodeURIComponent(p),
  saveProject: (json, filePath, saveAs) => ipcRenderer.invoke('project:save', { json, filePath, saveAs }),
  openProject: filePath => ipcRenderer.invoke('project:open', filePath),
  exists: paths => ipcRenderer.invoke('file:exists', paths),
  locate: name => ipcRenderer.invoke('file:locate', name),
  speechStatus: () => ipcRenderer.invoke('speech:status'),
  speechDownload: () => ipcRenderer.invoke('speech:download'),
  onSpeechProgress: fn => { ipcRenderer.removeAllListeners('speech:progress'); ipcRenderer.on('speech:progress', (e, p) => fn(p)); },
  saveExport: (data, name, filePath) => ipcRenderer.invoke('export:save', { data, name, filePath }),
  convertExport: opts => ipcRenderer.invoke('export:convert', opts),
  onExportProgress: fn => { ipcRenderer.removeAllListeners('export:progress'); ipcRenderer.on('export:progress', (e, f) => fn(f)); },
  convStatus: () => ipcRenderer.invoke('conv:status'),
  convInstall: () => ipcRenderer.invoke('conv:install'),
  convResolve: opts => ipcRenderer.invoke('conv:resolve', opts),
  convRun: opts => ipcRenderer.invoke('conv:run', opts),
  convCancel: id => ipcRenderer.invoke('conv:cancel', id),
  convFolder: current => ipcRenderer.invoke('conv:folder', current),
  onConvProgress: fn => { ipcRenderer.removeAllListeners('conv:progress'); ipcRenderer.on('conv:progress', (e, p) => fn(p)); },
  clipRead: () => ipcRenderer.invoke('clip:read'),
  clipWrite: d => ipcRenderer.invoke('clip:write', d),
  showInFolder:p => ipcRenderer.invoke('show-in-folder', p),
  setDirty: v => ipcRenderer.send('dirty', v),
  setTitle: t => ipcRenderer.send('title', t),
  closeNow: () => ipcRenderer.send('close-now'),
  on: (channel, fn) => { if (['open-path', 'save-and-close'].includes(channel)) ipcRenderer.on(channel, (e, ...a) => fn(...a)); }
});
