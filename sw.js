/* ---------------------------------------------------------------------
   El Revuelo — funcionamiento sin conexión

   Guarda una copia del tablero en el celular la primera vez que lo abres
   con internet. A partir de ahí funciona en modo avión, en el potrero,
   donde sea. Cuando vuelve a haber señal, busca en segundo plano si hay
   una versión nueva y la deja lista para el siguiente arranque.

   Para publicar una versión nueva: sube el HTML a GitHub y cambia el
   número de VERSION de abajo. Eso obliga a todos los celulares a
   descartar la copia vieja y bajar la nueva.
   --------------------------------------------------------------------- */

const VERSION = 'v2';
const CACHE = 'el-revuelo-' + VERSION;

// Lo que se guarda de entrada. Si alguno no existe (por ejemplo porque
// no subiste los iconos), se omite sin romper el resto.
// Se apunta a la carpeta ('./') y no a un nombre de archivo concreto, para
// que siga funcionando aunque el HTML se llame index.html o cambie de nombre.
const PRECARGA = [
  './',
  './manifest.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', evento => {
  evento.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(PRECARGA.map(async url => {
      try {
        const resp = await fetch(url, { cache: 'reload' });
        if (resp.ok) await cache.put(url, resp);
      } catch (e) {
        // Un archivo que falte no debe impedir que el resto quede guardado.
      }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', evento => {
  evento.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(
      nombres.filter(n => n.startsWith('el-revuelo-') && n !== CACHE)
             .map(n => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', evento => {
  const req = evento.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // La página principal: se intenta la red primero para que las
  // correcciones lleguen apenas hay señal, con la copia guardada como
  // respaldo inmediato si no hay conexión.
  if (req.mode === 'navigate' || (req.destination === 'document')) {
    evento.respondWith((async () => {
      try {
        const resp = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, resp.clone());
        return resp;
      } catch (e) {
        const guardada = await caches.match(req) ||
                         await caches.match('./') ||
                         await caches.match(self.registration.scope);
        if (guardada) return guardada;
        return new Response(
          '<meta charset="utf-8"><body style="font-family:system-ui;padding:40px;text-align:center;color:#4a3226;background:#fdfaf4;">' +
          '<h2>Sin conexión</h2><p>Todavía no hay una copia guardada en este dispositivo. ' +
          'Ábrelo una vez con internet y después funcionará en modo avión.</p></body>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
    })());
    return;
  }

  // Iconos y demás: primero lo guardado, que es instantáneo.
  evento.respondWith((async () => {
    const guardada = await caches.match(req);
    if (guardada) return guardada;
    try {
      const resp = await fetch(req);
      if (resp.ok) {
        const cache = await caches.open(CACHE);
        cache.put(req, resp.clone());
      }
      return resp;
    } catch (e) {
      return new Response('', { status: 504, statusText: 'Sin conexión' });
    }
  })());
});

// Permite que la página fuerce una actualización desde el botón del pie.
self.addEventListener('message', evento => {
  if (evento.data === 'actualizar') self.skipWaiting();
});
