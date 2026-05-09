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

    // Restaurant Modal Logic
    const modal = document.getElementById('restaurant-modal');
    const modalIframe = modal.querySelector('iframe');
    const closeModal = document.querySelector('.close-modal');
    const restaurantLinks = document.querySelectorAll('.logo-item.active[data-url]');

    restaurantLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const url = link.getAttribute('data-url');
            modalIframe.setAttribute('src', url);
            modal.classList.add('active');
            body.classList.add('no-scroll');
        });
    });

    const closeModalAction = () => {
        modal.classList.remove('active');
        body.classList.remove('no-scroll');
        // Stop the iframe from loading content in the background
        modalIframe.setAttribute('src', '');
    };

    closeModal.addEventListener('click', closeModalAction);

    // Optional: Close modal if clicking on the background overlay
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModalAction();
        }
    });
});
