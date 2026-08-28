// NEXUS // SPA Frontend Application logic

// --- Global State ---
const state = {
    currentUser: null,
    cart: JSON.parse(localStorage.getItem('nexus_cart')) || [],
    favorites: JSON.parse(localStorage.getItem('nexus_favorites')) || [],
    products: [],
    paymentSettings: null
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Fetch current user session
    await checkAuth();
    
    // 2. Fetch payment settings
    await fetchPaymentSettings();
    
    // 3. Initialize UI event handlers
    initGlobalEvents();
    
    // 4. Run Router
    router();
    window.addEventListener('hashchange', router);
});

// --- State Helpers ---
function saveCart() {
    localStorage.setItem('nexus_cart', JSON.stringify(state.cart));
    updateCartBadge();
}

// --- Favorites ---
function saveFavorites() {
    localStorage.setItem('nexus_favorites', JSON.stringify(state.favorites));
}

function updateCartBadge() {
    const badge = document.getElementById('cart-badge-count');
    const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    if (badge) {
        badge.innerText = totalItems;
        badge.style.display = totalItems > 0 ? 'flex' : 'none';
    }
}

// --- Auth Utilities ---
async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        state.currentUser = data.user;
        updateHeaderUserArea();
    } catch (e) {
        console.error("Auth check failed", e);
        state.currentUser = null;
    }
}

async function fetchPaymentSettings() {
    try {
        const res = await fetch('/api/payment-settings');
        state.paymentSettings = await res.json();
    } catch (e) {
        console.error("Failed to load payment settings", e);
        state.paymentSettings = {
            qr_image_url: '/static/images/default_qr.png',
            payment_identifier: '9514823854@nyes',
            instructions: 'Scan QR and pay using UPI.'
        };
    }
}

function updateHeaderUserArea() {
    const area = document.getElementById('header-user-area');
    const mobAuthArea = document.getElementById('mobile-auth-area');
    if (!area) return;

    if (state.currentUser) {
        const isAdmin = state.currentUser.role === 'admin';
        const dashboardLink = isAdmin ? '#/admin' : '#/dashboard';
        const dashboardText = isAdmin ? 'Admin Console' : 'My Account';
        
        const html = `
            <div style="display: flex; align-items: center; gap: 16px;">
                <a href="${dashboardLink}" class="nav-item" style="font-weight: 600; color: var(--color-accent); font-size: 14px; text-transform: uppercase;">
                    <i data-lucide="layout-dashboard" style="width: 16px; height: 16px; display: inline; vertical-align: middle; margin-right: 4px;"></i> ${dashboardText}
                </a>
                <button onclick="handleLogout()" class="btn btn-secondary" style="padding: 8px 16px; font-size: 13px;">Log out</button>
            </div>
        `;
        area.innerHTML = html;
        if (mobAuthArea) {
            mobAuthArea.innerHTML = `
                <a href="${dashboardLink}" class="btn btn-primary" style="width: 100%; margin-bottom: 8px;">${dashboardText}</a>
                <button onclick="handleLogout()" class="btn btn-secondary" style="width: 100%;">Log out</button>
            `;
        }
    } else {
        area.innerHTML = `<a href="#/login" class="btn btn-secondary" id="nav-login-btn">Log in</a>`;
        if (mobAuthArea) {
            mobAuthArea.innerHTML = `<a href="#/login" class="btn btn-secondary" style="width: 100%;">Log in</a>`;
        }
    }
    lucide.createIcons();
}

async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    state.currentUser = null;
    updateHeaderUserArea();
    localStorage.removeItem('nexus_cart');
    state.cart = [];
    updateCartBadge();
    window.location.hash = '#/';
}

// --- Navigation & Global Events ---
function initGlobalEvents() {
    // Cart button click
    const cartBtn = document.getElementById('header-cart-btn');
    if (cartBtn) {
        cartBtn.addEventListener('click', () => {
            window.location.hash = '#/cart';
        });
    }

    // Mobile Hamburger
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const drawer = document.getElementById('mobile-nav-drawer');
    const icon = document.getElementById('hamburger-icon');
    
    if (menuToggle && drawer) {
        menuToggle.addEventListener('click', () => {
            drawer.classList.toggle('active');
            const isActive = drawer.classList.contains('active');
            icon.setAttribute('data-lucide', isActive ? 'x' : 'menu');
            lucide.createIcons();
        });
    }

    // Close mobile drawer on link click
    document.querySelectorAll('.mobile-nav-item, .mobile-auth-area a').forEach(link => {
        link.addEventListener('click', () => {
            if (drawer) {
                drawer.classList.remove('active');
                icon.setAttribute('data-lucide', 'menu');
                lucide.createIcons();
            }
        });
    });

    updateCartBadge();
}

