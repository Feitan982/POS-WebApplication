/* inventory.js - Inventory management functionality */
(function() {
    let inventoryState = {
        products: [],
        filteredProducts: [],
        currentPage: 1,
        itemsPerPage: 10,
        searchTerm: '',
        categoryFilter: '',
        stockFilter: '',
        editingProductId: null,
        deletingProductId: null,
        initialized: false
    };

    const supabaseApi = window.POS_SUPABASE;
    const formatCurrency = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value) || 0);

    function mapProduct(product) {
        return {
            ...product,
            size: normalizeSizes(product.size),
            minStock: product.minStock ?? product.min_stock ?? 0,
            lastUpdated: product.lastUpdated || product.updated_at || product.created_at || ''
        };
    }

    function normalizeSizes(size) {
        return [...new Set(String(size || '').split(',').map(value => value.trim()).filter(Boolean))].join(',');
    }

    function showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
        toast.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span><button class="toast-close" type="button">&times;</button>`;
        container.appendChild(toast);
        toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(20px)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    function getStockStatus(quantity, minStock) {
        if (quantity === 0) return 'out_of_stock';
        if (quantity <= minStock) return 'low_stock';
        if (quantity > minStock * 2) return 'over_stock';
        return 'in_stock';
    }

    function getStockBadge(status) {
        const badges = {
            in_stock: '<span class="stock-badge in-stock"><i class="fas fa-check-circle"></i> In Stock</span>',
            low_stock: '<span class="stock-badge low-stock"><i class="fas fa-exclamation-triangle"></i> Low Stock</span>',
            out_of_stock: '<span class="stock-badge out-of-stock"><i class="fas fa-times-circle"></i> Out of Stock</span>',
            over_stock: '<span class="stock-badge over-stock"><i class="fas fa-arrow-up"></i> Over Stocked</span>'
        };
        return badges[status] || badges.in_stock;
    }

    function updateInventoryStats() {
        const totalProducts = document.getElementById('totalProducts');
        if (!totalProducts) return;
        totalProducts.textContent = inventoryState.products.length;
        document.getElementById('inStockProducts').textContent = inventoryState.products.filter(p => p.quantity > p.minStock).length;
        document.getElementById('lowStockProducts').textContent = inventoryState.products.filter(p => p.quantity > 0 && p.quantity <= p.minStock).length;
        document.getElementById('outOfStockProducts').textContent = inventoryState.products.filter(p => p.quantity === 0).length;
    }

    function filterProducts() {
        const { searchTerm, categoryFilter, stockFilter } = inventoryState;
        const search = searchTerm.toLowerCase();
        inventoryState.filteredProducts = inventoryState.products.filter(product => {
            const matchesSearch = !search || product.name.toLowerCase().includes(search) || product.sku.toLowerCase().includes(search) || (product.supplier || '').toLowerCase().includes(search);
            const matchesCategory = !categoryFilter || product.category === categoryFilter;
            const matchesStock = !stockFilter || getStockStatus(product.quantity, product.minStock) === stockFilter;
            return matchesSearch && matchesCategory && matchesStock;
        });
        inventoryState.currentPage = 1;
        renderInventoryTable();
        renderPagination();
    }

    function renderInventoryTable() {
        const tbody = document.getElementById('inventoryTableBody');
        const table = document.getElementById('inventoryTable');
        const emptyState = document.getElementById('inventoryEmpty');
        const loading = document.getElementById('inventoryLoading');
        if (!tbody) return;
        if (loading) loading.style.display = 'block';
        if (table) table.style.display = 'none';
        setTimeout(() => {
            if (loading) loading.style.display = 'none';
            const products = inventoryState.filteredProducts;
            if (!products.length) {
                if (emptyState) emptyState.style.display = 'block';
                return;
            }
            if (emptyState) emptyState.style.display = 'none';
            if (table) table.style.display = 'table';
            const start = (inventoryState.currentPage - 1) * inventoryState.itemsPerPage;
            const pageProducts = products.slice(start, start + inventoryState.itemsPerPage);
            const categoryIcons = { tools: 'fa-tools', hardware: 'fa-cog', electrical: 'fa-bolt', plumbing: 'fa-wrench', paint: 'fa-paint-brush', garden: 'fa-leaf', building: 'fa-building', fasteners: 'fa-link', safety: 'fa-shield-alt' };
            tbody.innerHTML = pageProducts.map(product => {
                const status = getStockStatus(product.quantity, product.minStock);
                const sizeLabel = product.size ? `<span class="product-sku">Size: ${product.size}</span>` : '';
                return `<tr>
                    <td><div class="product-info"><div class="product-image"><i class="fas ${categoryIcons[product.category] || 'fa-box'}"></i></div><div class="product-details"><p class="product-name">${product.name}</p>${sizeLabel}<span class="product-sku">SKU: ${product.sku}</span></div></div></td>
                    <td>${product.category}</td><td>${formatCurrency(product.price)}</td>
                    <td><input type="number" class="quantity-input" value="${product.quantity}" min="0" data-product-id="${product.id}" onchange="updateQuantity(${product.id}, this.value)"></td>
                    <td>${getStockBadge(status)}</td><td>${product.lastUpdated}</td>
                    <td><div class="action-buttons"><button class="btn-icon edit" type="button" onclick="editProduct(${product.id})" title="Edit"><i class="fas fa-edit"></i></button><button class="btn-icon delete" type="button" onclick="showDeleteModal(${product.id})" title="Delete"><i class="fas fa-trash"></i></button></div></td>
                </tr>`;
            }).join('');
        }, 300);
    }

    function renderPagination() {
        const pagination = document.getElementById('inventoryPagination');
        if (!pagination) return;
        const totalPages = Math.ceil(inventoryState.filteredProducts.length / inventoryState.itemsPerPage);
        if (totalPages <= 1) { pagination.innerHTML = ''; return; }
        let html = `<button class="page-btn" type="button" onclick="changePage(${inventoryState.currentPage - 1})" ${inventoryState.currentPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
        for (let page = 1; page <= totalPages; page++) html += `<button class="page-btn ${inventoryState.currentPage === page ? 'active' : ''}" type="button" onclick="changePage(${page})">${page}</button>`;
        html += `<button class="page-btn" type="button" onclick="changePage(${inventoryState.currentPage + 1})" ${inventoryState.currentPage === totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
        pagination.innerHTML = html;
    }

    function openProductModal(productId = null) {
        inventoryState.editingProductId = productId;
        const modal = document.getElementById('productModal');
        const title = document.getElementById('productModalTitle');
        const form = document.getElementById('productForm');
        if (!modal || !title || !form) return;
        form.reset();
        if (productId) {
            const product = inventoryState.products.find(p => p.id === productId);
            if (product) {
                title.textContent = 'Edit Product';
                document.getElementById('productName').value = product.name;
                document.getElementById('productSKU').value = product.sku;
                document.getElementById('productCategory').value = product.category;
                document.getElementById('productPrice').value = product.price;
                document.getElementById('productQuantity').value = product.quantity;
                document.getElementById('productMinStock').value = product.minStock;
                document.getElementById('productSupplier').value = product.supplier || '';
                document.getElementById('productSize').value = product.size || '';
                document.getElementById('productDescription').value = product.description || '';
            }
        } else title.textContent = 'Add Product';
        modal.classList.add('active');
    }

    function closeProductModal() {
        document.getElementById('productModal')?.classList.remove('active');
        inventoryState.editingProductId = null;
    }

    async function saveProduct(event) {
        event.preventDefault();
        const productData = {
            name: document.getElementById('productName').value.trim(), sku: document.getElementById('productSKU').value.trim(), category: document.getElementById('productCategory').value,
            price: parseFloat(document.getElementById('productPrice').value), quantity: parseInt(document.getElementById('productQuantity').value), minStock: parseInt(document.getElementById('productMinStock').value),
            supplier: document.getElementById('productSupplier').value.trim(), size: normalizeSizes(document.getElementById('productSize').value), description: document.getElementById('productDescription').value.trim()
        };
        const skuExists = inventoryState.products.some(p => p.sku === productData.sku && p.id !== inventoryState.editingProductId);
        if (skuExists) { showToast('SKU already exists', 'error'); return; }
        const payload = { ...productData, min_stock: productData.minStock };
        delete payload.minStock;
        let result;
        if (inventoryState.editingProductId) {
            result = await supabaseApi.updateInventoryProduct(inventoryState.editingProductId, payload);
            const index = inventoryState.products.findIndex(p => p.id === inventoryState.editingProductId);
            if (!result.error && index !== -1) inventoryState.products[index] = mapProduct(result.data?.[0] || { ...inventoryState.products[index], ...productData });
            showToast(result.error ? result.error.message : 'Product updated successfully', result.error ? 'error' : 'success');
        } else {
            result = await supabaseApi.addInventoryProduct(payload);
            if (!result.error && result.data?.[0]) inventoryState.products.unshift(mapProduct(result.data[0]));
            showToast(result.error ? result.error.message : 'Product added successfully', result.error ? 'error' : 'success');
        }
        if (result.error) return;
        updateInventoryStats(); filterProducts(); closeProductModal();
        window.dispatchEvent(new CustomEvent('inventory-products-loaded', { detail: inventoryState.products }));
    }

    function closeDeleteModal() {
        document.getElementById('deleteModal')?.classList.remove('active');
        inventoryState.deletingProductId = null;
    }

    async function confirmDelete() {
        if (inventoryState.deletingProductId) {
            const result = await supabaseApi.deleteInventoryProduct(inventoryState.deletingProductId);
            if (result.error) {
                showToast(result.error.message, 'error');
                return;
            }
            inventoryState.products = inventoryState.products.filter(p => p.id !== inventoryState.deletingProductId);
            updateInventoryStats(); filterProducts();
            window.dispatchEvent(new CustomEvent('inventory-products-loaded', { detail: inventoryState.products }));
            showToast('Product deleted successfully', 'success');
        }
        closeDeleteModal();
    }

    function exportInventory() {
        if (!inventoryState.products.length) { showToast('No products to export', 'error'); return; }
        const headers = ['ID', 'Name', 'SKU', 'Category', 'Price', 'Quantity', 'Min Stock', 'Supplier', 'Size', 'Description', 'Last Updated'];
        const escapeCsv = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const rows = inventoryState.products.map(product => [product.id, product.name, product.sku, product.category, product.price, product.quantity, product.minStock, product.supplier, product.size || '', product.description, product.lastUpdated]);
        const blob = new Blob([[headers, ...rows].map(row => row.map(escapeCsv).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url; link.download = `inventory_${new Date().toISOString().split('T')[0]}.csv`; link.click(); URL.revokeObjectURL(url);
        showToast('Inventory exported successfully', 'success');
    }

    function setupInventoryEventListeners() {
        if (inventoryState.initialized) return;
        inventoryState.initialized = true;
        document.getElementById('addProductBtn')?.addEventListener('click', () => openProductModal());
        document.getElementById('exportInventoryBtn')?.addEventListener('click', exportInventory);
        document.getElementById('inventorySearch')?.addEventListener('input', event => { inventoryState.searchTerm = event.target.value; filterProducts(); });
        document.getElementById('categoryFilter')?.addEventListener('change', event => { inventoryState.categoryFilter = event.target.value; filterProducts(); });
        document.getElementById('stockFilter')?.addEventListener('change', event => { inventoryState.stockFilter = event.target.value; filterProducts(); });
        document.getElementById('closeProductModal')?.addEventListener('click', closeProductModal);
        document.getElementById('cancelProductBtn')?.addEventListener('click', closeProductModal);
        document.getElementById('productForm')?.addEventListener('submit', saveProduct);
        document.getElementById('closeDeleteModal')?.addEventListener('click', closeDeleteModal);
        document.getElementById('cancelDeleteBtn')?.addEventListener('click', closeDeleteModal);
        document.getElementById('confirmDeleteBtn')?.addEventListener('click', confirmDelete);
        window.addEventListener('click', event => {
            if (event.target === document.getElementById('productModal')) closeProductModal();
            if (event.target === document.getElementById('deleteModal')) closeDeleteModal();
        });
    }

    window.initInventory = function() {
        if (!supabaseApi?.isConfigured?.()) {
            inventoryState.products = [];
            showToast('Supabase is not configured', 'error');
            updateInventoryStats(); filterProducts(); setupInventoryEventListeners();
            return;
        }
        supabaseApi.getInventoryProducts().then(result => {
            if (result.error) {
                showToast(result.error.message, 'error');
                inventoryState.products = [];
            } else {
                inventoryState.products = (result.data || []).map(mapProduct);
                window.dispatchEvent(new CustomEvent('inventory-products-loaded', { detail: inventoryState.products }));
            }
            updateInventoryStats(); filterProducts(); setupInventoryEventListeners();
        });
        updateInventoryStats(); filterProducts(); setupInventoryEventListeners();
    };
    window.changePage = function(page) {
        const totalPages = Math.ceil(inventoryState.filteredProducts.length / inventoryState.itemsPerPage);
        if (page < 1 || page > totalPages) return;
        inventoryState.currentPage = page; renderInventoryTable(); renderPagination();
    };
    window.updateQuantity = function(productId, newQuantity) {
        const quantity = parseInt(newQuantity);
        if (Number.isNaN(quantity) || quantity < 0) return;
        const product = inventoryState.products.find(p => p.id === productId);
        if (!product) return;
        product.quantity = quantity; product.lastUpdated = new Date().toISOString().split('T')[0];
        supabaseApi.updateInventoryProduct(productId, { quantity }).then(result => {
            if (result.error) { showToast(result.error.message, 'error'); return; }
            product.lastUpdated = new Date().toISOString();
            updateInventoryStats(); filterProducts();
            window.dispatchEvent(new CustomEvent('inventory-products-loaded', { detail: inventoryState.products }));
            showToast('Quantity updated successfully', 'success');
        });
    };
    window.editProduct = openProductModal;
    window.showDeleteModal = function(productId) {
        inventoryState.deletingProductId = productId;
        const product = inventoryState.products.find(p => p.id === productId);
        const name = document.getElementById('deleteProductName');
        if (product && name) name.textContent = `${product.name} (${product.sku})`;
        document.getElementById('deleteModal')?.classList.add('active');
    };
})();
