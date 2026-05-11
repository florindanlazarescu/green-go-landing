document.addEventListener('DOMContentLoaded', () => {
    // Mobile menu toggle
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    const body = document.body;

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('active');
            navLinks.classList.toggle('active');
            body.classList.toggle('no-scroll');
        });
    }

    // Close menu when a link is clicked
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            if (navLinks.classList.contains('active')) {
                menuToggle.classList.remove('active');
                navLinks.classList.remove('active');
                body.classList.remove('no-scroll');
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

    // A small local "database" to map merchantId to its details
    const merchantDetails = {
        1: { name: 'Ograda Urbana', logo: 'poze/ograda.png' },
        3: { name: 'Corner Stuff', logo: 'poze/corner_stuff.jpg' },
        5: { name: 'Sarea\'N Bucate', logo: 'poze/sareanbucate.png' },
        6: { name: 'GYRO Mediterranean Flavors', logo: 'poze/gyro.jpg' }
    };

    const formatSchedule = (schedules) => {
        if (!schedules || schedules.length === 0) return '';
        const dayMap = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm'];

        return schedules.map(s => {
            const day = dayMap[s.dayOfWeek];
            const start = s.startTime.substring(0, 5);
            const end = s.endTime.substring(0, 5);
            return `${day} ${start}-${end}`;
        }).join(', ');
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
                slideShadows: true,
            },
            loop: true,
            autoplay: {
                delay: 3000,
                disableOnInteraction: false,
            },
            pagination: {
                el: '.swiper-pagination',
                clickable: true,
            },
        });
    };

    const displayPromotions = (promotions) => {
        if (!promotions || promotions.length === 0) {
            if (swiperContainer) swiperContainer.style.display = 'block';
            promoCarousel.innerHTML = '<p class="text-center" style="padding: 20px;">Momentan nu sunt promoții active.</p>';
            return;
        }

        promoCarousel.innerHTML = '';

        promotions.forEach(promo => {
            const merchant = merchantDetails[promo.merchantId];
            if (!merchant) return;

            const scheduleText = formatSchedule(promo.schedules);

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
                        <p class="promo-schedule">${scheduleText}</p>
                    </div>
                </a>
            `;
            promoCarousel.appendChild(card);
        });

        // Make the carousel visible and initialize Swiper
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
});