function updateActiveNav(hash) {
    document.querySelectorAll('.nav-links a').forEach(link => {
        const path = link.getAttribute('href');
        if (hash === path || (path === '#/' && hash === '')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// --- Cart Handlers ---
window.addToCart = function(productId, name, game, image_url, price, quantity = 1) {
    const existing = state.cart.find(item => item.product_id === productId);
    if (existing) {
        existing.quantity += quantity;
    } else {
        state.cart.push({
            product_id: productId,
            name: name,
            game: game,
            image_url: image_url,
            price: price,
            quantity: quantity
        });
    }
    saveCart();
    
    // Tiny toast confirmation
    showToast(`Added ${name} to cart!`);
};

window.removeFromCart = function(productId) {
    state.cart = state.cart.filter(item => item.product_id !== productId);
    saveCart();
    router(); // Re-render current page (useful on cart view)
};

window.updateQty = function(productId, delta) {
    const item = state.cart.find(item => item.product_id === productId);
    if (item) {
        item.quantity += delta;
        if (item.quantity <= 0) {
            state.cart = state.cart.filter(item => item.product_id !== productId);
        }
        saveCart();
        router();
    }
};

window.toggleFavorite = function(productId, btnElement) {
    productId = parseInt(productId);
    const index = state.favorites.indexOf(productId);
    let active = false;
    if (index >= 0) {
        state.favorites.splice(index, 1);
    } else {
        state.favorites.push(productId);
        active = true;
    }
    saveFavorites();
    
    if (btnElement) {
        btnElement.classList.toggle('active', active);
        const icon = btnElement.querySelector('i');
        if (icon) {
            icon.setAttribute('data-lucide', active ? 'heart-handshake' : 'heart');
            icon.style.fill = active ? 'var(--color-pink)' : 'none';
        }
        lucide.createIcons();
    }
};

function showToast(message) {
    let toast = document.getElementById('nexus-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'nexus-toast';
        toast.style.position = 'fixed';
        toast.style.bottom = '30px';
        toast.style.right = '30px';
        toast.style.background = 'var(--grad-primary)';
        toast.style.color = 'white';
        toast.style.padding = '14px 24px';
        toast.style.borderRadius = '12px';
        toast.style.boxShadow = 'var(--glow-shadow)';
        toast.style.zIndex = '9999';
        toast.style.fontWeight = '700';
        toast.style.transition = 'opacity 0.3s ease';
        toast.style.opacity = '0';
        document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.style.opacity = '1';
    setTimeout(() => {
        toast.style.opacity = '0';
    }, 2500);
}


// --- Single Page Application Router ---
async function router() {
    const appEl = document.getElementById('app');
    const hash = window.location.hash || '#/';
    updateActiveNav(hash);

    // Scroll to top
    window.scrollTo(0, 0);

    // Match routing paths
    if (hash === '#/' || hash.startsWith('#/?')) {
        await renderMarketplace(appEl);
    } else if (hash === '#/collections') {
        renderCollections(appEl);
    } else if (hash === '#/how-it-works') {
        renderHowItWorks(appEl);
    } else if (hash === '#/login') {
        renderLogin(appEl);
    } else if (hash === '#/register') {
        renderRegister(appEl);
    } else if (hash.startsWith('#/product/')) {
        const id = hash.split('/')[2];
        await renderProductDetail(appEl, id);
    } else if (hash === '#/cart') {
        renderCart(appEl);
    } else if (hash === '#/checkout') {
        renderCheckout(appEl);
    } else if (hash.startsWith('#/payment/')) {
        const id = hash.split('/')[2];
        await renderPaymentPage(appEl, id);
    } else if (hash.startsWith('#/tracking/')) {
        const id = hash.split('/')[2];
        await renderTrackingPage(appEl, id);
    } else if (hash === '#/tracking') {
        await renderTrackingSearchPage(appEl);
    } else if (hash === '#/dashboard') {
        await renderDashboard(appEl);
    } else if (hash === '#/admin') {
        await renderAdminConsole(appEl);
    } else {
        appEl.innerHTML = `<div class="container" style="padding: 100px 0; text-align: center;"><h2>404 Page Not Found</h2><a href="#/" class="btn btn-primary" style="margin-top: 20px;">Return Home</a></div>`;
    }
    
    // Render Icons
    lucide.createIcons();
}


// ============================================
// VIEWS & COMPONENTS
// ============================================

// --- 1. Marketplace & Hero ---
async function renderMarketplace(container) {
    // Get query params if any (e.g. game filters from hash)
    const hash = window.location.hash;
    let selectedGame = 'All games';
    
    if (hash.includes('?')) {
        const params = new URLSearchParams(hash.split('?')[1]);
        selectedGame = params.get('game') || 'All games';
    }

    // Load products
    let apiPath = '/api/products';
    if (selectedGame && selectedGame !== 'All games') {
        apiPath += `?game=${encodeURIComponent(selectedGame)}`;
    }
    
    let products = [];
    try {
        const res = await fetch(apiPath);
        products = await res.json();
        state.products = products;
    } catch (e) {
        console.error("Failed to load products", e);
    }

    const featuredProduct = products.find(p => p.featured === 1) || products[0] || {
        id: 1, name: "Voidwalker Set", game: "Fortnite", price: 32.00, image_url: "/static/images/default_qr.png"
    };

    container.innerHTML = `
        <!-- Hero Section -->
        <section class="container hero">
            <div class="hero-left">
                <div>
                    <span class="badge badge-live" style="margin-bottom: 12px; display: inline-flex; align-items: center; gap: 6px;">
                        <i data-lucide="zap" style="width: 14px; height: 14px;"></i> The next drop is live
                    </span>
                </div>
                <h1 class="hero-title">
                    Your loadout.<br>
                    <span class="text-gradient">Your legacy.</span>
                </h1>
                <p class="hero-desc">
                    Discover rare digital collectibles, level up your inventory, and play with a little more attitude. Secured instantly, verified by players.
                </p>
                <div class="hero-buttons">
                    <a href="#curated-inventory" class="btn btn-primary btn-accent" onclick="document.getElementById('curated-inventory').scrollIntoView({behavior: 'smooth'}); return false;">
                        Explore marketplace <i data-lucide="arrow-right"></i>
                    </a>
                    <a href="#/how-it-works" class="btn btn-secondary">How it works</a>
                </div>
                <div class="hero-badges">
                    <div class="hero-badge-item">
                        <i data-lucide="shield-check"></i>
                        <span>Secure delivery</span>
                    </div>
                    <div class="hero-badge-item">
                        <i data-lucide="check-circle-2"></i>
                        <span>Verified items</span>
                    </div>
                </div>
            </div>
            <div class="hero-right">
                <div class="featured-card bg-glass">
                    <div class="featured-img-container">
                        <span class="featured-overlay-label">FEATURED DROP</span>
                        <img src="${featuredProduct.image_url}" alt="${featuredProduct.name}">
                    </div>
                    <div class="featured-info">
                        <div>
                            <h3 class="featured-title">${featuredProduct.name}</h3>
                            <p class="featured-subtitle">${featuredProduct.game}</p>
                        </div>
                        <div class="featured-price-badge">
                            $${featuredProduct.price.toFixed(2)}
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Marketplace Curated Section -->
        <section class="marketplace" id="curated-inventory">
            <div class="container">
                <div class="section-header">
                    <span class="section-label">CURATED INVENTORY</span>
                    <h2 class="section-title">Find your next flex</h2>
                </div>

                <!-- Filter / Search bar -->
                <div class="filters-bar bg-glass">
                    <div class="filter-tabs">
                        ${['All games', 'Valorant', 'CS2', 'Free Fire', 'PUBG', 'Fortnite'].map(game => {
                            const activeClass = game === selectedGame ? 'active' : '';
                            return `<button onclick="filterByGame('${game}')" class="filter-tab ${activeClass}">${game}</button>`;
                        }).join('')}
                    </div>
                    <div class="search-sort-group">
                        <div class="search-box">
                            <i data-lucide="search" style="width: 18px; height: 18px;"></i>
                            <input type="text" id="market-search" placeholder="Search weapons, bundles, skins..." onkeyup="handleSearch(event)">
                        </div>
                        <div class="sort-dropdown">
                            <select id="market-sort" onchange="handleSort()">
                                <option value="newest">Newest</option>
                                <option value="price_asc">Price: Low to High</option>
                                <option value="price_desc">Price: High to Low</option>
                                <option value="rating">Rating</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Grid -->
                <div class="products-grid" id="products-grid-render">
                    ${renderProductGridHtml(products)}
                </div>
            </div>
        </section>
    `;
}

function renderProductGridHtml(productsList) {
    if (productsList.length === 0) {
        return `
            <div style="grid-column: 1 / -1; text-align: center; padding: 60px 0; color: var(--text-muted);">
                <i data-lucide="package-open" style="width: 48px; height: 48px; margin-bottom: 16px; color: var(--color-primary);"></i>
                <p style="font-size: 16px; font-weight: 600;">No products found matches the selection.</p>
            </div>
        `;
    }
    return productsList.map(prod => {
        const isFav = state.favorites.includes(prod.id);
        const activeClass = isFav ? 'active' : '';
        const heartIcon = isFav ? 'heart-handshake' : 'heart';
        const heartFill = isFav ? 'fill="var(--color-pink)"' : '';
        
        let rarityClass = 'badge-rare';
        if (prod.rarity.toLowerCase() === 'legendary') rarityClass = 'badge-legendary';
        if (prod.rarity.toLowerCase() === 'epic') rarityClass = 'badge-epic';

        return `
            <div class="product-card bg-glass">
                <div class="product-card-img-wrapper">
                    <span class="badge ${rarityClass} product-card-badge">${prod.rarity}</span>
                    <button class="favorite-btn ${activeClass}" onclick="toggleFavorite(${prod.id}, this)">
                        <i data-lucide="${heartIcon}" style="${activeClass ? 'fill: var(--color-pink); color: var(--color-pink);' : ''} width: 18px; height: 18px;"></i>
                    </button>
                    <div class="rating-badge">
                        <i data-lucide="star" style="width: 12px; height: 12px; fill: #ffb700;"></i>
                        <span>${prod.rating.toFixed(1)}</span>
                    </div>
                    <img src="${prod.image_url}" alt="${prod.name}">
                </div>
                <div class="product-card-content">
                    <span class="product-card-game">${prod.game}</span>
                    <h3 class="product-card-name">${prod.name}</h3>
                    <div class="product-card-footer">
                        <span class="product-card-price">$${prod.price.toFixed(2)}</span>
                        <div class="product-card-actions">
                            <button onclick="addToCart(${prod.id}, '${prod.name.replace(/'/g, "\\'")}', '${prod.game}', '${prod.image_url}', ${prod.price})" class="btn-icon-sm btn-icon-sm-cart" title="Add to Cart">
                                <i data-lucide="shopping-cart" style="width: 16px; height: 16px;"></i>
                            </button>
                            <a href="#/product/${prod.id}" class="btn-icon-sm btn-icon-sm-details" title="View Details">
                                <i data-lucide="eye" style="width: 16px; height: 16px;"></i>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.filterByGame = function(game) {
    window.location.hash = game === 'All games' ? '#/' : `#/?game=${encodeURIComponent(game)}`;
};

window.handleSearch = async function(event) {
    const query = event.target.value;
    const sort = document.getElementById('market-sort').value;
    
    // Read game filter from hash
    const hash = window.location.hash;
    let selectedGame = 'All games';
    if (hash.includes('?')) {
        const params = new URLSearchParams(hash.split('?')[1]);
        selectedGame = params.get('game') || 'All games';
    }

    let url = `/api/products?search=${encodeURIComponent(query)}&sort=${sort}`;
    if (selectedGame !== 'All games') {
        url += `&game=${encodeURIComponent(selectedGame)}`;
    }

    try {
        const res = await fetch(url);
        const data = await res.json();
        const grid = document.getElementById('products-grid-render');
        if (grid) {
            grid.innerHTML = renderProductGridHtml(data);
            lucide.createIcons();
        }
    } catch (e) {
        console.error("Filter search failed", e);
    }
};

window.handleSort = async function() {
    const query = document.getElementById('market-search').value;
    const sort = document.getElementById('market-sort').value;
    
    const hash = window.location.hash;
    let selectedGame = 'All games';
    if (hash.includes('?')) {
        const params = new URLSearchParams(hash.split('?')[1]);
        selectedGame = params.get('game') || 'All games';
    }

    let url = `/api/products?search=${encodeURIComponent(query)}&sort=${sort}`;
    if (selectedGame !== 'All games') {
        url += `&game=${encodeURIComponent(selectedGame)}`;
    }

    try {
        const res = await fetch(url);
        const data = await res.json();
        const grid = document.getElementById('products-grid-render');
        if (grid) {
            grid.innerHTML = renderProductGridHtml(data);
            lucide.createIcons();
        }
    } catch (e) {
        console.error("Sort filter failed", e);
    }
};


// --- 2. Collections & How it Works (Simple sections) ---
function renderCollections(container) {
    container.innerHTML = `
        <div class="container" style="padding: 60px 0;">
            <div class="section-header" style="text-align: center; margin-bottom: 60px;">
                <span class="section-label">LIMITED COLLECTIONS</span>
                <h1 class="section-title" style="font-size: 48px;">Elevate Your Showroom</h1>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px;">
                <div class="product-card bg-glass" style="padding: 24px; text-align: center;">
                    <div style="width: 80px; height: 80px; background: rgba(192, 38, 255, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; border: 1px solid rgba(192,38,255,0.3);">
                        <i data-lucide="flame" style="width: 36px; height: 36px; color: var(--color-primary);"></i>
                    </div>
                    <h3 style="font-family: var(--font-heading); font-size: 22px; font-weight: 700; margin-bottom: 12px;">Hottest Drop</h3>
                    <p style="color: var(--text-muted); font-size: 14px; line-height: 1.5; margin-bottom: 20px;">The top trending weapons catalog curated directly from the esports finals. Make an impression instantly.</p>
                    <a href="#/?game=Valorant" class="btn btn-secondary" style="width: 100%;">View items</a>
                </div>
                <div class="product-card bg-glass" style="padding: 24px; text-align: center;">
                    <div style="width: 80px; height: 80px; background: rgba(94, 231, 255, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; border: 1px solid rgba(94,231,255,0.3);">
                        <i data-lucide="crown" style="width: 36px; height: 36px; color: var(--color-accent);"></i>
                    </div>
                    <h3 style="font-family: var(--font-heading); font-size: 22px; font-weight: 700; margin-bottom: 12px;">Legendary Tier</h3>
                    <p style="color: var(--text-muted); font-size: 14px; line-height: 1.5; margin-bottom: 20px;">Ultra-rare skins and bundles with premium particle effects, custom reloads, and iconic animations.</p>
                    <a href="#/" class="btn btn-secondary" style="width: 100%;">Explore rare drops</a>
                </div>
                <div class="product-card bg-glass" style="padding: 24px; text-align: center;">
                    <div style="width: 80px; height: 80px; background: rgba(255, 46, 147, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; border: 1px solid rgba(255,46,147,0.3);">
                        <i data-lucide="compass" style="width: 36px; height: 36px; color: var(--color-pink);"></i>
                    </div>
                    <h3 style="font-family: var(--font-heading); font-size: 22px; font-weight: 700; margin-bottom: 12px;">Seasonal Sets</h3>
                    <p style="color: var(--text-muted); font-size: 14px; line-height: 1.5; margin-bottom: 20px;">Limited winter, summer, and event editions. Once they are gone from the shelves, they never return.</p>
                    <a href="#/?game=Fortnite" class="btn btn-secondary" style="width: 100%;">View collections</a>
                </div>
            </div>
        </div>
    `;
}

function renderHowItWorks(container) {
    container.innerHTML = `
        <div class="container" style="padding: 60px 0; max-width: 800px;">
            <div class="section-header" style="text-align: center; margin-bottom: 60px;">
                <span class="section-label">HOW IT WORKS</span>
                <h1 class="section-title" style="font-size: 48px;">Zero Risk. Safe Delivery.</h1>
                <p style="color: var(--text-muted); margin-top: 16px; line-height: 1.6;">NEXUS operates as a fully secured escrow platform. We deliver verified items directly into your game account using non-secret public identifiers.</p>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 30px;">
                <div class="product-card bg-glass" style="display: flex; gap: 24px; padding: 24px; align-items: center;">
                    <div style="width: 60px; height: 60px; border-radius: 12px; background: rgba(192, 38, 255, 0.1); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 24px; color: var(--color-primary); flex-shrink: 0; font-family: var(--font-heading);">1</div>
                    <div>
                        <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 6px;">Select Your Loot</h3>
                        <p style="color: var(--text-muted); font-size: 14px;">Browse our curated inventory of verified skins and bundles from games like Valorant, CS2, and Fortnite. Add items to your cart.</p>
                    </div>
                </div>
                <div class="product-card bg-glass" style="display: flex; gap: 24px; padding: 24px; align-items: center;">
                    <div style="width: 60px; height: 60px; border-radius: 12px; background: rgba(94, 231, 255, 0.1); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 24px; color: var(--color-accent); flex-shrink: 0; font-family: var(--font-heading);">2</div>
                    <div>
                        <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 6px;">Provide Your Game Username / UID</h3>
                        <p style="color: var(--text-muted); font-size: 14px;">Enter only your in-game player ID, username, and server region during checkout. <strong style="color: #ffaa00;">NEXUS never asks for your passwords or authentication codes.</strong></p>
                    </div>
                </div>
                <div class="product-card bg-glass" style="display: flex; gap: 24px; padding: 24px; align-items: center;">
                    <div style="width: 60px; height: 60px; border-radius: 12px; background: rgba(255, 46, 147, 0.1); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 24px; color: var(--color-pink); flex-shrink: 0; font-family: var(--font-heading);">3</div>
                    <div>
                        <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 6px;">Secure QR Payment</h3>
                        <p style="color: var(--text-muted); font-size: 14px;">Scan the dynamically generated UPI payment QR code, send the exact INR amount, and click completion. Our admin team verifies payments securely.</p>
                    </div>
                </div>
                <div class="product-card bg-glass" style="display: flex; gap: 24px; padding: 24px; align-items: center;">
                    <div style="width: 60px; height: 60px; border-radius: 12px; background: rgba(0, 230, 115, 0.1); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 24px; color: #00e673; flex-shrink: 0; font-family: var(--font-heading);">4</div>
                    <div>
                        <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 6px;">Item Sent to Inventory</h3>
                        <p style="color: var(--text-muted); font-size: 14px;">Once verified, the items are added directly to your game inventory via secure server links. You can track this live step-by-step.</p>
                    </div>
                </div>
            </div>
            
            <div style="text-align: center; margin-top: 50px;">
                <a href="#/" class="btn btn-primary btn-accent" style="padding: 16px 32px;">Go to Marketplace</a>
            </div>
        </div>
    `;
}


// --- 3. Product Details Page ---
async function renderProductDetail(container, id) {
    let product = null;
    try {
        const res = await fetch(`/api/products/${id}`);
        if (!res.ok) throw new Error();
        product = await res.json();
    } catch (e) {
        container.innerHTML = `<div class="container" style="padding: 80px 0; text-align: center;"><h2>Product not found.</h2><a href="#/" class="btn btn-primary" style="margin-top:20px;">Back to Shop</a></div>`;
        return;
    }

    let rarityClass = 'badge-rare';
    if (product.rarity.toLowerCase() === 'legendary') rarityClass = 'badge-legendary';
    if (product.rarity.toLowerCase() === 'epic') rarityClass = 'badge-epic';

    // Fetch related products (same game)
    let relatedHtml = '';
    try {
        const relRes = await fetch(`/api/products?game=${encodeURIComponent(product.game)}`);
        const related = await relRes.json();
        const filtered = related.filter(p => p.id !== product.id).slice(0, 4);
        if (filtered.length > 0) {
            relatedHtml = `
                <section class="container related-section">
                    <h2 class="section-title" style="font-size: 28px; margin-bottom: 30px;">Related Items from ${product.game}</h2>
                    <div class="products-grid">
                        ${renderProductGridHtml(filtered)}
                    </div>
                </section>
            `;
        }
    } catch (e) {
        console.error("Failed to load related products", e);
    }

    container.innerHTML = `
        <div class="container">
            <div class="detail-layout">
                <!-- Left: Image -->
                <div class="detail-img-box bg-glass">
                    <img src="${product.image_url}" alt="${product.name}">
                </div>

                <!-- Right: Meta and Actions -->
                <div class="detail-info-box">
                    <div class="detail-meta">
                        <span class="badge ${rarityClass}">${product.rarity}</span>
                        <span style="color: var(--text-muted); font-size: 13px; font-weight: 700; text-transform: uppercase;">${product.game}</span>
                    </div>
                    
                    <h1 class="detail-name">${product.name}</h1>
                    
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <div class="detail-price">$${product.price.toFixed(2)}</div>
                        <div style="display: flex; align-items: center; gap: 6px; color: #ffb700; font-weight: 700; font-size: 16px;">
                            <i data-lucide="star" style="width: 18px; height: 18px; fill: #ffb700;"></i>
                            <span>${product.rating.toFixed(1)} / 5.0 Rating</span>
                        </div>
                    </div>
                    
                    <div class="detail-desc">
                        <h3 style="color: white; font-size: 15px; margin-bottom: 8px; font-weight: 600;">Description</h3>
                        <p>${product.description}</p>
                    </div>

                    <div class="detail-delivery-info">
                        <div class="delivery-card bg-glass">
                            <i data-lucide="zap" style="color: var(--color-accent); flex-shrink:0;"></i>
                            <div>
                                <h4 class="delivery-card-title">Instant Setup</h4>
                                <p class="delivery-card-desc">Orders are prepared immediately after transaction verification.</p>
                            </div>
                        </div>
                        <div class="delivery-card bg-glass">
                            <i data-lucide="shield-check" style="color: var(--color-primary); flex-shrink:0;"></i>
                            <div>
                                <h4 class="delivery-card-title">Safe Escrow</h4>
                                <p class="delivery-card-desc">Verified transactions. We never ask for sensitive credentials.</p>
                            </div>
                        </div>
                    </div>

                    <!-- Security Notice -->
                    <div class="security-notice" style="margin: 0;">
                        <i data-lucide="alert-triangle"></i>
                        <div class="security-notice-text">
                            <strong>Security Notice:</strong> NEXUS will never ask for your game account password, recovery code, or 2FA credentials. Keep your login secure.
                        </div>
                    </div>

                    <div class="detail-actions">
                        <button onclick="addToCart(${product.id}, '${product.name.replace(/'/g, "\\'")}', '${product.game}', '${product.image_url}', ${product.price})" class="btn btn-secondary">
                            <i data-lucide="shopping-cart"></i> Add to Cart
                        </button>
                        <button onclick="buyNow(${product.id}, '${product.name.replace(/'/g, "\\'")}', '${product.game}', '${product.image_url}', ${product.price})" class="btn btn-primary">
                            Buy Now <i data-lucide="arrow-right"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Related Grid -->
        ${relatedHtml}
    `;
}

window.buyNow = function(productId, name, game, image_url, price) {
    // Add item to cart and route directly to checkout
    addToCart(productId, name, game, image_url, price);
    window.location.hash = '#/checkout';
};


// --- 4. Shopping Cart Page ---
function renderCart(container) {
    if (state.cart.length === 0) {
        container.innerHTML = `
            <div class="container" style="padding: 100px 0; text-align: center;">
                <i data-lucide="shopping-bag" style="width: 64px; height: 64px; margin-bottom: 24px; color: var(--text-muted);"></i>
                <h1 style="font-family: var(--font-heading); font-size: 32px; font-weight: 800; margin-bottom: 12px;">Your Cart is Empty</h1>
                <p style="color: var(--text-muted); margin-bottom: 30px;">Add some premium loadout items to get started.</p>
                <a href="#/" class="btn btn-primary">Go Shopping</a>
            </div>
        `;
        return;
    }

    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    container.innerHTML = `
        <div class="container">
            <h1 style="font-family: var(--font-heading); font-size: 38px; font-weight: 800; margin-top: 40px; margin-bottom: 30px;">Shopping Cart</h1>
            
            <div class="cart-layout">
                <!-- Left: Items -->
                <div class="cart-items-container">
                    ${state.cart.map(item => `
                        <div class="cart-item bg-glass">
                            <div class="cart-item-img">
                                <img src="${item.image_url}" alt="${item.name}">
                            </div>
                            <div class="cart-item-info">
                                <h3 class="cart-item-name">${item.name}</h3>
                                <span class="cart-item-game">${item.game}</span>
                            </div>
                            <div class="cart-qty-ctrl">
                                <button onclick="updateQty(${item.product_id}, -1)" class="qty-btn"><i data-lucide="minus" style="width: 14px; height: 14px;"></i></button>
                                <span class="qty-val">${item.quantity}</span>
                                <button onclick="updateQty(${item.product_id}, 1)" class="qty-btn"><i data-lucide="plus" style="width: 14px; height: 14px;"></i></button>
                            </div>
                            <div class="cart-item-price">
                                $${(item.price * item.quantity).toFixed(2)}
                            </div>
                            <button onclick="removeFromCart(${item.product_id})" class="remove-cart-item">
                                <i data-lucide="trash-2" style="width: 18px; height: 18px;"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>

                <!-- Right: Summary -->
                <div class="order-summary-box bg-glass">
                    <h2 class="summary-title">Billing Summary</h2>
                    <div class="summary-row">
                        <span>Items Subtotal</span>
                        <span>$${subtotal.toFixed(2)}</span>
                    </div>
                    <div class="summary-row">
                        <span>Transaction Fee</span>
                        <span style="color: #00e673;">FREE</span>
                    </div>
                    <div class="summary-row total">
                        <span>Total Price (USD)</span>
                        <span style="color: var(--color-accent); font-size: 22px;">$${subtotal.toFixed(2)}</span>
                    </div>
                    
                    <a href="#/checkout" class="btn btn-primary checkout-btn">
                        Proceed to checkout <i data-lucide="arrow-right"></i>
                    </a>
                </div>
            </div>
        </div>
    `;
}


// --- 5. Checkout Page ---
function renderCheckout(container) {
    if (state.cart.length === 0) {
        window.location.hash = '#/cart';
        return;
    }

    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const usdToInrRate = 83.0; // Fixed conversion rate
    const inrTotal = Math.round(subtotal * usdToInrRate);
    
    // Auto-fill from state user if logged in
    const defaultName = state.currentUser ? state.currentUser.name : '';
    const defaultEmail = state.currentUser ? state.currentUser.email : '';

    container.innerHTML = `
        <div class="container" style="max-width: 1000px; padding: 40px 0;">
            <h1 style="font-family: var(--font-heading); font-size: 38px; font-weight: 800; text-align: center; margin-bottom: 40px;">Checkout Details</h1>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
                <!-- Left: Information Form -->
                <div>
                    <form id="checkout-form" onsubmit="handleCheckoutSubmit(event)" class="product-card bg-glass" style="padding: 30px; border-radius: 20px; display: flex; flex-direction: column; gap: 20px;">
                        <h2 style="font-family: var(--font-heading); font-size: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: 8px;">Customer Information</h2>
                        
                        <div class="form-group">
                            <label for="c-name">Full Name *</label>
                            <input type="text" id="c-name" value="${defaultName}" required placeholder="John Doe">
                        </div>
                        <div class="form-group">
                            <label for="c-email">Email Address *</label>
                            <input type="email" id="c-email" value="${defaultEmail}" required placeholder="john@example.com">
                        </div>
                        <div class="form-group">
                            <label for="c-phone">Phone Number (Optional)</label>
                            <input type="tel" id="c-phone" placeholder="+91 98765 43210">
                        </div>

                        <h2 style="font-family: var(--font-heading); font-size: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-top: 10px; margin-bottom: 8px;">Game Inventory Connection</h2>
                        
                        <div class="form-group">
                            <label for="g-game">Target Game *</label>
                            <select id="g-game" required onchange="handleGameSelectChange(this.value)">
                                <option value="Valorant">Valorant</option>
                                <option value="CS2">CS2</option>
                                <option value="Fortnite">Fortnite</option>
                                <option value="PUBG">PUBG</option>
                                <option value="Free Fire">Free Fire</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label id="lbl-player-uid" for="g-player-uid">Riot ID / Player ID *</label>
                            <input type="text" id="g-player-uid" required placeholder="PlayerName#TAG">
                        </div>
                        <div class="form-group">
                            <label for="g-player-name">In-game Username *</label>
                            <input type="text" id="g-player-name" required placeholder="MyNameInGame">
                        </div>
                        <div class="form-group">
                            <label for="g-region">Server / Region *</label>
                            <select id="g-region" required>
                                <option value="Asia Pacific">Asia Pacific / Mumbai</option>
                                <option value="North America">North America</option>
                                <option value="Europe">Europe</option>
                                <option value="Latin America">Latin America</option>
                                <option value="Korea/Japan">Korea / Japan</option>
                            </select>
                        </div>

                        <!-- Security Notice -->
                        <div class="security-notice" style="margin: 10px 0;">
                            <i data-lucide="shield-check" style="color: var(--color-accent);"></i>
                            <div class="security-notice-text" style="color: var(--color-accent);">
                                <strong>Safety Notice:</strong> NEXUS operates using official API delivery. We will never ask for your game password or 2FA recovery keys.
                            </div>
                        </div>

                        <button type="submit" class="btn btn-primary" style="padding: 16px; margin-top: 10px; font-size: 16px;">
                            Place Order & Pay <i data-lucide="credit-card"></i>
                        </button>
                    </form>
                </div>

                <!-- Right: Order Summary Preview -->
                <div class="order-summary-box bg-glass">
                    <h2 class="summary-title">Your Order Summary</h2>
                    <div style="max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; margin-bottom: 20px; padding-right: 8px;">
                        ${state.cart.map(item => `
                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px;">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <div style="width: 48px; height: 48px; border-radius: 6px; overflow: hidden; border: 1px solid var(--border-color);">
                                        <img src="${item.image_url}" alt="" style="width: 100%; height: 100%; object-fit: cover;">
                                    </div>
                                    <div>
                                        <h4 style="font-size: 14px; font-weight: 700;">${item.name}</h4>
                                        <span style="font-size: 11px; color: var(--text-muted);">Qty: ${item.quantity} &bull; ${item.game}</span>
                                    </div>
                                </div>
                                <span style="font-weight: 700; font-size: 14px;">$${(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                        `).join('')}
                    </div>

                    <div class="summary-row">
                        <span>Subtotal</span>
                        <span>$${subtotal.toFixed(2)}</span>
                    </div>
                    <div class="summary-row">
                        <span>Conversion Rate</span>
                        <span>1 USD = ₹${usdToInrRate} INR</span>
                    </div>
                    <div class="summary-row total" style="margin-top: 10px;">
                        <span>Total Price (USD)</span>
                        <span>$${subtotal.toFixed(2)}</span>
                    </div>
                    <div class="summary-row total" style="border-top: none; padding-top: 0; margin-top: -6px;">
                        <span style="color: var(--color-accent); font-weight: 800;">Amount in INR (₹)</span>
                        <span style="color: var(--color-accent); font-size: 24px; font-weight: 800;">₹${inrTotal.toLocaleString('en-IN')}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

window.handleGameSelectChange = function(game) {
    const label = document.getElementById('lbl-player-uid');
    const input = document.getElementById('g-player-uid');
    if (!label || !input) return;

    if (game === 'Valorant') {
        label.innerText = 'Riot ID / Player ID *';
        input.placeholder = 'PlayerName#TAG';
    } else if (game === 'CS2') {
        label.innerText = 'Steam ID / Friend Code *';
        input.placeholder = '76561198xxxxxxxxx';
    } else if (game === 'Fortnite') {
        label.innerText = 'Epic Games Display Name *';
        input.placeholder = 'EpicUserName';
    } else {
        label.innerText = 'Player UID / Game ID *';
        input.placeholder = 'UID Number / ID';
    }
};

window.handleCheckoutSubmit = async function(e) {
    e.preventDefault();
    
    const items = state.cart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity
    }));

    const customer_name = document.getElementById('c-name').value;
    const customer_email = document.getElementById('c-email').value;
    const customer_phone = document.getElementById('c-phone').value;
    const game = document.getElementById('g-game').value;
    const player_uid = document.getElementById('g-player-uid').value;
    const player_name = document.getElementById('g-player-name').value;
    const region = document.getElementById('g-region').value;

    const payload = {
        items,
        customer_name,
        customer_email,
        customer_phone,
        game,
        player_uid,
        player_name,
        region
    };

    try {
        const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            alert(data.error || "Order creation failed");
            return;
        }

        // Clear cart local storage
        state.cart = [];
        saveCart();

        // Redirect to QR payment page
        window.location.hash = `#/payment/${data.order_id}`;

    } catch (err) {
        console.error(err);
        alert("An error occurred during checkout processing.");
    }
};


// --- 6. QR Code Payment Page ---
async function renderPaymentPage(container, orderId) {
    let order = null;
    try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (!res.ok) throw new Error();
        order = await res.json();
    } catch (e) {
        container.innerHTML = `<div class="container" style="padding: 100px 0; text-align: center;"><h2>Order not found.</h2></div>`;
        return;
    }

    const usdToInrRate = 83.0;
    const inrTotal = Math.round(order.total * usdToInrRate);

    // Get current configured settings
    const settings = state.paymentSettings || {
        qr_image_url: '/static/images/default_qr.png',
        payment_identifier: '9514823854@nyes',
        instructions: 'Scan QR and pay using UPI.'
    };

    // Construct dynamic UPI payment URI automatically populated with the exact INR total
    const upiUri = `upi://pay?pa=${encodeURIComponent(settings.payment_identifier)}&pn=NEXUS&am=${inrTotal}&cu=INR`;
    
    // Generate dynamic QR Code image using api.qrserver.com
    const dynamicQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiUri)}`;

    container.innerHTML = `
        <div class="container" style="max-width: 500px; padding: 40px 0;">
            <!-- Demo Checkout Container -->
            <div style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6); color: #2b3951; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border: 1px solid rgba(255,255,255,0.05);">

                <!-- Demo Banner -->
                <div style="background: #fff3cd; color: #856404; padding: 10px 16px; text-align: center; font-size: 12px; font-weight: 700; letter-spacing: 0.03em;">
                    ⚠ DEMO MODE — College project only.
                </div>

                <!-- Header -->
                <div style="background: #0d1e3d; color: #ffffff; padding: 22px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <div>
                        <h3 style="font-size: 16px; font-weight: 800; color: #7f99be; text-transform: uppercase; letter-spacing: 0.05em; margin: 0; font-family: var(--font-heading);">NEXUS // (Demo)</h3>
                        <span style="font-size: 12px; color: #a5b8d1; font-family: monospace;">Order: ${order.id}</span>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 10px; color: #7f99be; display: block; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">Simulated Amount</span>
                        <span style="font-size: 22px; font-weight: 800; color: #52e3c2;">₹${inrTotal.toLocaleString('en-IN')}</span>
                    </div>
                </div>

                <!-- Body -->
                <div style="padding: 24px; display: flex; flex-direction: column; align-items: center; gap: 20px; background: #fafbfe;">

                    <!-- Payment Method Indicator -->
                    <div style="display: flex; width: 100%; align-items: center; gap: 10px; background: rgba(51, 149, 255, 0.05); border: 1px solid rgba(51, 149, 255, 0.15); padding: 12px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; color: #1a66ff;">
                        <i data-lucide="qr-code" style="width: 18px; height: 18px;"></i>
                        <span>Scan UPI QR below to pay</span>
                    </div>

                    <!-- Dynamic QR code showing the exact amount -->
                    <div style="background: #ffffff; padding: 16px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid #e1e6ef; width: 220px; aspect-ratio: 1; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                        <img src="${dynamicQrUrl}" alt="UPI QR Code" style="width: 100%; height: 100%; object-fit: contain;">
                    </div>

                    <!-- UPI Info instructions -->
                    <div style="text-align: center; font-size: 13px; color: #4e5d78; display: flex; flex-direction: column; gap: 4px;">
                        <span style="font-weight: 700;">UPI ID: ${settings.payment_identifier}</span>
                        <span style="font-size: 12px; color: #7f8e9d;">${settings.instructions}</span>
                    </div>

                    <div style="border-bottom: 1px solid #e1e6ef; width: 100%; margin: 4px 0;"></div>

                    <!-- Order info summary -->
                    <div style="width: 100%; font-size: 13px; color: #4e5d78; display: flex; flex-direction: column; gap: 8px;">
                        <div style="display: flex; justify-content: space-between;">
                            <span>Game</span>
                            <strong style="color: #0d1e3d;">${order.game}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Order ID</span>
                            <strong style="color: #0d1e3d;">${order.id}</strong>
                        </div>
                    </div>

                    <!-- Action Button -->
                    <button onclick="handleCompletedPayment('${order.id}')" style="width: 100%; padding: 14px; border: none; background: #3395ff; color: #ffffff; border-radius: 8px; font-size: 15px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(51, 149, 255, 0.3);">
                        Simulate payment completion <i data-lucide="check-circle-2" style="width: 16px; height: 16px;"></i>
                    </button>
                </div>
            </div>
        </div>
    `;

    lucide.createIcons();
}

window.handleCompletedPayment = async function(orderId) {
    try {
        const res = await fetch(`/api/orders/${orderId}/submit-payment`, { method: 'POST' });
        const data = await res.json();
        
        if (!res.ok) {
            alert(data.error || "Failed to submit verification request");
            return;
        }

        // Show verification success and redirect to tracking
        showToast("Payment submitted! Pending review.");
        window.location.hash = `#/tracking/${orderId}`;
    } catch (e) {
        console.error(e);
        alert("An error occurred during submission.");
    }
};


