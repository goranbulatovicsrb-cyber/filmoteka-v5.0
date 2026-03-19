# 🎬 FILMOTEKA — Cinema Movie Catalog

Vaša lična kino kolekcija filmova sa spektakularnim animacijama.

---

## 🚀 Instalacija (za korisnike)

1. **Fork/push** ovaj repo na GitHub
2. Idi na **Actions** tab u GitHub-u
3. Klikni **Build Filmoteka Windows** → **Run workflow**
4. Sačekaj ~5 minuta
5. Preuzmi `Filmoteka-Windows-Setup.zip` sa Artifacts
6. Otpakuj i pokreni `Filmoteka Setup X.X.X.exe`
7. Instaliraj i uživaj! 🎬

---

## 🔑 OMDB API Ključ (za IMDB podatke)

Filmoteka koristi OMDB API za preuzimanje postera, ocjena i informacija o filmovima.

1. Idi na: https://www.omdbapi.com/apikey.aspx
2. Registruj besplatan račun (**Free tier: 1000 zahtjeva/dan**)
3. Provjeri email i aktiviraj ključ
4. U Filmoteci: klikni ⚙ **Postavke** → unesi API ključ

---

## ✨ Mogućnosti

### 🎭 Spektakularna zavjesa
- Aplikacija se otvara sa crvenom baršunastom zavjesom
- Kliknite da otvorite zavjesu i otkrijete vašu kolekciju

### 📚 Police sa filmovima
- Filmovi prikazani na realističnim drvenim policama
- Hover efekt — film "ustaje" sa police
- Svaki film prikazuje plakat sa IMDB-a

### 🎬 Dodavanje filmova
**Ručno:**
- Kliknite `+ Dodaj film`
- Pretražite IMDB ili unesite ručno
- Postavite lokaciju na hard disku

**Automatski skeniranje foldera:**
- Kliknite `📁 Skeniraj`
- Odaberite folder sa video fajlovima
- Aplikacija automatski:
  - Prepoznaje nazive filmova iz naziva fajlova
  - Preuzima plakate, ocjene i info sa IMDB-a
  - Dodaje sve u kolekciju

### 🏠🌍 Kategorije
- **Domaći filmovi** — filmovi iz ex-Yu regije
- **Strani filmovi** — međunarodna produkcija

### 📊 Za svaki film
- IMDB ocjena ⭐
- Poster/plakat
- Godina, žanr, reditelj
- Lokacija na hard disku (koji disk, koji folder)
- Naziv originalnog fajla
- Radnja filma
- Oznaka "Gledan/Negledano"

### 🔍 Pretraga i sortiranje
- Pretraga po nazivu u realnom vremenu
- Sortiranje: A→Z, Godina, Ocjena, Nedavno dodani
- Filter: Svi / Domaći / Strani

---

## 💾 Podaci

Filmovi su sačuvani lokalno u:
```
C:\Users\[Korisnik]\AppData\Roaming\filmoteka\movies.json
```

Mogu se exportati/importati ručno (plain JSON format).

---

## 🛠 Za programere (lokalni razvoj)

```bash
npm install
npm start
```

Build za Windows:
```bash
npm run build:win
```

---

## 📋 Podržani video formati

`.mp4` `.mkv` `.avi` `.mov` `.wmv` `.m4v` `.flv` `.ts` `.mpg` `.mpeg` `.divx` `.rm` `.rmvb`

---

*Napravljeno sa ❤️ i Electron.js*
