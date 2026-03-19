const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('api', {
  loadMovies:      ()       => ipcRenderer.invoke('load-movies'),
  saveMovies:      (m)      => ipcRenderer.invoke('save-movies', m),
  loadSettings:    ()       => ipcRenderer.invoke('load-settings'),
  saveSettings:    (s)      => ipcRenderer.invoke('save-settings', s),
  searchOmdb:      (p)      => ipcRenderer.invoke('search-omdb', p),
  searchOmdbId:    (p)      => ipcRenderer.invoke('search-omdb-id', p),
  searchOmdbMulti: (p)      => ipcRenderer.invoke('search-omdb-multi', p),
  scanFolder:      (p)      => ipcRenderer.invoke('scan-folder', p),
  openFolderDialog:()       => ipcRenderer.invoke('open-folder-dialog'),
  openInExplorer:  (p)      => ipcRenderer.send('open-in-explorer', p),
  exportCsv:       (csv)    => ipcRenderer.invoke('export-csv', csv),
  exportPdf:       (html)   => ipcRenderer.invoke('export-pdf', html),
  minimize:        ()       => ipcRenderer.send('win-minimize'),
  maximize:        ()       => ipcRenderer.send('win-maximize'),
  close:           ()       => ipcRenderer.send('win-close'),
  onMaximized:     (cb)     => ipcRenderer.on('window-maximized', (_,v) => cb(v))
})