// --- 7. Order Status Tracking & Timeline ---
async function renderTrackingSearchPage(container) {
    container.innerHTML = `
        <div class="container" style="max-width: 500px; padding: 100px 0;">
            <div class="product-card bg-glass" style="padding: 40px; border-radius: 20px; display: flex; flex-direction: column; gap: 24px;">
                <h1 style="font-family: var(--font-heading); font-size: 28px; text-align: center; font-weight: 800;">Track Your Order</h1>
                <p style="color: var(--text-muted); text-align: center; font-size: 14px; margin-top: -10px;">Enter your unique Order Reference ID below to check live delivery timeline status.</p>
                
                <div class="form-group">
                    <label for="track-id">NEXUS Order ID</label>
                    <input type="text" id="track-id" placeholder="NEXUS-XXXXXX" style="text-align: center; font-family: monospace; font-size: 18px; text-transform: uppercase;">
                </div>
                
                <button onclick="triggerOrderSearch()" class="btn btn-primary" style="width:100%; padding: 14px;">
                    Track Status <i data-lucide="navigation"></i>
                </button>
            </div>
        </div>
    `;
}

window.triggerOrderSearch = function() {
    const id = document.getElementById('track-id').value.trim().toUpperCase();
    if (!id) {
        alert("Please enter a valid Order ID");
        return;
    }
    window.location.hash = `#/tracking/${id}`;
};

