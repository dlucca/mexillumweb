/* Mexillum landing — progressive enhancement.
   Nothing here is required for the page to be readable; it adds the
   scroll-in reveal and the contact-form acknowledgement. */
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

  /* ---- contact form: validation + calm confirmation ------------------- */
  var form = document.querySelector('.cta__form');
  if (form) {
    var done = document.querySelector('.cta__done');
    var submitBtn = form.querySelector('button[type="submit"]');

    var isEmail = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); };
    var isPhone = function (v) { return v.replace(/\D/g, '').length >= 10; };

    var fields = [
      { el: form.querySelector('#f-nombre'),   err: form.querySelector('#err-nombre'),   test: function (v) { return v.trim().length > 1; } },
      { el: form.querySelector('#f-empresa'),  err: form.querySelector('#err-empresa'),  test: function (v) { return v.trim().length > 1; } },
      { el: form.querySelector('#f-sector'),   err: form.querySelector('#err-sector'),   test: function (v) { return v !== ''; } },
      { el: form.querySelector('#f-contacto'), err: form.querySelector('#err-contacto'), test: function (v) { return isEmail(v) || isPhone(v); } }
    ];

    var mark = function (f, invalid) {
      f.el.classList.toggle('mx-input--invalid', invalid);
      f.el.setAttribute('aria-invalid', invalid ? 'true' : 'false');
      if (f.err) f.err.hidden = !invalid;
    };

    // Forgiving: clear a field's error the moment it becomes valid.
    fields.forEach(function (f) {
      var evt = f.el.tagName === 'SELECT' ? 'change' : 'input';
      f.el.addEventListener(evt, function () {
        if (f.el.classList.contains('mx-input--invalid') && f.test(f.el.value)) mark(f, false);
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var firstBad = null;
      fields.forEach(function (f) {
        var ok = f.test(f.el.value);
        mark(f, !ok);
        if (!ok && !firstBad) firstBad = f.el;
      });
      if (firstBad) { firstBad.focus(); return; }

      // Brief pending state — stands in for a real POST to the lead endpoint.
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando…';
      window.setTimeout(function () {
        form.hidden = true;
        if (done) { done.hidden = false; done.focus(); }
      }, 650);
    });
  }
})();
