/* =========================
   main.js (FULL FILE)
   GreenGO - Mobile Header Lock Step 1
   ========================= */

document.addEventListener("DOMContentLoaded", function () {

  /* =========================
     MOBILE HEADER LOCK
     Blochează complet meniul pe mobil
     ========================= */
  function disableMobileNavigation() {
    if (window.innerWidth <= 768) {

      const selectors = [
        '.nav-links',
        '.nav-menu',
        '.menu',
        '.hamburger',
        '.mobile-menu',
        '.offcanvas',
        '.sidebar',
        '.menu-toggle',
        '.navbar-links',
        '.navigation-links',
        '.header-menu',
        '.drawer',
        '.drawer-menu'
      ];

      selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          el.style.display = 'none';
          el.style.visibility = 'hidden';
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          el.style.width = '0';
          el.style.maxWidth = '0';
          el.style.overflow = 'hidden';
        });
      });

      /* Dezactivează orice event pe hamburger */
      const hamburgerButtons = document.querySelectorAll(
        '.hamburger, .menu-toggle, .burger, .mobile-toggle'
      );

      hamburgerButtons.forEach(button => {
        button.onclick = function(e) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        };

        button.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }, true);
      });

      /* Elimină clase active/open */
      document.querySelectorAll('.active, .open, .show').forEach(el => {
        if (
          el.classList.contains('mobile-menu') ||
          el.classList.contains('nav-menu') ||
          el.classList.contains('sidebar') ||
          el.classList.contains('drawer')
        ) {
          el.classList.remove('active', 'open', 'show');
        }
      });

      document.body.style.overflowX = 'hidden';
      document.documentElement.style.overflowX = 'hidden';
    }
  }

  disableMobileNavigation();

  window.addEventListener("resize", function () {
    disableMobileNavigation();
  });


  /* =========================
     RESTUL SCRIPTURILOR SITE-ULUI
     (păstrează aici tot ce aveai deja)
     ========================= */

  if (typeof AOS !== "undefined") {
    AOS.init({
      duration: 800,
      once: true
    });
  }

});