async function renderTrackingPage(container, orderId) {
    let order = null;
    try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (!res.ok) throw new Error();
        order = await res.json();
    } catch (e) {
        container.innerHTML = `
            <div class="container" style="max-width: 500px; padding: 80px 0; text-align: center;">
                <i data-lucide="search-code" style="width: 48px; height: 48px; color: #ff4d4d; margin-bottom: 16px;"></i>
                <h2 style="font-family: var(--font-heading);">Order ID Not Found</h2>
                <p style="color: var(--text-muted); margin: 12px 0 24px 0;">Please check your reference code and try again.</p>
                <a href="#/tracking" class="btn btn-secondary">Search again</a>
            </div>
        `;
        return;
    }

    // Determine Timeline Steps (1 to 5)
    // Timeline steps: 1. Order Created, 2. Payment Submitted, 3. Payment Verified, 4. Processing, 5. Completed
    let currentStep = 1;
    
    // Check payment status or order status
    const oStatus = order.order_status;
    const pStatus = order.payment_status;

    if (oStatus === 'Order Created' || oStatus === 'Pending Payment') {
        currentStep = 1;
    } else if (oStatus === 'Payment Submitted' || pStatus === 'Payment Submitted') {
        currentStep = 2;
    } else if (pStatus === 'Payment Verified' && oStatus === 'Payment Verified') {
        currentStep = 3;
    } else if (oStatus === 'Processing') {
        currentStep = 4;
    } else if (oStatus === 'Completed') {
        currentStep = 5;
    }

    let progressWidth = '0%';
    if (currentStep === 1) progressWidth = '0%';
    if (currentStep === 2) progressWidth = '25%';
    if (currentStep === 3) progressWidth = '50%';
    if (currentStep === 4) progressWidth = '75%';
    if (currentStep === 5) progressWidth = '100%';

    // Custom text representation of status
    let statusText = "Pending Payment";
    let statusDesc = "Please scan the QR code and submit payment to initialize fulfillment.";
    let statusIcon = "clock";
    let statusClass = "pending";

    if (currentStep === 2) {
        statusText = "Payment verification pending";
        statusDesc = "Your payment submission is pending verification from the NEXUS administrative desk.";
        statusIcon = "search";
        statusClass = "submitted";
    } else if (currentStep === 3) {
        statusText = "Payment Verified";
        statusDesc = "Your payment of has been successfully verified! Order processing queue is pending.";
        statusIcon = "check-check";
        statusClass = "verified";
    } else if (currentStep === 4) {
        statusText = "Fulfillment in progress";
        statusDesc = "Items are currently being securely pushed into your inventory. Please do not close this timeline.";
        statusIcon = "refresh-cw";
        statusClass = "processing";
    } else if (currentStep === 5) {
        statusText = "Completed";
        statusDesc = "Order completed! The skins are active in your game inventory. Go check it out!";
        statusIcon = "party-popper";
        statusClass = "completed";
    } else if (oStatus === 'Cancelled') {
        statusText = "Cancelled";
        statusDesc = "This order was cancelled by the administrator or customer.";
        statusIcon = "x-circle";
        statusClass = "cancelled";
        progressWidth = '0%';
        currentStep = 0;
    }

    container.innerHTML = `
        <div class="container" style="max-width: 800px; padding: 40px 0;">
            <div class="tracking-card bg-glass">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--border-color); padding-bottom: 20px; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
                    <div>
                        <span style="font-size: 11px; font-weight: 800; color: var(--color-primary); letter-spacing: 0.1em;">LIVE ORDER TRACKING</span>
                        <h1 style="font-family: var(--font-heading); font-size: 24px; font-weight: 800; margin-top: 4px;">ID: ${order.id}</h1>
                    </div>
                    <div style="text-align: right;">
                        <span class="status-indicator ${statusClass}">
                            <i data-lucide="${statusIcon}" style="width: 14px; height: 14px;"></i> ${statusText}
                        </span>
                        <p style="color: var(--text-muted); font-size: 12px; margin-top: 6px;">Created at: ${new Date(order.created_at).toLocaleString()}</p>
                    </div>
                </div>

                <!-- Custom timeline component -->
                <div class="timeline" id="tracking-timeline">
                    <div class="timeline-progress" style="width: ${progressWidth};"></div>
                    
                    <div class="timeline-step ${currentStep >= 1 ? 'completed' : ''} ${currentStep === 1 ? 'active' : ''}">
                        <div class="step-node">${currentStep > 1 ? '<i data-lucide="check" style="width:16px; height:16px;"></i>' : '1'}</div>
                        <span class="step-label">Created</span>
                    </div>
                    <div class="timeline-step ${currentStep >= 2 ? 'completed' : ''} ${currentStep === 2 ? 'active' : ''}">
                        <div class="step-node">${currentStep > 2 ? '<i data-lucide="check" style="width:16px; height:16px;"></i>' : '2'}</div>
                        <span class="step-label">Submitted</span>
                    </div>
                    <div class="timeline-step ${currentStep >= 3 ? 'completed' : ''} ${currentStep === 3 ? 'active' : ''}">
                        <div class="step-node">${currentStep > 3 ? '<i data-lucide="check" style="width:16px; height:16px;"></i>' : '3'}</div>
                        <span class="step-label">Verified</span>
                    </div>
                    <div class="timeline-step ${currentStep >= 4 ? 'completed' : ''} ${currentStep === 4 ? 'active' : ''}">
                        <div class="step-node">${currentStep > 4 ? '<i data-lucide="check" style="width:16px; height:16px;"></i>' : '4'}</div>
                        <span class="step-label">Processing</span>
                    </div>
                    <div class="timeline-step ${currentStep >= 5 ? 'completed' : ''} ${currentStep === 5 ? 'active' : ''}">
                        <div class="step-node">${currentStep > 5 ? '<i data-lucide="check" style="width:16px; height:16px;"></i>' : '5'}</div>
                        <span class="step-label">Completed</span>
                    </div>
                </div>

                <!-- Details panel -->
                <div style="background: rgba(0,0,0,0.15); border-radius: 16px; padding: 24px; border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 16px; margin-top: 40px;">
                    <div>
                        <h4 style="font-weight: 700; font-size: 15px; color: white; margin-bottom: 6px;">Fulfillment Status Update</h4>
                        <p style="color: var(--text-muted); font-size: 14px; line-height: 1.5;">${statusDesc}</p>
                    </div>

                    <div style="border-top: 1px solid var(--border-color); padding-top: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <div>
                            <span style="font-size:11px; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Account Details</span>
                            <p style="font-size:14px; margin-top:4px;">
                                <strong>Game:</strong> ${order.game}<br>
                                <strong>Riot ID:</strong> ${order.player_uid}<br>
                                <strong>Region:</strong> ${order.region}
                            </p>
                        </div>
                        <div>
                            <span style="font-size:11px; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Billing Details</span>
                            <p style="font-size:14px; margin-top:4px;">
                                <strong>Total:</strong> $${order.total.toFixed(2)} USD (₹${(order.total * 83).toLocaleString('en-IN')} INR)<br>
                                <strong>Buyer:</strong> ${order.customer_name}
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Order items display -->
                <div style="margin-top: 30px;">
                    <h3 style="font-family: var(--font-heading); font-size: 18px; font-weight: 700; margin-bottom: 14px;">Items Purchased</h3>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        ${order.items.map(item => `
                            <div class="bg-glass" style="display:flex; justify-content:space-between; align-items:center; padding:16px; border-radius:12px;">
                                <div style="display:flex; align-items:center; gap:16px;">
                                    <div style="width:50px; height:50px; border-radius:8px; overflow:hidden;">
                                        <img src="${item.image_url}" alt="" style="width:100%; height:100%; object-fit:cover;">
                                    </div>
                                    <div>
                                        <h4 style="font-weight:700; font-size:14px;">${item.product_name}</h4>
                                        <span style="font-size:12px; color:var(--text-muted);">${item.product_game} &bull; Qty: ${item.quantity}</span>
                                    </div>
                                </div>
                                <span style="font-weight:700; font-size:14px;">$${(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Redirect if pending -->
                ${(order.order_status === 'Pending Payment' || order.order_status === 'Order Created') ? `
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="#/payment/${order.id}" class="btn btn-primary">Complete QR Payment</a>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}


// --- 8. User Auth Forms ---
function renderLogin(container) {
    container.innerHTML = `
        <div class="container">
            <div class="form-box bg-glass">
                <h1 class="form-title">Welcome Back</h1>
                <p class="form-subtitle">Log in to track orders, manage favorites, and see inventories.</p>
                
                <form id="login-form" onsubmit="handleLoginSubmit(event)" style="display: flex; flex-direction: column; gap: 20px;">
                    <div class="form-group">
                        <label for="l-email">Email Address</label>
                        <input type="email" id="l-email" required placeholder="name@domain.com">
                    </div>
                    <div class="form-group">
                        <label for="l-password">Password</label>
                        <input type="password" id="l-password" required placeholder="••••••••">
                    </div>
                    
                    <button type="submit" class="btn btn-primary" style="padding:14px; font-size:15px; margin-top:10px;">
                        Log In <i data-lucide="log-in"></i>
                    </button>
                </form>
                
                <div style="text-align: center; margin-top: 24px; font-size: 14px; color: var(--text-muted);">
                    Don't have a NEXUS account? <a href="#/register" style="color: var(--color-accent); font-weight: 600;">Sign up free</a>
                </div>
            </div>
        </div>
    `;
}

window.handleLoginSubmit = async function(e) {
    e.preventDefault();
    const email = document.getElementById('l-email').value;
    const password = document.getElementById('l-password').value;

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        
        if (!res.ok) {
            alert(data.error || "Login failed");
            return;
        }

        state.currentUser = data.user;
        updateHeaderUserArea();
        showToast("Logged in successfully!");

        // Redirect to dashboard, or admin console if admin
        if (data.user.role === 'admin') {
            window.location.hash = '#/admin';
        } else {
            window.location.hash = '#/dashboard';
        }
    } catch (err) {
        console.error(err);
        alert("An error occurred during login.");
    }
};

function renderRegister(container) {
    container.innerHTML = `
        <div class="container">
            <div class="form-box bg-glass">
                <h1 class="form-title">Create NEXUS Account</h1>
                <p class="form-subtitle">Register to unlock dashboards and persist shopping carts.</p>
                
                <form id="register-form" onsubmit="handleRegisterSubmit(event)" style="display: flex; flex-direction: column; gap: 20px;">
                    <div class="form-group">
                        <label for="r-name">Full Name</label>
                        <input type="text" id="r-name" required placeholder="Alex Mercer">
                    </div>
                    <div class="form-group">
                        <label for="r-email">Email Address</label>
                        <input type="email" id="r-email" required placeholder="alex@domain.com">
                    </div>
                    <div class="form-group">
                        <label for="r-password">Password (Min 6 chars)</label>
                        <input type="password" id="r-password" required placeholder="••••••••">
                    </div>
                    
                    <button type="submit" class="btn btn-primary" style="padding:14px; font-size:15px; margin-top:10px;">
                        Sign Up <i data-lucide="user-plus"></i>
                    </button>
                </form>
                
                <div style="text-align: center; margin-top: 24px; font-size: 14px; color: var(--text-muted);">
                    Already have a NEXUS account? <a href="#/login" style="color: var(--color-accent); font-weight: 600;">Log in</a>
                </div>
            </div>
        </div>
    `;
}

window.handleRegisterSubmit = async function(e) {
    e.preventDefault();
    const name = document.getElementById('r-name').value;
    const email = document.getElementById('r-email').value;
    const password = document.getElementById('r-password').value;

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        
        if (!res.ok) {
            alert(data.error || "Registration failed");
            return;
        }

        state.currentUser = data.user;
        updateHeaderUserArea();
        showToast("Registration successful!");
        window.location.hash = '#/dashboard';
    } catch (err) {
        console.error(err);
        alert("An error occurred during registration.");
    }
};


// --- 9. Customer Dashboard ---
async function renderDashboard(container) {
    if (!state.currentUser) {
        window.location.hash = '#/login';
        return;
    }

    // Load orders for customer
    let orders = [];
    try {
        const res = await fetch('/api/dashboard/orders');
        orders = await res.json();
    } catch (e) {
        console.error(e);
    }

    // Load favorite products
    let favoritesList = [];
    if (state.favorites.length > 0) {
        try {
            const res = await fetch('/api/products');
            const allProducts = await res.json();
            favoritesList = allProducts.filter(p => state.favorites.includes(p.id));
        } catch (e) {
            console.error(e);
        }
    }

    container.innerHTML = `
        <div class="container" style="padding: 40px 0;">
            <div class="section-header" style="margin-bottom: 30px;">
                <span class="section-label">CUSTOMER LOUNGE</span>
                <h1 class="section-title">Hello, ${state.currentUser.name}</h1>
                <p style="color: var(--text-muted); font-size: 14px; margin-top: 4px;">Manage your recent gaming account logs, purchases, and track items.</p>
            </div>

            <div class="dashboard-layout">
                <!-- Sidebar tabs -->
                <div class="sidebar-menu bg-glass">
                    <button onclick="switchDashboardTab('dash-orders')" class="sidebar-btn active" id="btn-dash-orders">
                        <i data-lucide="shopping-bag"></i> Recent Orders
                    </button>
                    <button onclick="switchDashboardTab('dash-favorites')" class="sidebar-btn" id="btn-dash-favorites">
                        <i data-lucide="heart"></i> My Favorites
                    </button>
                    <button onclick="switchDashboardTab('dash-settings')" class="sidebar-btn" id="btn-dash-settings">
                        <i data-lucide="settings"></i> Account Settings
                    </button>
                </div>

                <!-- Main area -->
                <div class="dashboard-content-box">
                    <!-- Orders Tab -->
                    <div id="tab-dash-orders" class="dash-tab-content">
                        <h2 style="font-family: var(--font-heading); font-size: 22px; margin-bottom: 20px;">Recent Purchases</h2>
                        
                        ${orders.length === 0 ? `
                            <div class="bg-glass" style="border-radius:16px; padding:40px; text-align:center; color:var(--text-muted);">
                                <i data-lucide="receipt" style="width:48px; height:48px; color:var(--color-primary); margin-bottom:14px;"></i>
                                <p style="font-weight:600;">You haven't placed any orders yet.</p>
                                <a href="#/" class="btn btn-secondary" style="margin-top:16px;">View Marketplace</a>
                            </div>
                        ` : `
                            <div class="table-wrapper">
                                <table class="nexus-table">
                                    <thead>
                                        <tr>
                                            <th>Order ID</th>
                                            <th>Game ID / Player ID</th>
                                            <th>Total (USD)</th>
                                            <th>Payment</th>
                                            <th>Delivery Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${orders.map(order => {
                                            let payClass = 'pending';
                                            if (order.payment_status === 'Payment Submitted') payClass = 'submitted';
                                            if (order.payment_status === 'Payment Verified') payClass = 'verified';
                                            
                                            let orderClass = 'pending';
                                            if (order.order_status === 'Processing') orderClass = 'processing';
                                            if (order.order_status === 'Completed') orderClass = 'completed';
                                            if (order.order_status === 'Cancelled') orderClass = 'cancelled';
                                            if (order.order_status === 'Payment Submitted') orderClass = 'submitted';

                                            return `
                                                <tr>
                                                    <td style="font-family: monospace; font-weight:700; color:var(--color-accent);">${order.id}</td>
                                                    <td>${order.player_uid} (${order.game})</td>
                                                    <td style="font-weight:700;">$${order.total.toFixed(2)}</td>
                                                    <td><span class="status-indicator ${payClass}">${order.payment_status}</span></td>
                                                    <td><span class="status-indicator ${orderClass}">${order.order_status}</span></td>
                                                    <td>
                                                        <a href="#/tracking/${order.id}" class="btn btn-secondary" style="padding:6px 12px; font-size:12px;">Track <i data-lucide="arrow-right" style="width:12px; height:12px;"></i></a>
                                                    </td>
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        `}
                    </div>

                    <!-- Favorites Tab -->
                    <div id="tab-dash-favorites" class="dash-tab-content" style="display: none;">
                        <h2 style="font-family: var(--font-heading); font-size: 22px; margin-bottom: 20px;">My Favorites</h2>
                        
                        ${favoritesList.length === 0 ? `
                            <div class="bg-glass" style="border-radius:16px; padding:40px; text-align:center; color:var(--text-muted);">
                                <i data-lucide="heart-off" style="width:48px; height:48px; color:var(--color-pink); margin-bottom:14px;"></i>
                                <p style="font-weight:600;">No items favorited yet.</p>
                                <a href="#/" class="btn btn-secondary" style="margin-top:16px;">View Marketplace</a>
                            </div>
                        ` : `
                            <div class="products-grid">
                                ${renderProductGridHtml(favoritesList)}
                            </div>
                        `}
                    </div>

                    <!-- Settings Tab -->
                    <div id="tab-dash-settings" class="dash-tab-content" style="display: none;">
                        <h2 style="font-family: var(--font-heading); font-size: 22px; margin-bottom: 20px;">Account Settings</h2>
                        
                        <div class="product-card bg-glass" style="padding: 30px; max-width: 500px;">
                            <div class="form-group">
                                <label>Registered Name</label>
                                <input type="text" value="${state.currentUser.name}" disabled style="opacity: 0.7; background: rgba(0,0,0,0.3);">
                            </div>
                            <div class="form-group">
                                <label>Email Address</label>
                                <input type="email" value="${state.currentUser.email}" disabled style="opacity: 0.7; background: rgba(0,0,0,0.3);">
                            </div>
                            <div class="form-group">
                                <label>Profile Role</label>
                                <input type="text" value="${state.currentUser.role.toUpperCase()}" disabled style="opacity: 0.7; background: rgba(0,0,0,0.3); color: var(--color-accent); font-weight:700;">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

window.switchDashboardTab = function(tabId) {
    document.querySelectorAll('.dash-tab-content').forEach(content => {
        content.style.display = 'none';
    });
    document.querySelectorAll('.sidebar-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const activeTab = document.getElementById(`tab-${tabId}`);
    if (activeTab) activeTab.style.display = 'block';

    const activeBtn = document.getElementById(`btn-${tabId}`);
    if (activeBtn) activeBtn.classList.add('active');
};


// --- 10. Admin Control Console ---
async function renderAdminConsole(container) {
    if (!state.currentUser || state.currentUser.role !== 'admin') {
        container.innerHTML = `<div class="container" style="padding:100px 0; text-align:center;"><h2>Access Denied.</h2><p style="color:var(--text-muted); margin-top:10px;">Administrators only.</p></div>`;
        return;
    }

    // Load admin metrics (orders, all products)
    let orders = [];
    let products = [];
    try {
        const resO = await fetch('/api/admin/orders');
        orders = await resO.json();
        
        const resP = await fetch('/api/admin/products-all');
        products = await resP.json();
    } catch (e) {
        console.error(e);
    }

    container.innerHTML = `
        <div class="container" style="padding: 40px 0;">
            <div class="section-header" style="margin-bottom: 30px;">
                <span class="section-label" style="color: var(--color-accent);">ADMIN CONSOLE</span>
                <h1 class="section-title">Nexus Control Operations</h1>
                <p style="color: var(--text-muted); font-size: 14px; margin-top: 4px;">Update orders, verify QR payments, edit products and customize the default UPI QR code settings.</p>
            </div>

            <div class="dashboard-layout">
                <!-- Sidebar tabs -->
                <div class="sidebar-menu bg-glass">
                    <button onclick="switchAdminTab('admin-orders')" class="sidebar-btn active" id="btn-admin-orders">
                        <i data-lucide="receipt"></i> Manage Orders
                    </button>
                    <button onclick="switchAdminTab('admin-products')" class="sidebar-btn" id="btn-admin-products">
                        <i data-lucide="package"></i> Manage Products
                    </button>
                    <button onclick="switchAdminTab('admin-payment')" class="sidebar-btn" id="btn-admin-payment">
                        <i data-lucide="qr-code"></i> QR Settings
                    </button>
                </div>

                <!-- Main Area -->
                <div class="dashboard-content-box">
                    
                    <!-- Admin Orders Tab -->
                    <div id="tab-admin-orders" class="admin-tab-content">
                        <h2 style="font-family: var(--font-heading); font-size: 22px; margin-bottom: 20px;">Marketplace Order Invoices</h2>
                        
                        <div class="table-wrapper">
                            <table class="nexus-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Customer</th>
                                        <th>Target Player (Game)</th>
                                        <th>Total Invoice</th>
                                        <th>Payment</th>
                                        <th>Fulfillment</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${orders.map(order => {
                                        let payClass = 'pending';
                                        if (order.payment_status === 'Payment Submitted') payClass = 'submitted';
                                        if (order.payment_status === 'Payment Verified') payClass = 'verified';
                                        
                                        let orderClass = 'pending';
                                        if (order.order_status === 'Processing') orderClass = 'processing';
                                        if (order.order_status === 'Completed') orderClass = 'completed';
                                        if (order.order_status === 'Cancelled') orderClass = 'cancelled';
                                        if (order.order_status === 'Payment Submitted') orderClass = 'submitted';

                                        return `
                                            <tr>
                                                <td style="font-family: monospace; font-weight:700; color:var(--color-accent);">${order.id}</td>
                                                <td>
                                                    <strong>${order.customer_name}</strong><br>
                                                    <span style="font-size:11px; color:var(--text-muted);">${order.customer_email}</span>
                                                </td>
                                                <td>
                                                    <strong>${order.player_uid}</strong><br>
                                                    <span style="font-size:11px; color:var(--text-muted);">${order.player_name} &bull; ${order.game} &bull; ${order.region}</span>
                                                </td>
                                                <td style="font-weight:700;">$${order.total.toFixed(2)}</td>
                                                <td><span class="status-indicator ${payClass}">${order.payment_status}</span></td>
                                                <td><span class="status-indicator ${orderClass}">${order.order_status}</span></td>
                                                <td>
                                                    <button onclick="openStatusUpdateModal('${order.id}', '${order.payment_status}', '${order.order_status}')" class="btn btn-secondary" style="padding:6px 12px; font-size:12px;">Update</button>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Admin Products Tab -->
                    <div id="tab-admin-products" class="admin-tab-content" style="display: none;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                            <h2 style="font-family: var(--font-heading); font-size: 22px;">Inventory Products</h2>
                            <button onclick="openProductModal()" class="btn btn-primary" style="padding:10px 18px; font-size:13px;"><i data-lucide="plus"></i> Add Product</button>
                        </div>
                        
                        <div class="table-wrapper">
                            <table class="nexus-table">
                                <thead>
                                    <tr>
                                        <th>Preview</th>
                                        <th>Name</th>
                                        <th>Game</th>
                                        <th>Rarity</th>
                                        <th>Price (USD)</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${products.map(prod => `
                                        <tr>
                                            <td>
                                                <img src="${prod.image_url}" alt="" style="width:40px; height:40px; border-radius:6px; object-fit:cover; border:1px solid var(--border-color);">
                                            </td>
                                            <td><strong>${prod.name}</strong></td>
                                            <td>${prod.game}</td>
                                            <td>${prod.rarity}</td>
                                            <td style="font-weight:700;">$${prod.price.toFixed(2)}</td>
                                            <td>
                                                <span class="status-indicator ${prod.available ? 'completed' : 'cancelled'}">${prod.available ? 'Available' : 'Disabled'}</span>
                                            </td>
                                            <td>
                                                <div style="display:flex; gap:8px;">
                                                    <button onclick='openProductModal(${JSON.stringify(prod).replace(/'/g, "&apos;")})' class="btn btn-secondary" style="padding:6px 10px; font-size:12px;"><i data-lucide="edit-2" style="width:12px; height:12px;"></i></button>
                                                    <button onclick="handleDeleteProduct(${prod.id})" class="btn btn-secondary" style="padding:6px 10px; font-size:12px; color:#ff4d4d; border-color:rgba(255, 77, 77, 0.15);"><i data-lucide="trash-2" style="width:12px; height:12px;"></i></button>
                                                </div>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Admin Payment QR Settings Tab -->
                    <div id="tab-admin-payment" class="admin-tab-content" style="display: none;">
                        <h2 style="font-family: var(--font-heading); font-size: 22px; margin-bottom: 20px;">UPI QR Code Payment Settings</h2>
                        
                        <form id="admin-payment-form" onsubmit="handlePaymentSettingsSubmit(event)" class="product-card bg-glass" style="padding:30px; max-width:550px; display:flex; flex-direction:column; gap:20px;">
                            <div class="form-group">
                                <label>UPI ID (e.g. 9514823854@nyes)</label>
                                <input type="text" id="admin-upi-id" value="${state.paymentSettings ? state.paymentSettings.payment_identifier : ''}" required>
                            </div>
                            <div class="form-group">
                                <label>Payment Instructions</label>
                                <textarea id="admin-upi-instructions" rows="3" required>${state.paymentSettings ? state.paymentSettings.instructions : ''}</textarea>
                            </div>
                            <div class="form-group">
                                <label>Payment QR Image URL</label>
                                <input type="text" id="admin-qr-url" value="${state.paymentSettings ? state.paymentSettings.qr_image_url : ''}">
                            </div>
                            
                            <!-- Custom QR Code Image Upload -->
                            <div class="form-group">
                                <label>Or Upload Custom Payment QR Code</label>
                                <div class="upload-zone" onclick="document.getElementById('qr-file-input').click()">
                                    <i data-lucide="upload-cloud" style="width:36px; height:36px; color:var(--text-muted);"></i>
                                    <span style="font-size:13px; color:var(--text-muted);">Click to upload PNG or JPG file</span>
                                    <input type="file" id="qr-file-input" style="display:none;" onchange="handleAdminFileUpload(event, 'admin-qr-url', 'qr-upload-preview')">
                                </div>
                                <div class="upload-preview" id="qr-upload-preview" style="margin-top:10px; display: ${state.paymentSettings ? 'block' : 'none'};">
                                    <img src="${state.paymentSettings ? state.paymentSettings.qr_image_url : ''}" alt="">
                                </div>
                            </div>

                            <button type="submit" class="btn btn-primary" style="padding:14px; font-size:15px; margin-top:10px;">
                                Save Payment Settings <i data-lucide="save"></i>
                            </button>
                        </form>
                    </div>

                </div>
            </div>
        </div>

        <!-- MODAL OVERLAYS (dynamically created on page and managed) -->
        <div class="modal-overlay" id="status-modal">
            <div class="modal-content">
                <button class="modal-close" onclick="closeModal('status-modal')"><i data-lucide="x"></i></button>
                <h3 style="font-family: var(--font-heading); font-size: 20px; margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">Update Order Status</h3>
                <form onsubmit="handleStatusSubmit(event)">
                    <input type="hidden" id="modal-order-id">
                    <div class="form-group">
                        <label>Payment Invoice Status</label>
                        <select id="modal-payment-status">
                            <option value="Pending Payment">Pending Payment</option>
                            <option value="Payment Submitted">Payment Submitted</option>
                            <option value="Payment Verified">Payment Verified</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Fulfillment/Order Status</label>
                        <select id="modal-order-status">
                            <option value="Pending Payment">Pending Payment</option>
                            <option value="Payment Submitted">Payment Submitted</option>
                            <option value="Payment Verified">Payment Verified</option>
                            <option value="Processing">Processing</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width:100%; padding:12px; margin-top:14px;">Update Status</button>
                </form>
            </div>
        </div>

        <div class="modal-overlay" id="product-modal" style="display:flex; align-items:center; justify-content:center;">
            <div class="modal-content" style="max-width: 600px; max-height: 90vh; overflow-y: auto;">
                <button class="modal-close" onclick="closeModal('product-modal')"><i data-lucide="x"></i></button>
                <h3 style="font-family: var(--font-heading); font-size: 20px; margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;" id="prod-modal-title">Create Product</h3>
                <form id="product-form" onsubmit="handleProductFormSubmit(event)">
                    <input type="hidden" id="prod-id">
                    <div class="form-group">
                        <label>Product Name *</label>
                        <input type="text" id="prod-name" required placeholder="e.g. Neptune Vandal">
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                        <div class="form-group">
                            <label>Target Game *</label>
                            <select id="prod-game" required>
                                <option value="Valorant">Valorant</option>
                                <option value="CS2">CS2</option>
                                <option value="Fortnite">Fortnite</option>
                                <option value="PUBG">PUBG</option>
                                <option value="Free Fire">Free Fire</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Rarity Tier *</label>
                            <select id="prod-rarity" required>
                                <option value="Legendary">Legendary</option>
                                <option value="Epic">Epic</option>
                                <option value="Rare">Rare</option>
                            </select>
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                        <div class="form-group">
                            <label>Price (USD) *</label>
                            <input type="number" step="0.01" id="prod-price" required placeholder="29.99">
                        </div>
                        <div class="form-group">
                            <label>Rating (1.0 - 5.0)</label>
                            <input type="number" step="0.1" min="1" max="5" id="prod-rating" value="5.0">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Image URL *</label>
                        <input type="text" id="prod-image-url" required placeholder="/static/images/neptune_vandal.jpg">
                    </div>
                    
                    <!-- Product Image File Upload -->
                    <div class="form-group">
                        <label>Or Upload Product Image</label>
                        <div class="upload-zone" onclick="document.getElementById('prod-file-input').click()">
                            <i data-lucide="upload-cloud" style="width:24px; height:24px; color:var(--text-muted);"></i>
                            <span style="font-size:12px; color:var(--text-muted);">Click to upload item image</span>
                            <input type="file" id="prod-file-input" style="display:none;" onchange="handleAdminFileUpload(event, 'prod-image-url', 'prod-upload-preview')">
                        </div>
                        <div class="upload-preview" id="prod-upload-preview" style="margin-top:10px;">
                            <img src="" alt="">
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Product Description *</label>
                        <textarea id="prod-desc" rows="3" required placeholder="Describe the item layout..."></textarea>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin: 10px 0;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <input type="checkbox" id="prod-featured" style="width:18px; height:18px; cursor:pointer;">
                            <label for="prod-featured" style="cursor:pointer; margin-bottom:0;">Featured Drop</label>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <input type="checkbox" id="prod-available" checked style="width:18px; height:18px; cursor:pointer;">
                            <label for="prod-available" style="cursor:pointer; margin-bottom:0;">Available</label>
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width:100%; padding:12px; margin-top:14px;" id="prod-btn-submit">Create Product</button>
                </form>
            </div>
        </div>
    `;
}

window.switchAdminTab = function(tabId) {
    document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.style.display = 'none';
    });
    document.querySelectorAll('.sidebar-menu .sidebar-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const activeTab = document.getElementById(`tab-${tabId}`);
    if (activeTab) activeTab.style.display = 'block';

    const activeBtn = document.getElementById(`btn-${tabId}`);
    if (activeBtn) activeBtn.classList.add('active');
};

// Modals Controls
window.closeModal = function(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('active');
};

window.openStatusUpdateModal = function(orderId, paymentStatus, orderStatus) {
    document.getElementById('modal-order-id').value = orderId;
    document.getElementById('modal-payment-status').value = paymentStatus;
    document.getElementById('modal-order-status').value = orderStatus;
    
    document.getElementById('status-modal').classList.add('active');
    lucide.createIcons();
};

window.handleStatusSubmit = async function(e) {
    e.preventDefault();
    const orderId = document.getElementById('modal-order-id').value;
    const payment_status = document.getElementById('modal-payment-status').value;
    const order_status = document.getElementById('modal-order-status').value;

    try {
        const res = await fetch(`/api/admin/orders/${orderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payment_status, order_status })
        });
        
        if (res.ok) {
            closeModal('status-modal');
            showToast("Order status updated successfully!");
            router();
        } else {
            alert("Failed to update status");
        }
    } catch (err) {
        console.error(err);
    }
};

