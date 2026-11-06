/* ============================================================
   DANI BOSS — META PIXEL
   Pega aquí el ID del pixel (solo números). Vacío = no se carga nada.
   Eventos: PageView · Contact (cualquier WhatsApp) · Lead (diagnóstico,
   cupo fundador o formulario) · VideoConoceme (25/50/95 % con sonido).
   No se envía ningún dato que escriba el visitante.
   ============================================================ */
(function () {
  'use strict';
  var PIXEL_ID = '1474451694597346';
  if (!/^\d{10,20}$/.test(PIXEL_ID)) return;

  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
  document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq('set', 'autoConfig', false, PIXEL_ID); // no automatic SubscribedButtonClick: only the events below
  fbq('init', PIXEL_ID);
  fbq('track', 'PageView');

  var page = location.pathname.replace(/\/+$/, '') || '/';
  var LEADS = { diagnostico: 'Diagnóstico $33', fundador: 'Cupo fundador', orden: 'Guía ORDEN' };

  // Every WhatsApp link (landing buttons, form preview, guide pages)
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="wa.me/"]');
    if (!a) return;
    var key = a.getAttribute('data-wa') || (a.id === 'previewGo' ? 'form' : 'otro');
    var lead = LEADS[key] || (key === 'form' ? 'Formulario' : null);
    if (lead) fbq('track', 'Lead', { content_name: lead, page: page });
    else fbq('track', 'Contact', { content_name: 'WhatsApp · ' + key, page: page });
  }, true);

  // Welcome video watched with sound (the muted in-view teaser does not count)
  var v = document.getElementById('vdVideo');
  if (v) {
    var sent = {};
    v.addEventListener('timeupdate', function () {
      if (v.muted || !v.duration) return;
      var pct = v.currentTime / v.duration * 100;
      [25, 50, 95].forEach(function (m) {
        if (pct >= m && !sent[m]) { sent[m] = 1; fbq('trackCustom', 'VideoConoceme', { percent: m }); }
      });
    });
  }
})();
