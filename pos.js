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
    const receiptModal = document.getElementById('receiptModal');
    const receiptContent = document.getElementById('receiptContent');
    const receiptClose = document.getElementById('receiptClose');
    const receiptDoneBtn = document.getElementById('receiptDoneBtn');
    const printReceiptBtn = document.getElementById('printReceiptBtn');
    const paymentTotal = document.getElementById('paymentTotal');
    const customerName = document.getElementById('customerName');
    const customerPhone = document.getElementById('customerPhone');
    const paymentMethods = document.querySelectorAll('.payment-method');
    const cashInputGroup = document.getElementById('cashInputGroup');
    const cashReceived = document.getElementById('cashReceived');
    const changeAmount = document.getElementById('changeAmount');
    const confirmPaymentBtn = document.getElementById('confirmPaymentBtn');

    // --- State ---
    let cart = {};          // { productName: quantity }
    let selectedPaymentMethod = 'cash';
    const formatCurrency = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value) || 0);

    function escapeHtml(value) {
        return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
    }

    function renderProductCatalog(products) {
        if (!productGrid) return;
        const categoryIcons = {
            tools: 'fa-tools', hardware: 'fa-cog', electrical: 'fa-bolt', plumbing: 'fa-wrench',
            paint: 'fa-paint-brush', garden: 'fa-leaf', building: 'fa-building', fasteners: 'fa-link', safety: 'fa-shield-alt'
        };
        productGrid.innerHTML = products.filter(product => Number(product.quantity) > 0).map(product => {
            const sizes = String(product.size || '').split(',').map(size => size.trim()).filter(Boolean);
            const sizeOptions = sizes.length ? ` data-size-options="${sizes.map(escapeHtml).join(',')}"` : '';
            return `<div class="product-card" data-name="${product.name}" data-price="${product.price}" data-category="${product.category}"${sizeOptions}>
                <i class="fas ${categoryIcons[product.category] || 'fa-box'}"></i>
                <p>${product.name}</p>
                <span class="product-card-category">${escapeHtml(product.category || 'Uncategorized')}</span>
                <span class="product-card-sku">SKU: ${escapeHtml(product.sku || 'N/A')}</span>
                ${sizes.length ? `<small class="product-card-sizes">Sizes: ${sizes.map(escapeHtml).join(', ')}</small>` : ''}
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
    function showToast(message, type = 'success', options = {}) {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}${options.cartUpdate ? ' cart-toast' : ''}`;
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
        }, options.cartUpdate ? 1600 : 4000);
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
                const itemDiv = document.createElement('div');
                itemDiv.className = 'cart-item';
                itemDiv.innerHTML = `
                    <div class="cart-item-info">
                        <span class="cart-item-name">${escapeHtml(name)}</span>
                        ${size ? `<span class="cart-item-size"><i class="fas fa-ruler-horizontal" aria-hidden="true"></i> Size: ${escapeHtml(size)}</span>` : ''}
                        <span class="cart-item-qty">${formatCurrency(price)} each</span>
                    </div>
                    <div class="cart-item-actions">
                        <button class="qty-btn" data-action="decrease" data-cart-key="${cartKey}">
                            <i class="fas fa-minus"></i>
                        </button>
                        <span class="cart-item-quantity">${qty}</span>
                        <button class="qty-btn" data-action="increase" data-cart-key="${cartKey}">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <strong class="cart-item-total">${formatCurrency(price * qty)}</strong>
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
            if (e.target.closest('.pos-size-selector')) return;
            const card = e.target.closest('.product-card');
            if (card) {
                const name = card.dataset.name;
                const price = parseFloat(card.dataset.price);
                const sizeOptions = (card.dataset.sizeOptions || '')
                    .split(',')
                    .map(item => item.trim())
                    .filter(Boolean);

                if (sizeOptions.length > 0) {
                    card.querySelector('.pos-size-selector')?.remove();
                    const selector = document.createElement('select');
                    selector.className = 'pos-size-selector';
                    selector.setAttribute('aria-label', `Choose a size for ${name}`);
                    selector.innerHTML = '<option value="">Choose size</option>' + sizeOptions
                        .map(size => `<option value="${escapeHtml(size)}">${escapeHtml(size)}</option>`)
                        .join('');
                    selector.addEventListener('change', () => {
                        if (!selector.value) return;
                        addToCart(name, price, selector.value);
                        selector.remove();
                    });
                    card.appendChild(selector);
                    selector.focus();
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

    function createReceiptNumber() {
        const now = new Date();
        const datePart = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
            .map(value => String(value).padStart(2, '0')).join('');
        const timePart = [now.getHours(), now.getMinutes(), now.getSeconds()]
            .map(value => String(value).padStart(2, '0')).join('');
        const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `REC-${datePart}-${timePart}-${randomPart}`;
    }

    function showReceipt(receiptNumber, items, subtotal, tax, total, name, phone, paymentMethod, cash, change) {
        const itemRows = items.map(item => `
            <div class="receipt-line">
                <span>${escapeHtml(item.name)} x${item.quantity}</span>
                <strong>$${(item.price * item.quantity).toFixed(2)}</strong>
            </div>
        `).join('');
        const customer = [name, phone].filter(Boolean).map(escapeHtml).join(' | ');
        const paymentLabel = paymentMethod === 'card' ? 'Credit/Debit Card' : paymentMethod === 'mobile' ? 'Mobile Payment' : 'Cash';

        receiptContent.innerHTML = `
            <div class="receipt-store-name">Kirby's Hardware</div>
            <div class="receipt-heading">POS TRANSACTION</div>
            <div class="receipt-number">Receipt No: ${escapeHtml(receiptNumber)}</div>
            <div class="receipt-store-details">
                <div>Gimeno Bldg, Gungon St</div>
                <div>Santa Maria, 3022 Bulacan</div>
                <div>Contact: 0935 491 9766</div>
            </div>
            ${customer ? `<div class="receipt-meta">Customer: ${customer}</div>` : ''}
            <div class="receipt-items">${itemRows}</div>
            <div class="receipt-total-line"><span>Subtotal</span><span>$${subtotal.toFixed(2)}</span></div>
            <div class="receipt-total-line"><span>Tax (8%)</span><span>$${tax.toFixed(2)}</span></div>
            <div class="receipt-total-line receipt-grand-total"><strong>Total</strong><strong>$${total.toFixed(2)}</strong></div>
            <div class="receipt-meta">Payment: ${paymentLabel}</div>
            ${paymentMethod === 'cash' ? `<div class="receipt-total-line"><span>Cash received</span><span>$${cash.toFixed(2)}</span></div><div class="receipt-total-line"><span>Change</span><span>$${change.toFixed(2)}</span></div>` : ''}
        `;
        receiptModal.classList.add('show');
    }

    function printReceipt() {
        const printWindow = window.open('', '_blank', 'width=420,height=700');
        if (!printWindow) {
            showToast('Allow pop-ups to print the receipt', 'error');
            return;
        }
        printWindow.document.write(`<!doctype html><html><head><title>POS Receipt</title><style>
            body { font-family: Arial, sans-serif; width: 300px; margin: 20px auto; color: #111; }
            h1 { font-size: 18px; text-align: center; margin: 0 0 16px; }
            .receipt-line, .receipt-total-line { display: flex; justify-content: space-between; gap: 12px; margin: 8px 0; }
            .receipt-items { border-top: 1px dashed #999; border-bottom: 1px dashed #999; padding: 8px 0; margin: 12px 0; }
            .receipt-grand-total { border-top: 1px solid #111; padding-top: 8px; font-size: 16px; }
            .receipt-meta { font-size: 12px; margin: 8px 0; }
            .receipt-heading, .receipt-store-name, .receipt-store-details { text-align: center; }
            .receipt-store-name { font-size: 18px; font-weight: bold; margin-bottom: 4px; }
            .receipt-heading { font-weight: bold; margin-bottom: 4px; }
            .receipt-store-details { font-size: 11px; line-height: 1.5; margin-bottom: 12px; }
        </style></head><body>${receiptContent.innerHTML}</body></html>`);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    }

    [receiptClose, receiptDoneBtn].forEach(button => {
        if (button) button.addEventListener('click', () => receiptModal.classList.remove('show'));
    });

    if (receiptModal) {
        receiptModal.addEventListener('click', event => {
            if (event.target === receiptModal) receiptModal.classList.remove('show');
        });
    }

    if (printReceiptBtn) printReceiptBtn.addEventListener('click', printReceipt);

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
            const items = Object.entries(cart).map(([itemName, quantity]) => ({
                name: itemName,
                quantity,
                price: getProductPriceByName(itemName)
            }));
            const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
            const tax = subtotal * 0.08;
            const receiptNumber = createReceiptNumber();
            let cash = 0;
            let change = 0;

            if (selectedPaymentMethod === 'cash') {
                cash = parseFloat(cashReceived.value) || 0;
                if (cash < total) {
                    showToast('Insufficient cash amount', 'error');
                    return;
                }
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
            showReceipt(receiptNumber, items, subtotal, tax, total, name, phone, selectedPaymentMethod, cash, change);
        });
    }

    // Initialize cart display
    updateCartDisplay();
})();