window.openProductModal = function(product = null) {
    const form = document.getElementById('product-form');
    form.reset();

    const preview = document.getElementById('prod-upload-preview');
    const previewImg = preview.querySelector('img');
    preview.style.display = 'none';
    previewImg.src = '';

    if (product) {
        document.getElementById('prod-modal-title').innerText = 'Edit Product';
        document.getElementById('prod-btn-submit').innerText = 'Save Changes';
        document.getElementById('prod-id').value = product.id;
        document.getElementById('prod-name').value = product.name;
        document.getElementById('prod-game').value = product.game;
        document.getElementById('prod-rarity').value = product.rarity;
        document.getElementById('prod-price').value = product.price;
        document.getElementById('prod-rating').value = product.rating;
        document.getElementById('prod-image-url').value = product.image_url;
        document.getElementById('prod-desc').value = product.description;
        document.getElementById('prod-featured').checked = product.featured === 1;
        document.getElementById('prod-available').checked = product.available === 1;

        if (product.image_url) {
            preview.style.display = 'block';
            previewImg.src = product.image_url;
        }
    } else {
        document.getElementById('prod-modal-title').innerText = 'Create Product';
        document.getElementById('prod-btn-submit').innerText = 'Create Product';
        document.getElementById('prod-id').value = '';
    }

    document.getElementById('product-modal').classList.add('active');
    lucide.createIcons();
};

