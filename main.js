document.addEventListener('DOMContentLoaded', () => {
    // Mobile menu toggle
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    const navOverlay = document.getElementById('nav-overlay');
    const body = document.body;

    const closeMenu = () => {
        menuToggle.classList.remove('active');
        navLinks.classList.remove('active');
        if (navOverlay) navOverlay.classList.remove('active');
        body.classList.remove('no-scroll');
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.setAttribute('aria-label', 'Deschide meniul');
    };

    const openMenu = () => {
        menuToggle.classList.add('active');
        navLinks.classList.add('active');
        if (navOverlay) navOverlay.classList.add('active');
        body.classList.add('no-scroll');
        menuToggle.setAttribute('aria-expanded', 'true');
        menuToggle.setAttribute('aria-label', 'Închide meniul');
    };

    if (menuToggle) {
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.addEventListener('click', () => {
            if (navLinks.classList.contains('active')) {
                closeMenu();
            } else {
                openMenu();
            }
        });
    }

    if (navOverlay) {
        navOverlay.addEventListener('click', closeMenu);
    }

    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            if (navLinks.classList.contains('active')) {
                closeMenu();
            }
        });
    });

    // --- Promotions Carousel ---
    const swiperContainer = document.querySelector('.promo-swiper');

    const initSwiper = () => {
        if (!window.Swiper) return;

        new Swiper('.promo-swiper', {
            effect: 'coverflow',
            grabCursor: true,
            centeredSlides: true,
            slidesPerView: 'auto',
            coverflowEffect: {
                rotate: 50,
                stretch: 0,
                depth: 100,
                modifier: 1,
                slideShadows: false,
            },
            loop: true,
            loopedSlides: 4,
            autoplay: {
                delay: 3000,
                disableOnInteraction: false,
            },
            pagination: {
                el: '.swiper-pagination',
                clickable: true,
            },
            touchEventsTarget: 'container',
            simulateTouch: true,
        });
    };

    if (swiperContainer) {
        initSwiper();
    }

    const partnerForm = document.getElementById('partner-form');
    const partnerFormStatus = document.getElementById('partner-form-status');
    if (partnerForm) {
        partnerForm.addEventListener('submit', (event) => {
            event.preventDefault();

            if (!partnerForm.checkValidity()) {
                partnerForm.reportValidity();
                return;
            }

            const fields = {
                restaurant: document.getElementById('biz-name').value.trim(),
                contact: document.getElementById('biz-contact').value.trim(),
                email: document.getElementById('biz-email').value.trim(),
                phone: document.getElementById('biz-phone').value.trim(),
                city: document.getElementById('biz-city').value || 'Nespecificat'
            };

            const subject = encodeURIComponent(`Solicitare parteneriat GreenGO - ${fields.restaurant}`);
            const body = encodeURIComponent(
                `Bună,\n\nVreau să discutăm despre un parteneriat GreenGO.\n\n` +
                `Restaurant: ${fields.restaurant}\n` +
                `Persoană contact: ${fields.contact}\n` +
                `Email: ${fields.email}\n` +
                `Telefon: ${fields.phone}\n` +
                `Localitate: ${fields.city}\n\n` +
                `Mulțumesc!`
            );

            window.location.href = `mailto:info@green-go.ro?subject=${subject}&body=${body}`;
            if (partnerFormStatus) {
                partnerFormStatus.textContent = 'Se deschide clientul de email cu solicitarea completată.';
            }
        });
    }

    // Scroll to Top Button
    const scrollTopBtn = document.getElementById('scroll-top');
    if (scrollTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 400) {
                scrollTopBtn.classList.add('visible');
            } else {
                scrollTopBtn.classList.remove('visible');
            }
        });
        scrollTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
});
