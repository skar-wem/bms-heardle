self.addEventListener('fetch', event => {
  if (location.hostname === 'skar-wem.github.io') {
    const url = new URL(event.request.url);
    const redirectURL = 'https://skar.fun/bms' + url.pathname.replace('/bms-heardle', '');
    event.respondWith(Response.redirect(redirectURL, 301));
  }
});