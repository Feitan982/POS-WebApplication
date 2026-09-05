/* pos.js - Point of Sale functionality */
(function() {
    // ===================== POS CART & PAYMENT =====================

    // --- DOM elements ---
    const productGrid = document.getElementById('productGrid');
    const cartItems = document.getElementById('cartItems');
    const subtotalEl = document.getElementById('subtotal');
    const taxEl = document.getElementById('tax');
    const totalEl = document.getElementById('total');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const clearCartBtn = document.getElementById('clearCartBtn');
    const productSearch = document.getElementById('productSearch');
    const paymentModal = document.getElementById('paymentModal');
    const paymentClose = document.getElementById('paymentClose');
    const paymentTotal = document.getElementById('paymentTotal');
    const customerName = document.getElementById('customerName');
    const customerPhone = document.getElementById('customerPhone');
    const customerEmail = document.getElementById('customerEmail');
    const paymentMethods = document.querySelectorAll('.payment-method');
    const cashInputGroup = document.getElementById('cashInputGroup');
    const cashReceived = document.getElementById('cashReceived');
    const changeAmount = document.getElementById('changeAmount');
    const confirmPaymentBtn = document.getElementById('confirmPaymentBtn');

    // --- State ---
    let cart = {};          // { productName: quantity }
    let selectedPaymentMethod = 'cash';
    const formatCurrency = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value) || 0);

    function renderProductCatalog(products) {
        if (!productGrid) return;
        const categoryIcons = {
            tools: 'fa-tools', hardware: 'fa-cog', electrical: 'fa-bolt', plumbing: 'fa-wrench',
            paint: 'fa-paint-brush', garden: 'fa-leaf', building: 'fa-building', fasteners: 'fa-link', safety: 'fa-shield-alt'
        };
        productGrid.innerHTML = products.filter(product => Number(product.quantity) > 0).map(product => {
            const sizeOptions = product.size ? ` data-size-options="${product.size}"` : '';
            return `<div class="product-card" data-name="${product.name}" data-price="${product.price}" data-category="${product.category}"${sizeOptions}>
                <i class="fas ${categoryIcons[product.category] || 'fa-box'}"></i>
                <p>${product.name}</p>
                ${product.size ? `<small>Size: ${product.size}</small>` : ''}
                <strong>${formatCurrency(product.price)}</strong>
            </div>`;
        }).join('');
    }

    async function loadProductCatalog() {
        const supabaseApi = window.POS_SUPABASE;
        if (!supabaseApi?.isConfigured?.()) {
            renderProductCatalog([]);
            return;
        }
        const result = await supabaseApi.getInventoryProducts();
        if (result.error) {
            renderProductCatalog([]);
            showToast(result.error.message, 'error');
            return;
        }
        renderProductCatalog(result.data || []);
    }

    // --- Helper: show toast (using existing toast container) ---
    function showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
        toast.innerHTML = `
            <i class="fas ${icon}"></i>
            <span>${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
        `;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(20px)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // --- Get product price from data attribute ---
    function getProductPrice(card) {
        return parseFloat(card.dataset.price) || 0;
    }

    // --- Cart operations ---
    function getCartKey(name, size = '') {
        return size ? `${name}::${size}` : name;
    }

    function parseCartKey(cartKey) {
        const separatorIndex = cartKey.indexOf('::');
        if (separatorIndex === -1) {
            return { name: cartKey, size: '' };
        }
        return {
            name: cartKey.slice(0, separatorIndex),
            size: cartKey.slice(separatorIndex + 2)
        };
    }

    function addToCart(name, price, size = '') {
        const cartKey = getCartKey(name, size);
        cart[cartKey] = (cart[cartKey] || 0) + 1;
        updateCartDisplay();
        const label = size ? `${name} (${size})` : name;
        showToast(`Added ${label} to cart (Qty: ${cart[cartKey]})`, 'success');
    }

    function updateQuantity(cartKey, delta) {
        if (cart[cartKey]) {
            cart[cartKey] += delta;
            if (cart[cartKey] <= 0) {
                delete cart[cartKey];
            }
            updateCartDisplay();
        }
    }

    function clearCart() {
        cart = {};
        updateCartDisplay();
        showToast('Cart cleared', 'success');
    }

    function updateCartDisplay() {
        // Render cart items
        if (Object.keys(cart).length === 0) {
            cartItems.innerHTML = `
                <div style="text-align: center; color: var(--text-secondary); padding: 2rem;">
                    <i class="fas fa-shopping-cart" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <p>Cart is empty</p>
                    <p style="font-size: 0.9rem;">Click on products to add them</p>
                </div>
            `;
        } else {
            cartItems.innerHTML = '';
            for (const [cartKey, qty] of Object.entries(cart)) {
                const { name, size } = parseCartKey(cartKey);
                const price = getProductPriceByName(name);
                const displayName = size ? `${name} (${size})` : name;
                const itemDiv = document.createElement('div');
                itemDiv.className = 'cart-item';
                itemDiv.innerHTML = `
                    <div class="cart-item-info">
                        <span class="cart-item-name">${displayName}</span>
                        <span class="cart-item-qty">${formatCurrency(price)} each</span>
                    </div>
                    <div class="cart-item-actions">
                        <button class="qty-btn" data-action="decrease" data-cart-key="${cartKey}">
                            <i class="fas fa-minus"></i>
                        </button>
                        <span style="min-width: 30px; text-align: center; font-weight: 600;">${qty}</span>
                        <button class="qty-btn" data-action="increase" data-cart-key="${cartKey}">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <strong style="min-width: 80px; text-align: right;">${formatCurrency(price * qty)}</strong>
                `;
                cartItems.appendChild(itemDiv);
            }
        }

        // Calculate totals
        let subtotal = 0;
        for (const [cartKey, qty] of Object.entries(cart)) {
            const { name } = parseCartKey(cartKey);
            const price = getProductPriceByName(name);
            subtotal += price * qty;
        }
        const tax = subtotal * 0.08;
        const total = subtotal + tax;

        subtotalEl.textContent = formatCurrency(subtotal);
        taxEl.textContent = formatCurrency(tax);
        totalEl.textContent = formatCurrency(total);
    }

    function getProductPriceByName(name) {
        // Find the product card with that name and get its data-price
        const card = document.querySelector(`.product-card[data-name="${name}"]`);
        return card ? parseFloat(card.dataset.price) : 0;
    }

    // --- Event delegation for product cards (click to add) ---
    if (productGrid) {
        productGrid.addEventListener('click', (e) => {
            const card = e.target.closest('.product-card');
            if (card) {
                const name = card.dataset.name;
                const price = parseFloat(card.dataset.price);
                const sizeOptions = (card.dataset.sizeOptions || '')
                    .split(',')
                    .map(item => item.trim())
                    .filter(Boolean);

                if (sizeOptions.length > 0) {
                    const selectedSize = window.prompt(`Choose a size for ${name}: ${sizeOptions.join(', ')}`, sizeOptions[0]);
                    if (selectedSize === null) return;
                    const normalizedSize = selectedSize.trim();
                    if (!normalizedSize) return;
                    addToCart(name, price, normalizedSize);
                    return;
                }

                addToCart(name, price);
            }
        });
    }

    loadProductCatalog();
    window.addEventListener('inventory-products-loaded', event => renderProductCatalog(event.detail || []));

    // --- Product search filter ---
    if (productSearch) {
        productSearch.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            document.querySelectorAll('.product-card').forEach(card => {
                const name = card.dataset.name.toLowerCase();
                const category = card.dataset.category.toLowerCase();
                if (name.includes(searchTerm) || category.includes(searchTerm)) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    }

    // --- Cart item quantity buttons (event delegation) ---
    if (cartItems) {
        cartItems.addEventListener('click', (e) => {
            const btn = e.target.closest('.qty-btn');
            if (!btn) return;
            const cartKey = btn.dataset.cartKey;
            const action = btn.dataset.action;
            if (!cartKey) return;
            if (action === 'increase') {
                updateQuantity(cartKey, 1);
            } else if (action === 'decrease') {
                updateQuantity(cartKey, -1);
            }
        });
    }

    // --- Clear cart button ---
    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', clearCart);
    }

    // --- Checkout button: open payment modal ---
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            if (Object.keys(cart).length === 0) {
                showToast('Cart is empty', 'error');
                return;
            }
            // Compute total
            let subtotal = 0;
            for (const [cartKey, qty] of Object.entries(cart)) {
                const { name } = parseCartKey(cartKey);
                const price = getProductPriceByName(name);
                subtotal += price * qty;
            }
            const tax = subtotal * 0.08;
            const total = subtotal + tax;

            // Set modal total
            if (paymentTotal) paymentTotal.textContent = formatCurrency(total);

            // Reset payment method to cash (default)
            selectedPaymentMethod = 'cash';
            paymentMethods.forEach(m => m.classList.remove('selected'));
            document.querySelector('.payment-method[data-method="cash"]').classList.add('selected');
            if (cashInputGroup) cashInputGroup.style.display = 'block';
            if (cashReceived) cashReceived.value = '';
            if (changeAmount) changeAmount.textContent = formatCurrency(0);

            // Clear customer info fields
            if (customerName) customerName.value = '';
            if (customerPhone) customerPhone.value = '';
            if (customerEmail) customerEmail.value = '';

            // Show modal
            paymentModal.classList.add('show');
        });
    }

    // --- Close payment modal ---
    if (paymentClose) {
        paymentClose.addEventListener('click', () => {
            paymentModal.classList.remove('show');
        });
    }

    // Also close when clicking outside modal content
    if (paymentModal) {
        paymentModal.addEventListener('click', (e) => {
            if (e.target === paymentModal) {
                paymentModal.classList.remove('show');
            }
        });
    }

    // --- Payment method selection ---
    paymentMethods.forEach(method => {
        method.addEventListener('click', () => {
            paymentMethods.forEach(m => m.classList.remove('selected'));
            method.classList.add('selected');
            selectedPaymentMethod = method.dataset.method;

            // Show/hide cash input
            if (cashInputGroup) {
                cashInputGroup.style.display = selectedPaymentMethod === 'cash' ? 'block' : 'none';
            }
        });
    });

    // --- Cash received input: calculate change ---
    if (cashReceived) {
        cashReceived.addEventListener('input', (e) => {
            const cash = parseFloat(e.target.value) || 0;
            // Get total from modal
            const totalText = paymentTotal.textContent.replace(/[^\d.-]/g, '');
            const total = parseFloat(totalText) || 0;
            const change = cash - total;
            if (changeAmount) {
                changeAmount.textContent = change >= 0 ? formatCurrency(change) : 'Insufficient amount';
            }
        });
    }

    // --- Confirm payment ---
    if (confirmPaymentBtn) {
        confirmPaymentBtn.addEventListener('click', () => {
            const totalText = paymentTotal.textContent.replace(/[^\d.-]/g, '');
            const total = parseFloat(totalText) || 0;
            const name = customerName ? customerName.value.trim() : '';
            const phone = customerPhone ? customerPhone.value.trim() : '';
            const email = customerEmail ? customerEmail.value.trim() : '';

            if (selectedPaymentMethod === 'cash') {
                const cash = parseFloat(cashReceived.value) || 0;
                if (cash < total) {
                    showToast('Insufficient cash amount', 'error');
                    return;
                }
                const change = cash - total;
                let message = `Payment successful! Change: ${formatCurrency(change)}`;
                if (name) message += ` | Customer: ${name}`;
                showToast(message, 'success');
            } else {
                let message = selectedPaymentMethod === 'card' 
                    ? 'Card payment processed successfully!' 
                    : 'Mobile payment processed successfully!';
                if (name) message += ` | Customer: ${name}`;
                showToast(message, 'success');
            }

            // Clear cart and close modal
            cart = {};
            updateCartDisplay();
            paymentModal.classList.remove('show');
        });
    }

    // Initialize cart display
    updateCartDisplay();
})();