window.handleProductFormSubmit = async function(e) {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;
    const name = document.getElementById('prod-name').value;
    const game = document.getElementById('prod-game').value;
    const rarity = document.getElementById('prod-rarity').value;
    const price = document.getElementById('prod-price').value;
    const rating = document.getElementById('prod-rating').value;
    const image_url = document.getElementById('prod-image-url').value;
    const description = document.getElementById('prod-desc').value;
    const featured = document.getElementById('prod-featured').checked ? 1 : 0;
    const available = document.getElementById('prod-available').checked ? 1 : 0;

    const payload = { name, game, rarity, price, rating, image_url, description, featured, available };
    
    const url = id ? `/api/products/${id}` : '/api/products';
    const method = id ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (res.ok) {
            closeModal('product-modal');
            showToast(id ? "Product updated successfully!" : "Product created successfully!");
            router();
        } else {
            const data = await res.json();
            alert(data.error || "Failed to save product");
        }
    } catch (err) {
        console.error(err);
    }
};

window.handleDeleteProduct = async function(productId) {
    if (!confirm("Are you sure you want to delete this product? This action is permanent.")) return;

    try {
        const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
        if (res.ok) {
            showToast("Product deleted successfully!");
            router();
        } else {
            alert("Failed to delete product");
        }
    } catch (e) {
        console.error(e);
    }
};

