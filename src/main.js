const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const https = require('https')

let mainWindow
const getDataPath = (file) => path.join(app.getPath('userData'), file)

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1100, minHeight: 700,
    frame: false, backgroundColor: '#08090f',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, webSecurity: false },
    show: false
  })
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('maximize',   () => mainWindow.webContents.send('window-maximized', true))
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window-maximized', false))
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

ipcMain.on('win-minimize', () => mainWindow?.minimize())
ipcMain.on('win-maximize', () => { if (mainWindow?.isMaximized()) mainWindow.unmaximize(); else mainWindow?.maximize() })
ipcMain.on('win-close',    () => mainWindow?.close())

ipcMain.handle('load-movies',   () => { try { const p=getDataPath('movies.json'); return fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):[] } catch{return[]} })
ipcMain.handle('save-movies',   (_,d) => { try{fs.writeFileSync(getDataPath('movies.json'),JSON.stringify(d,null,2));return{ok:true}}catch(e){return{ok:false,error:e.message}} })
ipcMain.handle('load-settings', () => { try{const p=getDataPath('settings.json');return fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):{apiKey:''}}catch{return{apiKey:''}} })
ipcMain.handle('save-settings', (_,s) => { try{fs.writeFileSync(getDataPath('settings.json'),JSON.stringify(s,null,2));return{ok:true}}catch(e){return{ok:false,error:e.message}} })

function omdbGet(url) {
  return new Promise((resolve) => {
    const req = https.get(url, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => { try{resolve(JSON.parse(data))}catch{resolve({error:'Parse error'})} })
    })
    req.on('error', e => resolve({error:e.message}))
    req.setTimeout(10000, () => { req.destroy(); resolve({error:'Timeout'}) })
  })
}

ipcMain.handle('search-omdb',       (_,{title,year,apiKey}) => omdbGet(`https://www.omdbapi.com/?t=${encodeURIComponent(title)}${year?'&y='+encodeURIComponent(year):''}&plot=full&apikey=${apiKey}`))
ipcMain.handle('search-omdb-id',    (_,{imdbId,apiKey})     => omdbGet(`https://www.omdbapi.com/?i=${imdbId}&plot=full&apikey=${apiKey}`))
ipcMain.handle('search-omdb-multi', (_,{title,apiKey})      => omdbGet(`https://www.omdbapi.com/?s=${encodeURIComponent(title)}&type=movie&apikey=${apiKey}`))

ipcMain.handle('scan-folder', (_,folderPath) => {
  try {
    if (!fs.existsSync(folderPath)) return {error:'Folder ne postoji'}
    const exts = new Set(['.mp4','.mkv','.avi','.mov','.wmv','.m4v','.flv','.ts','.mpg','.mpeg','.divx','.rm','.rmvb'])
    return { files: fs.readdirSync(folderPath).filter(f => exts.has(path.extname(f).toLowerCase())) }
  } catch(e) { return {error:e.message} }
})

ipcMain.handle('open-folder-dialog', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties:['openDirectory'], title:'Odaberi folder' })
  return r.canceled ? null : r.filePaths[0]
})

ipcMain.on('open-in-explorer', (_,p) => { if (p && fs.existsSync(p)) shell.openPath(p) })

ipcMain.handle('export-csv', async (_,csvContent) => {
  const r = await dialog.showSaveDialog(mainWindow, {
    title:'Sačuvaj CSV',
    defaultPath:`filmoteka-${new Date().toISOString().slice(0,10)}.csv`,
    filters:[{name:'CSV',extensions:['csv']}]
  })
  if (r.canceled) return {ok:false}
  try { fs.writeFileSync(r.filePath, '\uFEFF'+csvContent,'utf8'); return {ok:true,path:r.filePath} }
  catch(e) { return {ok:false,error:e.message} }
})

ipcMain.handle('export-pdf', async (_,htmlContent) => {
  const r = await dialog.showSaveDialog(mainWindow, {
    title:'Sačuvaj PDF',
    defaultPath:`filmoteka-${new Date().toISOString().slice(0,10)}.pdf`,
    filters:[{name:'PDF',extensions:['pdf']}]
  })
  if (r.canceled) return {ok:false}
  const win = new BrowserWindow({show:false,webPreferences:{contextIsolation:true}})
  await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(htmlContent))
  try {
    const pdf = await win.webContents.printToPDF({printBackground:true,pageSize:'A4',margins:{top:0.5,bottom:0.5,left:0.5,right:0.5}})
    fs.writeFileSync(r.filePath, pdf)
    win.close()
    shell.openPath(r.filePath)
    return {ok:true,path:r.filePath}
  } catch(e) { win.close(); return {ok:false,error:e.message} }
})
