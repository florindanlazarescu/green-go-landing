(() => {
    const merchantList = document.getElementById('merchant-list');
    const merchantStatus = document.getElementById('merchant-status');
    const merchantCount = document.getElementById('merchant-count');
    if (!merchantList || !merchantStatus) return;

    const isLaunch = merchantList.dataset.layout === 'launch';
    const activeMerchantPriority = new Map([
        [1, 0], // Ograda Urbana
        [5, 1], // Sarea'N Bucate
        [7, 2], // Krepe Cafe
        [8, 3], // Wake Up Cafe
    ]);

    const createMerchantCard = (merchant) => {
        const card = document.createElement(isLaunch ? 'div' : 'a');
        card.className = isLaunch ? 'tile' : 'logo-item active';
        if (!isLaunch) {
            card.href = `https://app.green-go.ro/merchant/menu?id=${encodeURIComponent(merchant.id)}`;
            card.target = '_blank';
            card.rel = 'noopener noreferrer';
        }

        const imageContainer = isLaunch ? card : document.createElement('div');
        if (!isLaunch) imageContainer.className = 'merchant-img-container';
        const showImageUnavailable = () => {
            const fallback = document.createElement('span');
            if (isLaunch) fallback.className = 'image-unavailable';
            fallback.textContent = 'Imagine indisponibilă';
            return fallback;
        };
        if (merchant.image) {
            const image = document.createElement('img');
            image.alt = '';
            image.loading = 'lazy';
            image.addEventListener('error', () => {
                console.error(`Could not load image for merchant ${merchant.id}`);
                image.replaceWith(showImageUnavailable());
            }, { once: true });
            image.src = merchant.image;
            imageContainer.appendChild(image);
        } else {
            imageContainer.appendChild(showImageUnavailable());
        }

        const name = document.createElement('span');
        if (isLaunch) name.className = 'nm';
        name.textContent = merchant.name;
        if (!isLaunch) card.appendChild(imageContainer);
        card.appendChild(name);
        if (merchant.isTempClosed || isLaunch) {
            const badge = document.createElement('span');
            badge.className = isLaunch ? (merchant.isTempClosed ? 'st soon' : 'st') : 'soon-badge';
            badge.textContent = merchant.isTempClosed ? 'În curând' : 'La lansare';
            card.appendChild(badge);
        }
        return card;
    };

    const fetchAndDisplayMerchants = async () => {
        try {
            const response = await fetch('https://app.green-go.ro/api/merchant/name');
            if (!response.ok) throw new Error(`Merchants request failed: HTTP ${response.status}`);
            const data = await response.json();
            if (!data || !Array.isArray(data.merchants) || !data.merchants.every(merchant =>
                merchant !== null &&
                Number.isFinite(merchant.id) &&
                typeof merchant.name === 'string' &&
                typeof merchant.isTempClosed === 'boolean' &&
                (merchant.image == null || typeof merchant.image === 'string')
            )) {
                throw new Error('Invalid merchants response');
            }

            const activeMerchants = data.merchants.filter(merchant => !merchant.isTempClosed);
            const upcomingMerchants = data.merchants.filter(merchant => merchant.isTempClosed);
            const priorityOf = merchant => activeMerchantPriority.get(merchant.id) ?? activeMerchantPriority.size;
            activeMerchants.sort((left, right) => priorityOf(left) - priorityOf(right));

            const orderedMerchants = [...activeMerchants, ...upcomingMerchants];
            merchantList.replaceChildren(...orderedMerchants.map(createMerchantCard));
            if (merchantCount) {
                merchantCount.textContent = String(activeMerchants.length);
            }
            merchantStatus.hidden = data.merchants.length > 0;
            if (data.merchants.length === 0) {
                merchantStatus.textContent = 'Momentan nu sunt restaurante disponibile.';
            }
        } catch (error) {
            console.error('Could not load merchants:', error);
            merchantStatus.textContent = 'Nu am putut încărca restaurantele. Reîncarcă pagina pentru a încerca din nou.';
            if (merchantCount) merchantCount.textContent = '—';
        }
    };

    fetchAndDisplayMerchants();
})();