// Admin upload handler
window.handleAdminFileUpload = async function(event, urlInputId, previewId) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        showToast("Uploading file...");
        const res = await fetch('/api/admin/upload', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        
        if (!res.ok) {
            alert(data.error || "File upload failed");
            return;
        }

        // Set value in text input
        const input = document.getElementById(urlInputId);
        if (input) input.value = data.url;

        // Update preview
        const preview = document.getElementById(previewId);
        if (preview) {
            preview.style.display = 'block';
            preview.querySelector('img').src = data.url;
        }
        showToast("Image uploaded successfully!");
    } catch (e) {
        console.error(e);
        alert("An error occurred during file upload.");
    }
};

window.handlePaymentSettingsSubmit = async function(e) {
    e.preventDefault();
    const payment_identifier = document.getElementById('admin-upi-id').value;
    const instructions = document.getElementById('admin-upi-instructions').value;
    const qr_image_url = document.getElementById('admin-qr-url').value;

    try {
        const res = await fetch('/api/admin/payment-settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payment_identifier, instructions, qr_image_url })
        });
        
        if (res.ok) {
            await fetchPaymentSettings();
            showToast("Payment settings updated successfully!");
            router();
        } else {
            alert("Failed to update settings");
        }
    } catch (err) {
        console.error(err);
    }
};
