# 🎉 Bingo Spiel - Multiplayer Web Application

Eine schöne, moderne Web-Application für Multiplayer-Bingo mit WebSocket-Echtzeit-Kommunikation.

## Features

✨ **4x4 Bingo Grid** - Klassisches Bingo-Format
🎮 **Echtzeit Multiplayer** - Mehrere Spieler können gleichzeitig spielen
📝 **Flexible Wort-Verwaltung** - Wörter aus CSV-Datei laden
⚙️ **Schwierigkeitsgrad** - Jedes Spiel hat automatisch 1 schweres, 1 mittleres und 2 leichte Wörter
🎨 **Modernes Design** - Responsive UI mit schönem Gradient
🐳 **Docker Support** - Ein Befehl zum Starten

## Installation & Setup

### Option 1: Docker (Empfohlen)

#### Voraussetzungen
- Docker und Docker Compose installiert
- [Docker Desktop Download](https://www.docker.com/products/docker-desktop)

#### Starten
```bash
cd Schweisstal_bingo
docker-compose up --build
```

Die App ist dann verfügbar unter:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

### Option 2: Lokal ohne Docker

#### Voraussetzungen
- Node.js 16+ installiert
- npm oder yarn

#### Server starten
```bash
cd server
npm install
npm start
```

Der Server läuft auf http://localhost:3001

#### Frontend starten (neues Terminal)
```bash
cd client
npm install
npm start
```

Der Frontend läuft auf http://localhost:3000

## Wörter anpassen

Die Wörter sind in `data/words.csv` gespeichert. Format:

```csv
word,difficulty
Katze,leicht
Hund,leicht
Musik,mittel
Philosophie,schwer
```

**Schwierigkeitsgrad**: `leicht`, `mittel`, `schwer`

Jedes Bingo-Grid erhält automatisch:
- 1 schweres Wort
- 1 mittleres Wort
- 2 leichte Wörter
- Zusammen mit zufälligen Positionen im 4x4 Grid

## Wie man spielt

1. **Spiel erstellen**
   - Gib deinen Namen ein
   - Klick auf "Spiel erstellen"
   - Teile den Spiel-Code mit Freunden

2. **Spiel beitreten**
   - Andere Spieler geben ihren Namen ein
   - Geben den Spiel-Code ein
   - Klick auf "Beitreten"

3. **Spiel starten**
   - Der Host (Ersteller) klickt "Spiel starten"
   - Jeder Spieler erhält sein eigenes zufälliges Grid

4. **Spielen**
   - Klicke auf Wörter, um sie zu markieren
   - Schau die Scores der anderen Spieler in der Sidebar
   - Wenn du alle 16 Wörter markiert hast, gewinnst du!

5. **Runden**
   - Der Host klickt "Runde beenden", um zur nächsten Runde zu gehen
   - Das Spiel läuft 10 Runden
   - Am Ende werden die Scores verglichen

## Architektur

```
Schweisstal_bingo/
├── server/              # Node.js + Express + Socket.io
│   ├── server.js        # Hauptserver & Game Logic
│   └── package.json
├── client/              # React Frontend
│   ├── src/
│   │   ├── App.js       # Haupt-Komponente
│   │   └── index.css    # Styling
│   └── package.json
├── data/
│   └── words.csv        # Bingo-Wörter
├── Dockerfile           # Docker Build-Datei
└── docker-compose.yml   # Docker Compose Setup
```

## Technologie-Stack

- **Frontend**: React 18
- **Backend**: Node.js, Express, Socket.io
- **Echtzeit**: WebSocket (Socket.io)
- **Styling**: CSS3 mit Gradients & Animations
- **Containerization**: Docker & Docker Compose

## Troubleshooting

### Port bereits in Benutzung
```bash
# Port 3000 freigeben
lsof -ti:3000 | xargs kill -9
# Port 3001 freigeben
lsof -ti:3001 | xargs kill -9
```

### Docker Build schlägt fehl
```bash
# Clean rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up
```

### Connection Issues
- Stelle sicher, dass Firewall nicht blockiert
- Beide Ports (3000, 3001) müssen offen sein
- Überprüfe die Browser-Konsole auf Fehler (F12)

## Lizenz

MIT

## Autor

Erstellt für Schweisstal Bingo 🎉

---

**Viel Spaß beim Spielen!** 🎮
