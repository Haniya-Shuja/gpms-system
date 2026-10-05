# GPMS – GNSS Performance Monitoring System

Open `index.html` in a browser (no build step or server required).

## Folder structure

```
GNSS-SYSTEM/
├── index.html                  Home page
├── pages/                      One HTML file per module
│   ├── configuration.html
│   ├── position.html
│   ├── sky-view.html
│   ├── dop.html
│   ├── plan-view.html
│   ├── signal-tracking.html
│   ├── integrity.html
│   └── aviation.html
└── assets/
    ├── css/
    │   ├── main.css            Shared layout, sidebar, cards, buttons
    │   ├── rx-log.css          Footer + Rx • Logging • Error console
    │   └── pages/              One stylesheet per page (page-specific only)
    └── js/
        ├── core/
        │   ├── app.js          Shared: sidebar toggle, exit, active nav link
        │   └── rx-logger.js    Rx • Logging • Error engine + console UI
        └── pages/              One script per page (page-specific only)
```

Every page loads, in this order: `main.css` → `pages/<page>.css` → `rx-log.css`,
`rx-logger.js` (in `<head>`, so it can catch errors from everything else) →
`app.js` → `pages/<page>.js`.

## Rx • Logging • Error (footer)

Click **Rx • Logging • Error** in the footer (or press **Alt + L**) to open the console.

| Feature | Details |
|---|---|
| RX log | NMEA sentences with checksum validation; bad checksums are logged as errors, `GGA` no-fix as warnings |
| System log | `console.log/info/debug`, page open/load timing, online/offline, playback and configuration events |
| Error capture | Uncaught exceptions, unhandled promise rejections, `console.error/warn`, failed images/scripts/CSS, failed fetch/XHR |
| Footer counters | Live RX / LOG / WARN / ERR totals; LED turns amber (warnings) or pulses red (unread errors) |
| Console tools | Filter tabs, search, pause/resume, auto-scroll, copy, clear, export TXT / CSV / JSON, drag-to-resize |
| Persistence | Log survives navigation between pages (per browser tab session) |
| Demo RX | Tick **Demo RX** to generate simulated NMEA (1 Hz, entries tagged `[DEMO]`) for testing |

Loading a playback file on the Configuration page automatically validates it and logs a
summary (sentence counts per type, invalid lines with line numbers).

### Using it from your own code

```js
RxLogger.rx("Fix acquired", { sats: 12 });      // receiver message
RxLogger.feed("$GPGGA,...*47");                 // validate + log one live NMEA sentence
RxLogger.analyzeNMEA(fileText, "file.nmea");    // validate + summarise a whole file
RxLogger.info("..."); RxLogger.warn("..."); RxLogger.error("...");
```
