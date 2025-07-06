# Zair Bot

Un bot de música para Discord con muchas funciones, construido con Discord.js, Riffy y Lavalink. Este bot ofrece reproducción de música de alta calidad con soporte para YouTube, Spotify y más.

## Funciones

* 🎵 Reproducción de música de alta calidad
* 🎧 Soporte para YouTube y Spotify
* 📋 Sistema de gestión de la cola
* 🔄 Modos de repetición y aleatorio
* 🔊 Control de volumen
* 🎨 Mensajes embebidos visualmente atractivos
* ⚡ Reproducción rápida y confiable
* 🎯 Control preciso de las pistas

## Comandos

| Comando              | Descripción                                    | Uso                             |
| -------------------- | ---------------------------------------------- | ------------------------------- |
| `!play <query>`      | Reproducir una canción o lista de reproducción | `!play Never Gonna Give You Up` |
| `!pause`             | Pausar la pista actual                         | `!pause`                        |
| `!resume`            | Reanudar la pista actual                       | `!resume`                       |
| `!skip`              | Saltar la pista actual                         | `!skip`                         |
| `!stop`              | Detener la reproducción y limpiar la cola      | `!stop`                         |
| `!queue`             | Mostrar la cola actual                         | `!queue`                        |
| `!nowplaying`        | Mostrar información de la pista actual         | `!nowplaying`                   |
| `!volume <0-100>`    | Ajustar el volumen del reproductor             | `!volume 50`                    |
| `!shuffle`           | Mezclar la cola actual                         | `!shuffle`                      |
| `!loop`              | Alternar modo de repetición de la cola         | `!loop`                         |
| `!remove <posición>` | Remover una pista de la cola                   | `!remove 1`                     |
| `!clear`             | Limpiar la cola actual                         | `!clear`                        |
| `!status`            | Mostrar estado del reproductor                 | `!status`                       |
| `!help`              | Mostrar este mensaje de ayuda                  | `!help`                         |

## Requisitos previos

* Node.js 16.9.0 o superior
* Java 11 o superior (para Lavalink)
* Un token de bot de Discord
* Credenciales API de Spotify (opcional, para soporte de Spotify)

## Instalación

Clona el repositorio:

```bash
git clone <URL_DEL_REPOSITORIO>
cd zair-bot
```

Instala las dependencias:

```bash
npm install
```

Descarga y configura Lavalink:

* Descarga el último Lavalink.jar desde [Github](https://github.com/freyacodes/Lavalink/releases)
* Crea un archivo application.yml en el mismo directorio que Lavalink.jar
* Añade la siguiente configuración:

```yaml
server:
  port: 2333
  address: 127.0.0.1
spring:
  main:
    banner-mode: log
lavalink:
  server:
    password: "youshallnotpass"
    sources:
      youtube: true
      bandcamp: true
      soundcloud: true
      twitch: true
      vimeo: true
      http: true
    bufferDurationMs: 400
    youtubePlaylistLoadLimit: 6
    playerUpdateInterval: 5
    youtubeSearchEnabled: true
    soundcloudSearchEnabled: true
```

Configura el bot:

* Copia config.example.js a config.js
* Rellena tu token de bot y otras configuraciones:

```javascript
module.exports = {
    prefix: '!',
    nodes: [{
        host: "localhost",
        password: "youshallnotpass",
        port: 2333,
        secure: false,
        name: "Nodo Principal"
    }],
    spotify: {
        clientId: "TU_CLIENT_ID_DE_SPOTIFY",
        clientSecret: "TU_CLIENT_SECRET_DE_SPOTIFY"
    },
    botToken: "TU_TOKEN_DE_BOT",
    embedColor: "#FF0000"
};
```

Inicia Lavalink:

```bash
java -jar Lavalink.jar
```

Inicia el bot:

```bash
npm start
```

## Licencia

Este proyecto está licenciado bajo la licencia MIT - ver el archivo LICENSE para más detalles.

## Créditos

* [Discord.js](https://discord.js.org/)
* [Riffy](https://github.com/riffy-team/riffy)
* [Lavalink](https://github.com/freyacodes/Lavalink)
* [Spotify API](https://developer.spotify.com/)

---