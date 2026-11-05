/* DANI BOSS — luz que sigue al cursor en las tarjetas y en el arco de la portada. */
(function () {
  'use strict';
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var CARDS = '.dx-card,.plan,.case,.mod,.sol-q,.sol-p,.form,.cmp,.sys';
  var sky = document.querySelector('.sky');
  var last = null, frame = 0, current = null;

  function clear(card) { card.style.removeProperty('--mx'); card.style.removeProperty('--my'); }

  document.addEventListener('pointermove', function (e) {
    last = e;
    if (frame) return;
    frame = requestAnimationFrame(function () {
      frame = 0;
      var card = last.target.closest ? last.target.closest(CARDS) : null;
      if (current && current !== card) clear(current);
      current = card;
      if (card) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (last.clientX - r.left).toFixed(0) + 'px');
        card.style.setProperty('--my', (last.clientY - r.top).toFixed(0) + 'px');
      }
      if (sky && window.scrollY < 700) sky.style.setProperty('--px', ((last.clientX / innerWidth - .5) * 90).toFixed(0) + 'px');
    });
  }, { passive: true });
})();
