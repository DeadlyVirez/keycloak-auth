# Keycloak Identity Brokering Demo

## Über das Projekt
Dieses Projekt demonstriert die Implementierung von Identity Brokering in Keycloak mit Dex als externem Identity Provider (IdP). Es zeigt:

- Konfiguration von Keycloak als Service Provider (SP)
- Einrichtung von Dex als Identity Provider
- Implementierung einer Node.js Anwendung mit OpenID Connect
- Übermittlung von Benutzerrollen und Claims von Dex über Keycloak zur Anwendung

## Architektur

```plaintext
+-------------+     +-----------+     +---------+
|  Demo App   | --> | Keycloak  | --> |   Dex   |
| (Node.js)   |     | (IdP/SP)  |     |  (IdP)  |
+-------------+     +-----------+     +---------+
```

## Voraussetzungen

- Docker und Docker Compose
- Node.js 18+
- Git

## Installation

1. Repository klonen:
```bash
git clone https://github.com/yourusername/keycloak-auth
cd keycloak-auth
```

2. Services starten:
```bash
docker-compose up -d
```

3. Warten bis alle Services gestartet sind:
```bash
docker-compose logs -f keycloak-health
```

## Keycloak Konfiguration

1. Keycloak Admin Console aufrufen: http://localhost:8080
2. Einloggen mit admin/admin
3. Zu "Identity Providers" navigieren
4. Neuen Provider "Dex" hinzufügen
5. Konfigurieren:
   - Client ID: keycloak
   - Client Secret: dex-secret
   - Authorization URL: http://dex:5556/dex/auth
   - Token URL: http://dex:5556/dex/token

## Anwendung Testen

1. Demo App aufrufen: http://localhost:3000
2. "Login" klicken
3. "Dex" als Identity Provider auswählen
4. Mock-Credentials von Dex verwenden
5. Rollenverteilung und Benutzerinfo beobachten

## Entwicklung

```bash
# Dependencies installieren
npm ci

# Im Entwicklungsmodus starten
npm run dev

# Tests ausführen
npm test
```

## Projektstruktur

```plaintext
.
├── app.mjs                 # Hauptanwendungsdatei
├── docker-compose.yml      # Docker Services Konfiguration
├── realm.json             # Keycloak Realm Konfiguration
├── dex-config.yaml        # Dex IdP Konfiguration
├── .env                   # Umgebungsvariablen
└── package.json           # Node.js Dependencies
```

## Fehlerbehebung

Container Logs überprüfen:
```bash
docker-compose logs keycloak
docker-compose logs dex
docker-compose logs app
```

Netzwerkverbindung prüfen:
```bash
docker-compose exec app curl -v http://keycloak:8080/auth/realms/example-realm
```

Container Status prüfen:
```bash
docker-compose ps
```

## Architektur Details

### Authentifizierungsfluss

1. Benutzer ruft die Demo App auf
2. Weiterleitung zu Keycloak
3. Benutzer wählt Dex als Identity Provider
4. Authentifizierung bei Dex
5. Dex sendet Token an Keycloak
6. Keycloak erstellt Session und sendet Token an App
7. App validiert Token und erstellt User Session

### Sicherheitsaspekte

- Alle Kommunikation läuft über HTTPS (in Produktion)
- Token-basierte Authentifizierung
- Secure Session Management
- CSRF Protection
- XSS Prevention durch Helmet

## Lizenz

MIT

## Mitwirken

Pull Requests sind willkommen. Für größere Änderungen bitte zuerst ein Issue erstellen.