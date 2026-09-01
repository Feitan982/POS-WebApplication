window.POS_SUPABASE = (() => {
    const DEFAULT_CONFIG = {
        enabled: false,
        url: 'https://your-project-ref.supabase.co',
        anonKey: 'your-anon-key',
        tableName: 'profiles'
    };

    function isPlaceholder(value) {
        return !value || value.includes('your-project') || value.includes('your-anon-key') || value.includes('your-');
    }

    function normalizeConfig(customConfig = {}) {
        const merged = { ...DEFAULT_CONFIG, ...customConfig };
        return {
            ...merged,
            enabled: Boolean(customConfig.enabled) && !isPlaceholder(merged.url) && !isPlaceholder(merged.anonKey)
        };
    }

    let config = normalizeConfig();

    function setConfig(customConfig = {}) {
        config = normalizeConfig(customConfig);
    }

    function getClient() {
        if (!window.supabase) {
            console.warn('Supabase SDK not loaded. Add the Supabase JS CDN before this script.');
            return null;
        }

        if (!config.enabled) {
            return null;
        }

        return window.supabase.createClient(config.url, config.anonKey, {
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

        return client.from(config.tableName).upsert(profileData, { onConflict: 'id' });
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

        return client.auth.signInWithPassword({ email, password });
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

        return client.from(config.tableName).select('*');
    }

    function getConfig() {
        return { ...config };
    }

    return {
        config,
        DEFAULT_CONFIG,
        setConfig,
        getConfig,
        getClient,
        isConfigured,
        signUpUser,
        signInUser,
        signOut,
        upsertProfile,
        getUsers
    };
})();
