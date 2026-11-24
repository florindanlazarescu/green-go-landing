(() => {
    const merchantList = document.getElementById('merchant-list');
    const merchantStatus = document.getElementById('merchant-status');
    const merchantCount = document.getElementById('merchant-count');
    const merchantRetry = document.getElementById('merchant-retry');
    if (!merchantList || !merchantStatus) return;

    const isLaunch = merchantList.dataset.layout === 'launch';
    const REQUEST_TIMEOUT_MS = 10000;
    const activeMerchantPriority = new Map([
        [1, 0], // Ograda Urbana
        [5, 1], // Sarea'N Bucate
        [7, 2], // Krepe Cafe
        [8, 3], // WayCup Breakfast & Fast Bites
    ]);
    // CORECȚIE TEMPORARĂ: numele din baza de date a aplicației este greșit.
    // Se scoate după ce numele este corectat în administrarea aplicației GreenGO.
    const merchantNameOverrides = new Map([
        [8, 'WayCup Breakfast & Fast Bites'], // în aplicație apare ca „Wake Up Cafe”
    ]);
    // CORECȚIE TEMPORARĂ: logo-ul corect, până este încărcat în administrarea aplicației.
    const merchantImageOverrides = new Map([
        [8, '/poze/optimized/waycup-logo.jpg'],
    ]);

    const createMerchantCard = (merchant) => {
        // Pe pagina de lansare cardurile nu au link: aplicația nu se folosește înainte de lansare.
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
        const imageSrc = merchantImageOverrides.get(merchant.id) ?? merchant.image;
        if (imageSrc) {
            const image = document.createElement('img');
            image.alt = '';
            image.loading = 'lazy';
            if (isLaunch) { image.width = 320; image.height = 200; image.decoding = 'async'; }
            image.addEventListener('error', () => {
                console.error(`Could not load image for merchant ${merchant.id}`);
                image.replaceWith(showImageUnavailable());
            }, { once: true });
            image.src = imageSrc;
            imageContainer.appendChild(image);
        } else {
            imageContainer.appendChild(showImageUnavailable());
        }

        const name = document.createElement('span');
        if (isLaunch) name.className = 'nm';
        name.textContent = merchantNameOverrides.get(merchant.id) ?? merchant.name;
        if (!isLaunch) card.appendChild(imageContainer);
        card.appendChild(name);
        if (merchant.isTempClosed || isLaunch) {
            const badge = document.createElement('span');
            badge.className = isLaunch ? (merchant.isTempClosed ? 'st soon' : 'st') : 'soon-badge';
            badge.textContent = merchant.isTempClosed ? 'În curând' : 'Partener GreenGO';
            card.appendChild(badge);
        }
        return card;
    };

    const setBusy = (busy) => {
        if (merchantList.setAttribute) merchantList.setAttribute('aria-busy', busy ? 'true' : 'false');
    };

    const fetchWithTimeout = (url) => {
        if (typeof AbortController === 'undefined' || typeof setTimeout === 'undefined') return fetch(url);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
    };

    const fetchAndDisplayMerchants = async () => {
        setBusy(true);
        if (merchantRetry) merchantRetry.hidden = true;
        try {
            const response = await fetchWithTimeout('https://app.green-go.ro/api/merchant/name');
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
            if (isLaunch) merchantList.replaceChildren();
            merchantStatus.hidden = false;
            merchantStatus.textContent = isLaunch
                ? 'Nu am putut încărca restaurantele acum.'
                : 'Nu am putut încărca restaurantele. Reîncarcă pagina pentru a încerca din nou.';
            if (merchantRetry) merchantRetry.hidden = false;
            if (merchantCount) merchantCount.textContent = '—';
        } finally {
            setBusy(false);
        }
    };

    if (merchantRetry) {
        merchantRetry.addEventListener('click', () => {
            merchantStatus.hidden = true;
            fetchAndDisplayMerchants();
        });
    }
    fetchAndDisplayMerchants();
})();
