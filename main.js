document.addEventListener('DOMContentLoaded', () => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Animații la scroll (AOS găzduit local). Cu "reduce motion", conținutul apare direct.
    if (window.AOS) {
        AOS.init({ duration: 700, easing: 'ease-out-cubic', once: true, offset: 60, disable: prefersReducedMotion });
    } else {
        // Dacă biblioteca nu s-a încărcat, conținutul trebuie să rămână vizibil
        document.querySelectorAll('[data-aos]').forEach(node => node.removeAttribute('data-aos'));
    }

    // Butoanele "Comandă acum" / "Descarcă": pe iPhone duc la App Store, pe Android la Google Play,
    // pe desktop rămân pe secțiunea de descărcare.
    const iosLink = document.querySelector('.store-apple');
    const androidLink = document.querySelector('.store-google');
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(ua);
    const storeUrl = isIOS && iosLink ? iosLink.href : (isAndroid && androidLink ? androidLink.href : null);
    if (storeUrl) {
        document.querySelectorAll('[data-store-cta]').forEach(cta => {
            cta.href = storeUrl;
            cta.target = '_blank';
            cta.rel = 'noopener noreferrer';
        });
    }
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
    const promoCarousel = document.getElementById('promo-carousel');
    const promoStatus = document.getElementById('promo-status');

    const initSwiper = (promotionCount) => {
        if (!window.Swiper) return;

        new Swiper(swiperContainer, {
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
            loop: promotionCount > 2,
            rewind: promotionCount === 2,
            autoplay: promotionCount > 1 && !prefersReducedMotion ? {
                delay: 3000,
                disableOnInteraction: false,
            } : false,
            pagination: {
                el: '.swiper-pagination',
                clickable: true,
            },
            touchEventsTarget: 'container',
            simulateTouch: true,
        });
    };

    const createPromotionSlide = (promotion) => {
        const slide = document.createElement('div');
        slide.className = 'swiper-slide';

        const link = document.createElement('a');
        link.className = 'promo-card';
        link.href = `https://app.green-go.ro/merchant/menu?id=${encodeURIComponent(promotion.merchantId)}`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';

        const discount = document.createElement('div');
        discount.className = 'discount';
        discount.textContent = `-${promotion.discountPercent}%`;

        const info = document.createElement('div');
        info.className = 'info';
        const merchantName = document.createElement('h4');
        merchantName.textContent = promotion.merchantName;
        const targets = document.createElement('p');
        targets.className = 'promo-name';
        targets.textContent = promotion.targets.join(', ');
        info.append(merchantName, targets);
        link.append(discount, info);
        slide.appendChild(link);
        return slide;
    };

    const fetchAndDisplayPromotions = async () => {
        if (!swiperContainer || !promoCarousel || !promoStatus) return;
        const promoHeading = document.getElementById('promo-heading');

        try {
            const response = await fetch('https://app.green-go.ro/api/promotions/active');
            if (!response.ok) throw new Error(`Promotions request failed: HTTP ${response.status}`);
            const allPromotions = await response.json();
            if (!Array.isArray(allPromotions) || !allPromotions.every(promotion =>
                promotion !== null &&
                Number.isFinite(promotion.merchantId) &&
                typeof promotion.merchantName === 'string' &&
                Number.isFinite(promotion.discountPercent) &&
                Array.isArray(promotion.targets) &&
                promotion.targets.every(target => typeof target === 'string')
            )) {
                throw new Error('Invalid promotions response');
            }

            // Programul API: luni = 0 ... duminică = 6, ora României.
            const todayIdx = (new Date(
                new Date().toLocaleString('en-US', { timeZone: 'Europe/Bucharest' })
            ).getDay() + 6) % 7;
            const promotions = allPromotions.filter(promotion =>
                !Array.isArray(promotion.schedules) || promotion.schedules.length === 0 ||
                promotion.schedules.some(schedule => schedule.dayOfWeek === todayIdx)
            );

            promoCarousel.replaceChildren(...promotions.map(createPromotionSlide));
            if (promotions.length === 0) {
                if (promoHeading) promoHeading.hidden = true;
                promoStatus.textContent = 'Momentan nu sunt promoții active azi.';
                return;
            }

            swiperContainer.hidden = false;
            initSwiper(promotions.length);
            promoStatus.hidden = true;
        } catch (error) {
            console.error('Could not load active promotions:', error);
            swiperContainer.hidden = true;
            if (promoHeading) promoHeading.hidden = true;
            promoStatus.hidden = false;
            promoStatus.textContent = 'Nu am putut încărca promoțiile. Reîncarcă pagina pentru a încerca din nou.';
        }
    };

    fetchAndDisplayPromotions();

    const partnerForm = document.getElementById('partner-form');
    const partnerFormStatus = document.getElementById('partner-form-status');
    const formOpenedAt = Date.now();
    if (partnerForm) {
        partnerForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            if (!partnerForm.checkValidity()) {
                partnerForm.reportValidity();
                return;
            }

            // Anti-spam: câmpul ascuns completat sau trimitere sub 3 secunde = bot. Nu trimitem nimic.
            const honeypot = document.getElementById('biz-website');
            if ((honeypot && honeypot.value) || Date.now() - formOpenedAt < 3000) {
                partnerForm.reset();
                if (partnerFormStatus) {
                    partnerFormStatus.className = 'form-status success';
                    partnerFormStatus.textContent = 'Solicitarea a fost trimisă. Te contactăm în curând.';
                }
                return;
            }

            const submitButton = partnerForm.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Se trimite...';
            }

            if (partnerFormStatus) {
                partnerFormStatus.className = 'form-status';
                partnerFormStatus.textContent = 'Trimitem solicitarea...';
            }

            const fields = {
                interest: document.getElementById('biz-interest').value,
                name: document.getElementById('biz-name').value.trim(),
                email: document.getElementById('biz-email').value.trim(),
                phone: document.getElementById('biz-phone').value.trim(),
                city: document.getElementById('biz-city').value || 'Nespecificat',
                message: document.getElementById('biz-message').value.trim() || 'Nespecificat'
            };

            const emailParams = new URLSearchParams({
                subject: fields.interest,
                company: fields.name,
                email: fields.email,
                phone: fields.phone,
                city: fields.city,
                message: fields.message
            });

            try {
                await fetch(`https://app.green-go.ro/api/email?${emailParams.toString()}`, {
                    method: 'GET',
                    mode: 'no-cors',
                    keepalive: true
                });

                partnerForm.reset();
                if (partnerFormStatus) {
                    partnerFormStatus.className = 'form-status success';
                    partnerFormStatus.textContent = 'Solicitarea a fost trimisă. Te contactăm în curând.';
                }
            } catch (error) {
                console.error('Could not send contact request:', error);
                if (partnerFormStatus) {
                    partnerFormStatus.className = 'form-status error';
                    partnerFormStatus.textContent = 'Nu am putut trimite solicitarea. Te rugăm să încerci din nou.';
                }
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = 'Trimite solicitarea';
                }
            }
        });
    }

    // Bara "Descarcă aplicația" pe mobil
    const mobileCta = document.getElementById('mobile-cta');
    const downloadSection = document.getElementById('download');
    if (mobileCta) {
        let pastHero = false;
        let downloadVisible = false;
        const updateMobileCta = () => mobileCta.classList.toggle('visible', pastHero && !downloadVisible);
        window.addEventListener('scroll', () => { pastHero = window.scrollY > 500; updateMobileCta(); }, { passive: true });
        if (downloadSection && 'IntersectionObserver' in window) {
            new IntersectionObserver(entries => {
                downloadVisible = entries[0].isIntersecting;
                updateMobileCta();
            }, { threshold: 0.2 }).observe(downloadSection);
        }
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
