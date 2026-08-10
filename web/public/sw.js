const CACHE_NAME = "barberpro-v3";
const STATIC_ASSETS = [
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── Notificações (Web Push) ─────────────────────────────────────────
   Chega mesmo com o app fechado. No iPhone exige iOS 16.4+ e o PWA
   instalado na tela de início. */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "BarberPro", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "BarberPro";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "barberpro",
    renotify: true,
    data: { url: data.url || "/admin/painel" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Tocar na notificação: foca a janela já aberta ou abre o painel
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/admin/painel";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(target) && "focus" in client) return client.focus();
      }
      for (const client of list) {
        if ("navigate" in client && "focus" in client) {
          return client.navigate(target).then((c) => (c ? c.focus() : undefined));
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Nunca cachear/interceptar chamadas de API
  if (url.pathname.startsWith("/api/")) return;

  // Só GET pode ser cacheado
  if (request.method !== "GET") return;

  // HTML/navegação → NETWORK-FIRST: sempre busca a versão mais nova,
  // só usa cache se estiver offline. Elimina o problema de "versão velha
  // depois de um deploy".
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Assets estáticos (JS/CSS/imagens do Next, com hash no nome) → CACHE-FIRST
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
