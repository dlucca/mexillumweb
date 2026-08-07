/* Mexillum landing — progressive enhancement.
   Nothing here is required for the page to be readable (content is visible
   without JS; see the .js gate in the <head>). It adds the scroll-in reveal,
   the partner-logo text fallback, and the sticky-bar surface state. */
(function () {
  'use strict';

  /* ---- scroll reveal (fade + 10px rise, once per element) ------------- */
  var reveals = document.querySelectorAll('.reveal');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduce || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ---- partner logos: fall back to a text chip if the file is missing -- */
  document.querySelectorAll('.brand-logo[data-logo]').forEach(function (img) {
    img.addEventListener('error', function () {
      var chip = document.createElement('span');
      chip.className = 'brand-chip';
      chip.textContent = img.getAttribute('alt');
      img.replaceWith(chip);
    });
  });

  /* ---- sticky bar: solid surface after 80px of scroll ----------------- */
  var nav = document.querySelector('[data-nav]');
  if (nav) {
    var syncNav = function () { nav.classList.toggle('nav--scrolled', window.scrollY > 80); };
    syncNav();
    window.addEventListener('scroll', syncNav, { passive: true });
  }

})();
