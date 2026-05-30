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
    const promoCarousel = document.getElementById('promo-carousel');
    const swiperContainer = document.querySelector('.promo-swiper');
    const heroImage = document.querySelector('.hero-image');

    const merchantDetails = {
        1: { name: 'Ograda Urbana', logo: 'poze/optimized/ograda-320.jpg' },
        3: { name: 'Corner Stuff', logo: 'poze/corner_stuff.jpg' },
        5: { name: 'Sarea\'N Bucate', logo: 'poze/optimized/sareanbucate-320.jpg' },
        6: { name: 'GYRO Mediterranean Flavors', logo: 'poze/gyro.jpg' }
    };

    const formatTargets = (promo) => {
        if (promo.scope === 'ALL') {
            return 'Ofertă în tot meniul';
        }
        if (promo.targets && promo.targets.length > 0) {
            const formattedTargets = promo.targets.map(target =>
                target.charAt(0).toUpperCase() + target.slice(1).toLowerCase()
            ).join(', ');
            return `Ofertă la ${formattedTargets}`;
        }
        return promo.name; // Fallback
    };

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

    const appendText = (parent, tagName, className, text) => {
        const element = document.createElement(tagName);
        if (className) element.className = className;
        element.textContent = text;
        parent.appendChild(element);
        return element;
    };

    const displayPromotions = (promotions) => {
        if (!promotions || promotions.length === 0) {
            return;
        }

        promoCarousel.replaceChildren();
        
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

            const link = document.createElement('a');
            link.href = `https://app.green-go.ro/merchant/menu?id=${promo.merchantId}`;
            link.className = 'promo-card';
            link.target = '_blank';
            link.rel = 'noopener';

            appendText(link, 'div', 'discount', `-${Math.round(promo.discountPercent)}%`);

            const imageContainer = document.createElement('div');
            imageContainer.className = 'img-container';
            const image = document.createElement('img');
            image.src = merchant.logo;
            image.alt = merchant.name;
            image.loading = 'lazy';
            imageContainer.appendChild(image);
            link.appendChild(imageContainer);

            const info = document.createElement('div');
            info.className = 'info';
            appendText(info, 'h4', '', merchant.name);
            appendText(info, 'p', 'promo-name', promo.name || 'Promoție GreenGO');
            appendText(info, 'p', 'promo-schedule', targetText);
            link.appendChild(info);

            card.appendChild(link);
            promoCarousel.appendChild(card);
        });

        if (!promoCarousel.children.length) {
            return;
        }

        if (!window.Swiper) {
            return;
        }

        if (swiperContainer) {
            swiperContainer.hidden = false;
            if (heroImage) heroImage.classList.add('has-promotions');
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
        }
    };

    if (promoCarousel) {
        fetchAndDisplayPromotions();
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
