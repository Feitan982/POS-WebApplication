window.POS_SUPABASE = (() => {
    const DEFAULT_CONFIG = {
        enabled: true,
        url: 'https://itsjyzlquevohkoqufmw.supabase.co',
        anonKey: 'sb_publishable_8877cuPp8cnywtpnR_HHeA_9_d0gxNA',
        tableName: 'profiles',
        inventoryTable: 'inventory'
    };

    const state = {
        config: { ...DEFAULT_CONFIG }
    };

    function isPlaceholder(value) {
        return !value || value.includes('your-project') || value.includes('your-anon-key') || value.includes('your-');
    }

    function normalizeConfig(customConfig = {}) {
        const merged = { ...DEFAULT_CONFIG, ...customConfig };
        return {
            ...merged,
            enabled: customConfig.enabled === undefined ? merged.enabled : Boolean(customConfig.enabled),
            ...(!isPlaceholder(merged.url) && !isPlaceholder(merged.anonKey) ? {} : { enabled: false })
        };
    }

    function setConfig(customConfig = {}) {
        state.config = normalizeConfig(customConfig);
        return state.config;
    }

    function getConfig() {
        return { ...state.config };
    }

    function getClient() {
        if (!window.supabase) {
            console.warn('Supabase SDK not loaded. Add the Supabase JS CDN before this script.');
            return null;
        }

        if (!state.config.enabled) {
            return null;
        }

        return window.supabase.createClient(state.config.url, state.config.anonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
    }

    function isConfigured() {
        return Boolean(getClient());
    }

    async function upsertProfile(profileData) {
        const client = getClient();
        if (!client) {
            return { data: null, error: new Error('Supabase is not configured.') };
        }

        return client.from(state.config.tableName).upsert(profileData, { onConflict: 'id' });
    }

    async function signUpUser({ fullName, email, password, role = 'cashier' }) {
        const client = getClient();
        if (!client) {
            return { data: null, error: new Error('Supabase is not configured.') };
        }

        const { data, error } = await client.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    role
                }
            }
        });

        if (error || !data?.user) {
            return { data, error };
        }

        const profileResult = await upsertProfile({
            id: data.user.id,
            email,
            full_name: fullName,
            role,
            created_at: new Date().toISOString()
        });

        if (profileResult.error) {
            console.warn('Supabase profile insert failed:', profileResult.error.message);
        }

        return { data, error: null };
    }

    async function signInUser({ email, password }) {
        const client = getClient();
        if (!client) {
            return { data: null, error: new Error('Supabase is not configured.') };
        }

        const result = await client.auth.signInWithPassword({ email, password });
        if (result.error || !result.data?.user) {
            return result;
        }

        const { data: profile, error: profileError } = await client
            .from(state.config.tableName)
            .select('role, full_name')
            .eq('id', result.data.user.id)
            .maybeSingle();

        if (profileError) {
            console.warn('Supabase profile lookup failed:', profileError.message);
            return result;
        }

        if (profile) {
            result.data.user.role = profile.role;
            result.data.user.user_metadata = {
                ...(result.data.user.user_metadata || {}),
                ...(profile.full_name ? { full_name: profile.full_name } : {}),
                ...(profile.role ? { role: profile.role } : {})
            };
        }

        return result;
    }

    async function signOut() {
        const client = getClient();
        if (!client) {
            return { error: new Error('Supabase is not configured.') };
        }

        return client.auth.signOut();
    }

    async function getUsers() {
        const client = getClient();
        if (!client) {
            return { data: [], error: new Error('Supabase is not configured.') };
        }

        return client.from(state.config.tableName).select('*');
    }

    // ==================== INVENTORY MANAGEMENT FUNCTIONS ====================

    async function getInventoryProducts() {
        const client = getClient();
        if (!client) {
            return { data: [], error: new Error('Supabase is not configured.') };
        }

        return client.from(state.config.inventoryTable).select('*').order('created_at', { ascending: false });
    }

    async function getInventoryProduct(productId) {
        const client = getClient();
        if (!client) {
            return { data: null, error: new Error('Supabase is not configured.') };
        }

        return client.from(state.config.inventoryTable).select('*').eq('id', productId).single();
    }

    async function addInventoryProduct(productData) {
        const client = getClient();
        if (!client) {
            return { data: null, error: new Error('Supabase is not configured.') };
        }

        const product = {
            ...productData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        return client.from(state.config.inventoryTable).insert(product).select();
    }

    async function updateInventoryProduct(productId, updates) {
        const client = getClient();
        if (!client) {
            return { data: null, error: new Error('Supabase is not configured.') };
        }

        const updateData = {
            ...updates,
            updated_at: new Date().toISOString()
        };

        return client.from(state.config.inventoryTable).update(updateData).eq('id', productId).select();
    }

    async function deleteInventoryProduct(productId) {
        const client = getClient();
        if (!client) {
            return { data: null, error: new Error('Supabase is not configured.') };
        }

        return client.from(state.config.inventoryTable).delete().eq('id', productId);
    }

    async function upsertInventoryProduct(productData) {
        const client = getClient();
        if (!client) {
            return { data: null, error: new Error('Supabase is not configured.') };
        }

        const product = {
            ...productData,
            updated_at: new Date().toISOString()
        };

        return client.from(state.config.inventoryTable).upsert(product, { onConflict: 'sku' });
    }

    async function searchInventoryProducts(searchTerm) {
        const client = getClient();
        if (!client) {
            return { data: [], error: new Error('Supabase is not configured.') };
        }

        return client.from(state.config.inventoryTable)
            .select('*')
            .or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%,supplier.ilike.%${searchTerm}%`);
    }

    async function filterInventoryByCategory(category) {
        const client = getClient();
        if (!client) {
            return { data: [], error: new Error('Supabase is not configured.') };
        }

        return client.from(state.config.inventoryTable).select('*').eq('category', category);
    }

    async function filterInventoryByStock(minQuantity, maxQuantity) {
        const client = getClient();
        if (!client) {
            return { data: [], error: new Error('Supabase is not configured.') };
        }

        let query = client.from(state.config.inventoryTable).select('*');
        
        if (minQuantity !== undefined) {
            query = query.gte('quantity', minQuantity);
        }
        if (maxQuantity !== undefined) {
            query = query.lte('quantity', maxQuantity);
        }
        
        return query;
    }

    async function getInventoryStats() {
        const client = getClient();
        if (!client) {
            return { data: null, error: new Error('Supabase is not configured.') };
        }

        const { data, error } = await client.from(state.config.inventoryTable).select('quantity, min_stock');
        
        if (error) {
            return { data: null, error };
        }

        const stats = {
            totalProducts: data.length,
            inStock: data.filter(p => p.quantity > p.min_stock).length,
            lowStock: data.filter(p => p.quantity > 0 && p.quantity <= p.min_stock).length,
            outOfStock: data.filter(p => p.quantity === 0).length,
            totalValue: data.reduce((sum, p) => sum + (p.quantity * (p.price || 0)), 0)
        };

        return { data: stats, error: null };
    }

    async function bulkUpdateInventory(products) {
        const client = getClient();
        if (!client) {
            return { data: null, error: new Error('Supabase is not configured.') };
        }

        const updates = products.map(p => ({
            ...p,
            updated_at: new Date().toISOString()
        }));

        return client.from(state.config.inventoryTable).upsert(updates, { onConflict: 'id' });
    }

    async function getInventoryCategories() {
        const client = getClient();
        if (!client) {
            return { data: [], error: new Error('Supabase is not configured.') };
        }

        return client.from(state.config.inventoryTable).select('category').order('category');
    }

    async function getLowStockProducts(threshold) {
        const client = getClient();
        if (!client) {
            return { data: [], error: new Error('Supabase is not configured.') };
        }

        return client.from(state.config.inventoryTable)
            .select('*')
            .lte('quantity', threshold)
            .gt('quantity', 0);
    }

    async function getOutOfStockProducts() {
        const client = getClient();
        if (!client) {
            return { data: [], error: new Error('Supabase is not configured.') };
        }

        return client.from(state.config.inventoryTable).select('*').eq('quantity', 0);
    }

    return {
        // Existing functions
        DEFAULT_CONFIG,
        config: state.config,
        setConfig,
        getConfig,
        getClient,
        isConfigured,
        signUpUser,
        signInUser,
        signOut,
        upsertProfile,
        getUsers,
        
        // New inventory functions
        getInventoryProducts,
        getInventoryProduct,
        addInventoryProduct,
        updateInventoryProduct,
        deleteInventoryProduct,
        upsertInventoryProduct,
        searchInventoryProducts,
        filterInventoryByCategory,
        filterInventoryByStock,
        getInventoryStats,
        bulkUpdateInventory,
        getInventoryCategories,
        getLowStockProducts,
        getOutOfStockProducts
    };
})();