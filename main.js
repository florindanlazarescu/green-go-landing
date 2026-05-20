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
    };

    const openMenu = () => {
        menuToggle.classList.add('active');
        navLinks.classList.add('active');
        if (navOverlay) navOverlay.classList.add('active');
        body.classList.add('no-scroll');
        menuToggle.setAttribute('aria-expanded', 'true');
    };

    if (menuToggle) {
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.setAttribute('aria-label', 'Toggle navigation menu');
        menuToggle.addEventListener('click', () => {
            if (navLinks.classList.contains('active')) {
                closeMenu();
            } else {
                openMenu();
            }
        });
    }

    // Close menu on overlay click
    if (navOverlay) {
        navOverlay.addEventListener('click', closeMenu);
    }

    // Close menu when a link is clicked
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            if (navLinks.classList.contains('active')) {
                closeMenu();
            }
        });
    });

    // Initialize Animate on Scroll
    AOS.init({
        duration: 800,
        easing: 'ease-in-out',
        once: true,
        mirror: false,
    });

    // --- Promotions Carousel ---
    const promoCarousel = document.getElementById('promo-carousel');
    const swiperContainer = document.querySelector('.promo-swiper');

    const merchantDetails = {
        1: { name: 'Ograda Urbana', logo: 'poze/ograda.png' },
        3: { name: 'Corner Stuff', logo: 'poze/corner_stuff.jpg' },
        5: { name: 'Sarea\'N Bucate', logo: 'poze/sareanbucate.png' },
        6: { name: 'GYRO Mediterranean Flavors', logo: 'poze/gyro.jpg' }
    };

    const formatTargets = (promo) => {
        if (promo.scope === 'ALL') {
            return 'Ofertă în tot meniul';
        }
        if (promo.targets && promo.targets.length > 0) {
            const category = promo.targets[0].charAt(0).toUpperCase() + promo.targets[0].slice(1).toLowerCase();
            return `Ofertă la ${category}`;
        }
        return promo.name; // Fallback
    };

    const initSwiper = () => {
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

    const displayPromotions = (promotions) => {
        if (!promotions || promotions.length === 0) {
            if (swiperContainer) swiperContainer.style.display = 'block';
            promoCarousel.innerHTML = '<p class="text-center" style="padding: 20px;">Momentan nu sunt promoții active.</p>';
            return;
        }

        promoCarousel.innerHTML = '';

        let promosToDisplay = [...promotions];
        if (promotions.length < 4 && promotions.length > 0) {
             while(promosToDisplay.length < 4) {
                 promosToDisplay = promosToDisplay.concat(promotions);
             }
        }

        promosToDisplay.forEach(promo => {
            const merchant = merchantDetails[promo.merchantId];
            if (!merchant) return;

            const targetText = formatTargets(promo);

            const card = document.createElement('div');
            card.className = 'swiper-slide';
            card.innerHTML = `
                <a href="https://app.green-go.ro/merchant/menu?id=${promo.merchantId}" class="promo-card" target="_blank">
                    <div class="discount">-${Math.round(promo.discountPercent)}%</div>
                    <div class="img-container">
                        <img src="${merchant.logo}" alt="${merchant.name}">
                    </div>
                    <div class="info">
                        <h4>${merchant.name}</h4>
                        <p class="promo-name">${promo.name}</p>
                        <p class="promo-schedule">${targetText}</p>
                    </div>
                </a>
            `;
            promoCarousel.appendChild(card);
        });

        if (swiperContainer) {
            swiperContainer.style.display = 'block';
            initSwiper();
        }
    };

    const fetchAndDisplayPromotions = async () => {
        try {
            const response = await fetch('https://app.green-go.ro/api/promotions/active');
            if (!response.ok) throw new Error('Network response was not ok');
            const promotions = await response.json();
            displayPromotions(promotions);
        } catch (error) {
            console.error('Could not fetch live promotions. Error:', error);
            if (swiperContainer) swiperContainer.style.display = 'block';
            promoCarousel.innerHTML = '<p class="text-center" style="padding: 20px;">Eroare la încărcarea promoțiilor.</p>';
        }
    };

    if (promoCarousel) {
        fetchAndDisplayPromotions();
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
