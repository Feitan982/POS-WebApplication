(function() {
    const supabaseApi = window.POS_SUPABASE || {};

    // Example Supabase setup:
    // window.POS_SUPABASE.setConfig({
    //     enabled: true,
    //     url: 'https://your-project-ref.supabase.co',
    //     anonKey: 'your-anon-key',
    //     tableName: 'profiles'
    // });

    const authMode = {
        local: 'local',
        supabase: 'supabase'
    };

    function getAuthMode() {
        return isSupabaseReady() ? authMode.supabase : authMode.local;
    }

    function isSupabaseReady() {
        return !!(supabaseApi && typeof supabaseApi.isConfigured === 'function' && supabaseApi.isConfigured());
    }

    async function signInWithSupabase(email, password) {
        if (!isSupabaseReady()) {
            return { data: null, error: new Error('Supabase is not configured.') };
        }
        return supabaseApi.signInUser({ email, password });
    }

    async function signUpWithSupabase({ fullName, email, password, role }) {
        if (!isSupabaseReady()) {
            return { data: null, error: new Error('Supabase is not configured.') };
        }
        return supabaseApi.signUpUser({ fullName, email, password, role });
    }

    async function resetPasswordWithSupabase(email) {
        if (!isSupabaseReady()) {
            return { data: null, error: new Error('Supabase is not configured.') };
        }
        return supabaseApi.getClient().auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin || window.location.href
        });
    }

    async function signOutWithSupabase() {
        if (!isSupabaseReady()) {
            return { error: new Error('Supabase is not configured.') };
        }
        return supabaseApi.signOut();
    }

    async function getCurrentUser() {
        if (!isSupabaseReady()) {
            return { user: null, error: new Error('Supabase is not configured.') };
        }
        const client = supabaseApi.getClient();
        const { data: { user } } = await client.auth.getUser();
        return { user, error: null };
    }

    // ---------- RESPONSIVE DETECTION ----------
    const isMobile = () => window.innerWidth < 768;
    const isTablet = () => window.innerWidth >= 768 && window.innerWidth < 1024;
    const isDesktop = () => window.innerWidth >= 1024;
    
    // Disable animations on mobile for better performance
    if (isMobile()) {
        const style = document.createElement('style');
        style.textContent = `
            * { animation-duration: 0.1s !important; }
            .bg-glow, .geo-shape { animation-duration: 0.1s !important; }
        `;
        document.head.appendChild(style);
    }

    // ---------- USER DATABASE (localStorage) ----------
    const USERS_KEY = 'pos_users_pro_v2';
    const ADMIN_CREATED_KEY = 'pos_admin_account_created';
    
    function getUsers() {
        try {
            const stored = localStorage.getItem(USERS_KEY);
            if (stored) {
                const users = JSON.parse(stored);
                return Array.isArray(users) ? users : [];
            }
        } catch (e) {
            console.error('Error reading users:', e);
        }
        return [];
    }

    function saveUsers(users) {
        try {
            localStorage.setItem(USERS_KEY, JSON.stringify(users));
        } catch (e) {
            console.error('Error saving users:', e);
        }
    }

    function hasAdminAccount() {
        return getUsers().some(u => u.role === 'admin') || localStorage.getItem(ADMIN_CREATED_KEY) === 'true';
    }

    async function refreshAdminAvailability() {
        if (!isSupabaseReady()) return;

        const { data, error } = await supabaseApi.getUsers();
        if (error) {
            console.warn('Unable to check existing admin accounts:', error.message);
            return;
        }

        if (Array.isArray(data) && data.some(user => user.role === 'admin')) {
            localStorage.setItem(ADMIN_CREATED_KEY, 'true');
            updateSignupRoleAvailability();
        }
    }

    function findUserByEmail(email) {
        return getUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
    }

    function addUser(user) {
        const users = getUsers();
        users.push(user);
        saveUsers(users);
    }

    // ---------- DOM ELEMENTS ----------
    const signinView = document.getElementById('signinView');
    const signupView = document.getElementById('signupView');
    const forgotView = document.getElementById('forgotView');
    const signinForm = document.getElementById('signinForm');
    const signupForm = document.getElementById('signupForm');
    const forgotForm = document.getElementById('forgotForm');
    const signupRoleSelect = document.getElementById('signupRole');
    const adminRoleOption = document.getElementById('adminRoleOption');
    const signupRoleInfo = document.getElementById('signupRoleInfo');
    const roleAvailabilityAlert = document.getElementById('roleAvailabilityAlert');
    const roleAvailabilityText = document.getElementById('roleAvailabilityText');
    const accountStatusText = document.getElementById('accountStatusText');
    const loginContainer = document.getElementById('loginContainer');
    const dashboardContainer = document.getElementById('dashboardContainer');
    const userDisplayName = document.getElementById('userDisplayName');
    const dashboardUserName = document.getElementById('dashboardUserName');
    const userDropdownBtn = document.getElementById('userDropdownBtn');
    const userDropdownMenu = document.getElementById('userDropdownMenu');
    const logoutBtn = document.getElementById('logoutBtn');
    const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
    const mobileToggle = document.getElementById('mobileToggle');
    const sidebar = document.getElementById('sidebar');
    const emailConfirmationModal = document.getElementById('emailConfirmationModal');
    const emailConfirmationAddress = document.getElementById('emailConfirmationAddress');
    const emailConfirmationClose = document.getElementById('emailConfirmationClose');
    const emailConfirmationContinue = document.getElementById('emailConfirmationContinue');
    
    let selectedRole = 'admin';
    let currentUser = null;

    function showEmailConfirmationModal(email) {
        if (!emailConfirmationModal) return;
        if (emailConfirmationAddress) emailConfirmationAddress.textContent = email;
        emailConfirmationModal.hidden = false;
        emailConfirmationClose?.focus();
    }

    function closeEmailConfirmationModal() {
        if (emailConfirmationModal) emailConfirmationModal.hidden = true;
    }

    emailConfirmationClose?.addEventListener('click', closeEmailConfirmationModal);
    emailConfirmationContinue?.addEventListener('click', closeEmailConfirmationModal);
    emailConfirmationModal?.addEventListener('click', (event) => {
        if (event.target === emailConfirmationModal) closeEmailConfirmationModal();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && emailConfirmationModal && !emailConfirmationModal.hidden) {
            closeEmailConfirmationModal();
        }
    });

    // ---------- TOAST ----------
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
        
        // Auto-remove toast
        const toastTimeout = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(20px)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
        
        // Allow manual dismissal
        toast.style.cursor = 'pointer';
        toast.addEventListener('click', () => {
            clearTimeout(toastTimeout);
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(20px)';
            setTimeout(() => toast.remove(), 300);
        });
    }

    // ---------- DASHBOARD FUNCTIONS ----------
    function loadDashboard(user) {
        // Hide login, show dashboard
        loginContainer.style.display = 'none';
        dashboardContainer.style.display = 'flex';
        
        // Set user name
        const name = user?.user_metadata?.full_name || 
                     user?.email?.split('@')[0] || 
                     'User';
        currentUser = user;
        
        if (userDisplayName) userDisplayName.textContent = name;
        if (dashboardUserName) dashboardUserName.textContent = name;
        
        // Update user dropdown avatar
        const avatar = userDropdownBtn?.querySelector('img');
        if (avatar) {
            avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4F46E5&color=fff`;
        }
        
        // Update account status
        if (accountStatusText) {
            accountStatusText.textContent = `Logged in as ${name}`;
        }
        
        showToast(`Welcome, ${name}!`, 'success');
    }

    function showLoginView() {
        loginContainer.style.display = 'flex';
        dashboardContainer.style.display = 'none';
        currentUser = null;
        showView(signinView);
        updateSystemStatus();
    }

    // ---------- UPDATE SYSTEM STATUS ----------
    function updateSystemStatus() {
        if (!accountStatusText) return;
        
        if (isSupabaseReady()) {
            accountStatusText.textContent = 'Supabase connected ✓';
            return;
        }
        
        const hasAdmin = hasAdminAccount();
        const users = getUsers();
        const hasCashier = users.some(u => u.role === 'cashier');
        
        if (hasAdmin && hasCashier) {
            accountStatusText.textContent = 'System ready: Admin & Cashier available';
        } else if (hasAdmin && !hasCashier) {
            accountStatusText.textContent = 'Admin exists — Cashier registration open';
        } else if (!hasAdmin && hasCashier) {
            accountStatusText.textContent = 'Cashier exists — Admin registration required';
        } else {
            accountStatusText.textContent = 'No accounts yet — Create Admin first';
        }
        
        updateSignupRoleAvailability();
    }

    // ---------- UPDATE SIGNUP ROLE ----------
    function updateSignupRoleAvailability() {
        if (!signupRoleSelect) return;
        
        const hasAdmin = hasAdminAccount();
        
        if (hasAdmin) {
            adminRoleOption.disabled = true;
            adminRoleOption.textContent = 'Admin (already exists)';
            signupRoleSelect.value = 'cashier';
            if (signupRoleInfo) {
                signupRoleInfo.textContent = 'Admin already registered. You can only create a Cashier.';
            }
            if (roleAvailabilityAlert) {
                roleAvailabilityAlert.style.display = 'flex';
                roleAvailabilityAlert.className = 'alert-box warning';
                roleAvailabilityText.textContent = 'Admin exists — new accounts must be Cashier.';
            }
        } else {
            adminRoleOption.disabled = false;
            adminRoleOption.textContent = 'Admin';
            signupRoleSelect.value = 'admin';
            if (signupRoleInfo) {
                signupRoleInfo.textContent = 'No admin yet. Create an Admin account first.';
            }
            if (roleAvailabilityAlert) {
                roleAvailabilityAlert.style.display = 'flex';
                roleAvailabilityAlert.className = 'alert-box info';
                roleAvailabilityText.textContent = 'First account must be Admin — subsequent accounts will be Cashier.';
            }
        }
    }

    // ---------- SHOW VIEW ----------
    function showView(view) {
        if (signinView) signinView.style.display = 'none';
        if (signupView) signupView.style.display = 'none';
        if (forgotView) forgotView.style.display = 'none';
        if (view) view.style.display = 'block';
        
        // Scroll to top on mobile
        if (isMobile()) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        
        if (view === signupView) {
            updateSignupRoleAvailability();
        }
    }

    // ---------- PASSWORD TOGGLE ----------
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = btn.dataset.target;
            const input = document.getElementById(targetId);
            if (input) {
                if (input.type === 'password') {
                    input.type = 'text';
                    btn.innerHTML = '<i class="fas fa-eye-slash"></i>';
                } else {
                    input.type = 'password';
                    btn.innerHTML = '<i class="fas fa-eye"></i>';
                }
            }
        });
    });

    // ---------- PREVENT ZOOM ON INPUT FOCUS (Mobile) ----------
    if (isMobile()) {
        document.querySelectorAll('input, select, textarea').forEach(el => {
            el.addEventListener('focus', function() {
                this.style.fontSize = '16px';
            });
        });
    }

    // ---------- FORM SWITCHING ----------
    const createAccountBtn = document.getElementById('createAccountBtn');
    const backToSignin = document.getElementById('backToSignin');
    const forgotLink = document.getElementById('forgotLink');
    const backToSigninFromForgot = document.getElementById('backToSigninFromForgot');

    if (createAccountBtn) {
        createAccountBtn.addEventListener('click', () => {
            showView(signupView);
            setTimeout(() => {
                const el = document.getElementById('signupFullName');
                if (el) el.focus();
            }, 100);
        });
    }
    
    if (backToSignin) {
        backToSignin.addEventListener('click', () => {
            showView(signinView);
            updateSystemStatus();
        });
    }
    
    if (forgotLink) {
        forgotLink.addEventListener('click', () => {
            showView(forgotView);
            setTimeout(() => {
                const el = document.getElementById('forgotEmail');
                if (el) el.focus();
            }, 100);
        });
    }
    
    if (backToSigninFromForgot) {
        backToSigninFromForgot.addEventListener('click', () => {
            showView(signinView);
            updateSystemStatus();
        });
    }

    // ---------- VALIDATION ----------
    function validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
    
    function setError(id, msg) {
        const errorEl = document.getElementById(id);
        if (errorEl) {
            errorEl.textContent = msg;
            if (isMobile() && msg) {
                errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }
    
    function clearErrors() {
        document.querySelectorAll('.error-message, .info-message').forEach(el => el.textContent = '');
    }

    // ---------- SIGN IN ----------
    if (signinForm) {
        signinForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearErrors();
            const email = document.getElementById('signinEmail')?.value.trim() || '';
            const password = document.getElementById('signinPassword')?.value || '';
            let valid = true;

            if (!email) { setError('signinEmailError', 'Email is required'); valid = false; }
            else if (!validateEmail(email)) { setError('signinEmailError', 'Invalid email format'); valid = false; }
            if (!password) { setError('signinPasswordError', 'Password is required'); valid = false; }
            else if (password.length < 6) { setError('signinPasswordError', 'Minimum 6 characters'); valid = false; }

            if (!valid) return;

            const btn = document.getElementById('signinSubmitBtn');
            if (btn) {
                btn.classList.add('loading');
                btn.disabled = true;
            }

            try {
                if (getAuthMode() === authMode.supabase) {
                    const { data, error } = await signInWithSupabase(email, password);
                    if (error) throw error;
                    
                    if (data?.user) {
                        loadDashboard(data.user);
                        // Close dropdown if open
                        if (userDropdownMenu) userDropdownMenu.classList.remove('show');
                    }
                    return;
                }

                // Local mode
                await new Promise(r => setTimeout(r, 800));
                const user = findUserByEmail(email);
                if (user && user.password === password) {
                    showToast(`Welcome back, ${user.name}!`, 'success');
                    // For local mode, create a fake user object
                    loadDashboard({
                        email: user.email,
                        user_metadata: { full_name: user.name }
                    });
                } else if (user) {
                    showToast('Incorrect password.', 'error');
                } else {
                    showToast('No account found with this email.', 'error');
                }
            } catch (error) {
                const message = error?.message || 'Unable to sign in.';
                showToast(message, 'error');
            } finally {
                if (btn) {
                    btn.classList.remove('loading');
                    btn.disabled = false;
                }
            }
        });
    }

    // ---------- SIGN UP ----------
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearErrors();
            const name = document.getElementById('signupFullName')?.value.trim() || '';
            const email = document.getElementById('signupEmail')?.value.trim() || '';
            const role = document.getElementById('signupRole')?.value || 'cashier';
            const password = document.getElementById('signupPassword')?.value || '';
            const confirm = document.getElementById('signupConfirmPassword')?.value || '';
            const agree = document.getElementById('agreeTerms')?.checked || false;
            let valid = true;

            if (!name) { setError('signupFullNameError', 'Your name is required'); valid = false; }
            else if (name.length < 2) { setError('signupFullNameError', 'Minimum 2 characters'); valid = false; }
            if (!email) { setError('signupEmailError', 'Email is required'); valid = false; }
            else if (!validateEmail(email)) { setError('signupEmailError', 'Invalid email format'); valid = false; }
            else if (!isSupabaseReady() && findUserByEmail(email)) { 
                setError('signupEmailError', 'Email already registered'); valid = false; 
            }
            if (!password) { setError('signupPasswordError', 'Password is required'); valid = false; }
            else if (password.length < 6) { setError('signupPasswordError', 'Minimum 6 characters'); valid = false; }
            if (password !== confirm) { setError('signupConfirmPasswordError', 'Passwords do not match'); valid = false; }
            if (!agree) { setError('termsError', 'You must agree to terms'); valid = false; }

            if (!valid) return;

            const btn = document.getElementById('signupSubmitBtn');
            if (btn) {
                btn.classList.add('loading');
                btn.disabled = true;
            }

            try {
                if (getAuthMode() === authMode.supabase) {
                    const { data, error } = await signUpWithSupabase({ fullName: name, email, password, role });
                    if (error) throw error;

                    const signinEmail = document.getElementById('signinEmail');
                    const signinPassword = document.getElementById('signinPassword');
                    if (signinEmail) signinEmail.value = email;
                    if (signinPassword) signinPassword.value = '';
                    showView(signinView);
                    selectedRole = role;
                    if (role === 'admin') {
                        localStorage.setItem(ADMIN_CREATED_KEY, 'true');
                        updateSignupRoleAvailability();
                    }
                    if (data?.session) {
                        showToast(`Account created for ${name} (${role})! Please sign in.`, 'success');
                    } else {
                        showEmailConfirmationModal(email);
                    }
                    return;
                }

                // Local mode
                await new Promise(r => setTimeout(r, 800));
                addUser({ name, email, password, role });
                updateSystemStatus();
                showToast(`Account created for ${name} (${role})!`, 'success');
                const signinEmail = document.getElementById('signinEmail');
                const signinPassword = document.getElementById('signinPassword');
                if (signinEmail) signinEmail.value = email;
                if (signinPassword) signinPassword.value = '';
                showView(signinView);
                selectedRole = role;
            } catch (error) {
                const message = error?.message || 'Unable to create account.';
                showToast(message, 'error');
            } finally {
                if (btn) {
                    btn.classList.remove('loading');
                    btn.disabled = false;
                }
            }
        });
    }

    // ---------- FORGOT PASSWORD ----------
    if (forgotForm) {
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearErrors();
            const email = document.getElementById('forgotEmail')?.value.trim() || '';
            let valid = true;

            if (!email) { setError('forgotEmailError', 'Email is required'); valid = false; }
            else if (!validateEmail(email)) { setError('forgotEmailError', 'Invalid email format'); valid = false; }

            if (!valid) return;

            const btn = document.getElementById('forgotSubmitBtn');
            if (btn) {
                btn.classList.add('loading');
                btn.disabled = true;
            }

            try {
                if (getAuthMode() === authMode.supabase) {
                    const { error } = await resetPasswordWithSupabase(email);
                    if (error) throw error;

                    const infoBox = document.getElementById('forgotInfoBox');
                    const infoText = document.getElementById('forgotInfoText');
                    if (infoBox) {
                        infoBox.style.display = 'flex';
                        infoBox.className = 'alert-box success';
                    }
                    if (infoText) {
                        infoText.textContent = `Reset link sent to ${email}. Check your inbox.`;
                    }
                    showToast('Password reset link sent!', 'success');
                    return;
                }

                // Local mode
                await new Promise(r => setTimeout(r, 800));
                const user = findUserByEmail(email);
                const infoBox = document.getElementById('forgotInfoBox');
                const infoText = document.getElementById('forgotInfoText');

                if (infoBox) {
                    infoBox.style.display = 'flex';
                    infoBox.className = user ? 'alert-box success' : 'alert-box error';
                }
                if (infoText) {
                    infoText.textContent = user 
                        ? `Reset link sent to ${user.email}. Check your inbox.`
                        : `No account found with ${email}.`;
                }
                showToast(user ? 'Password reset link sent!' : 'No account found with this email', 
                         user ? 'success' : 'error');
            } catch (error) {
                const infoBox = document.getElementById('forgotInfoBox');
                const infoText = document.getElementById('forgotInfoText');
                if (infoBox) {
                    infoBox.style.display = 'flex';
                    infoBox.className = 'alert-box error';
                }
                if (infoText) {
                    infoText.textContent = error?.message || 'Unable to reset password.';
                }
                showToast(error?.message || 'Unable to reset password.', 'error');
            } finally {
                if (btn) {
                    btn.classList.remove('loading');
                    btn.disabled = false;
                }
            }
        });
    }

    // ---------- LOGOUT ----------
    async function logout() {
        try {
            if (getAuthMode() === authMode.supabase) {
                const { error } = await signOutWithSupabase();
                if (error) throw error;
            }
            
            showLoginView();
            showToast('Logged out successfully', 'success');
            
            // Close dropdown
            if (userDropdownMenu) userDropdownMenu.classList.remove('show');
        } catch (error) {
            showToast(error?.message || 'Error logging out', 'error');
        }
    }

    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    if (sidebarLogoutBtn) sidebarLogoutBtn.addEventListener('click', logout);

    // ---------- USER DROPDOWN TOGGLE ----------
    if (userDropdownBtn) {
        userDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (userDropdownMenu) userDropdownMenu.classList.toggle('show');
        });
    }

    document.addEventListener('click', () => {
        if (userDropdownMenu) userDropdownMenu.classList.remove('show');
    });

    // ---------- MOBILE SIDEBAR TOGGLE ----------
    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            if (sidebar) sidebar.classList.toggle('open');
        });
    }

    // ---------- SIDEBAR NAVIGATION ----------
    document.querySelectorAll('.sidebar-link[data-page]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active from all
            document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            // Show corresponding page
            const page = this.dataset.page;
            document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
            const target = document.getElementById(`page-${page}`);
            if (target) target.classList.add('active');
            
            // Initialize inventory if navigating to inventory page
            if (page === 'inventory') {
                initInventory();
            }
            
            // Close mobile sidebar
            if (sidebar) sidebar.classList.remove('open');
        });
    });

    // ---------- NAVIGATION FUNCTION ----------
    window.navigateToPage = function(page) {
        document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
        const sidebarLink = document.querySelector(`.sidebar-link[data-page="${page}"]`);
        if (sidebarLink) sidebarLink.classList.add('active');
        
        document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
        const target = document.getElementById(`page-${page}`);
        if (target) target.classList.add('active');
        
        if (page === 'inventory') {
            initInventory();
        }
    };

    // ---------- ROLE CHANGE ----------
    if (signupRoleSelect) {
        signupRoleSelect.addEventListener('change', function() {
            if (roleAvailabilityAlert) {
                roleAvailabilityAlert.style.display = 'flex';
                if (this.value === 'admin') {
                    roleAvailabilityAlert.className = 'alert-box info';
                    if (roleAvailabilityText) {
                        roleAvailabilityText.textContent = 'Admin accounts have full access to all system features.';
                    }
                } else {
                    roleAvailabilityAlert.className = 'alert-box info';
                    if (roleAvailabilityText) {
                        roleAvailabilityText.textContent = 'Cashier accounts have limited access to sales features.';
                    }
                }
            }
        });
    }

    // ==================== INVENTORY MANAGEMENT ====================
    
    // Inventory State
    let inventoryState = {
        products: [],
        filteredProducts: [],
        currentPage: 1,
        itemsPerPage: 10,
        searchTerm: '',
        categoryFilter: '',
        stockFilter: '',
        editingProductId: null,
        deletingProductId: null
    };

    // Sample inventory data
    const sampleProducts = [
        {
            id: 1,
            name: 'Power Drill',
            sku: 'PRD-001',
            category: 'tools',
            price: 89.99,
            quantity: 25,
            minStock: 10,
            supplier: 'ToolMaster Inc.',
            location: 'Aisle 1, Shelf A',
            description: 'Professional power drill with variable speed',
            lastUpdated: '2026-09-01'
        },
        {
            id: 2,
            name: 'Hammer',
            sku: 'PRD-002',
            category: 'tools',
            price: 15.99,
            quantity: 50,
            minStock: 20,
            supplier: 'Hardware Supply Co.',
            location: 'Aisle 1, Shelf B',
            description: '16 oz claw hammer with fiberglass handle',
            lastUpdated: '2026-08-28'
        },
        {
            id: 3,
            name: 'Screwdriver Set',
            sku: 'PRD-003',
            category: 'tools',
            price: 24.99,
            quantity: 8,
            minStock: 15,
            supplier: 'ToolMaster Inc.',
            location: 'Aisle 2, Shelf A',
            description: '6-piece screwdriver set with magnetic tips',
            lastUpdated: '2026-09-02'
        },
        {
            id: 4,
            name: 'Paint Brush Set',
            sku: 'PRD-004',
            category: 'paint',
            price: 12.99,
            quantity: 0,
            minStock: 10,
            supplier: 'PaintPro Supplies',
            location: 'Aisle 5, Shelf C',
            description: '5-piece paint brush set for all paint types',
            lastUpdated: '2026-08-25'
        },
        {
            id: 5,
            name: 'Safety Goggles',
            sku: 'PRD-005',
            category: 'safety',
            price: 8.99,
            quantity: 75,
            minStock: 30,
            supplier: 'SafetyFirst Gear',
            location: 'Aisle 3, Shelf D',
            description: 'Anti-fog safety goggles with UV protection',
            lastUpdated: '2026-08-30'
        }
    ];

    // Initialize Inventory
    function initInventory() {
        // Load products from localStorage or use sample data
        const savedProducts = localStorage.getItem('inventoryProducts');
        if (savedProducts) {
            inventoryState.products = JSON.parse(savedProducts);
        } else {
            inventoryState.products = [...sampleProducts];
            saveProducts();
        }
        
        updateInventoryStats();
        filterProducts();
        setupInventoryEventListeners();
    }

    // Save products to localStorage
    function saveProducts() {
        localStorage.setItem('inventoryProducts', JSON.stringify(inventoryState.products));
    }

    // Update inventory statistics
    function updateInventoryStats() {
        const totalProductsEl = document.getElementById('totalProducts');
        const inStockProductsEl = document.getElementById('inStockProducts');
        const lowStockProductsEl = document.getElementById('lowStockProducts');
        const outOfStockProductsEl = document.getElementById('outOfStockProducts');
        
        if (!totalProductsEl) return;
        
        const total = inventoryState.products.length;
        const inStock = inventoryState.products.filter(p => p.quantity > p.minStock).length;
        const lowStock = inventoryState.products.filter(p => p.quantity > 0 && p.quantity <= p.minStock).length;
        const outOfStock = inventoryState.products.filter(p => p.quantity === 0).length;
        
        totalProductsEl.textContent = total;
        inStockProductsEl.textContent = inStock;
        lowStockProductsEl.textContent = lowStock;
        outOfStockProductsEl.textContent = outOfStock;
    }

    // Get stock status
    function getStockStatus(quantity, minStock) {
        if (quantity === 0) return 'out_of_stock';
        if (quantity <= minStock) return 'low_stock';
        if (quantity > minStock * 2) return 'over_stock';
        return 'in_stock';
    }

    // Get stock badge HTML
    function getStockBadge(status) {
        const badges = {
            'in_stock': '<span class="stock-badge in-stock"><i class="fas fa-check-circle"></i> In Stock</span>',
            'low_stock': '<span class="stock-badge low-stock"><i class="fas fa-exclamation-triangle"></i> Low Stock</span>',
            'out_of_stock': '<span class="stock-badge out-of-stock"><i class="fas fa-times-circle"></i> Out of Stock</span>',
            'over_stock': '<span class="stock-badge over-stock"><i class="fas fa-arrow-up"></i> Over Stocked</span>'
        };
        return badges[status] || badges.in_stock;
    }

    // Filter products based on search and filters
    function filterProducts() {
        const { searchTerm, categoryFilter, stockFilter } = inventoryState;
        
        inventoryState.filteredProducts = inventoryState.products.filter(product => {
            // Search filter
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                const matchesSearch = 
                    product.name.toLowerCase().includes(searchLower) ||
                    product.sku.toLowerCase().includes(searchLower) ||
                    (product.supplier && product.supplier.toLowerCase().includes(searchLower));
                if (!matchesSearch) return false;
            }
            
            // Category filter
            if (categoryFilter && product.category !== categoryFilter) {
                return false;
            }
            
            // Stock filter
            if (stockFilter) {
                const status = getStockStatus(product.quantity, product.minStock);
                if (status !== stockFilter) return false;
            }
            
            return true;
        });
        
        inventoryState.currentPage = 1;
        renderInventoryTable();
        renderPagination();
    }

    // Render inventory table
    function renderInventoryTable() {
        const tbody = document.getElementById('inventoryTableBody');
        const table = document.getElementById('inventoryTable');
        const emptyState = document.getElementById('inventoryEmpty');
        const loadingSpinner = document.getElementById('inventoryLoading');
        
        if (!tbody) return;
        
        // Show loading spinner
        if (loadingSpinner) loadingSpinner.style.display = 'block';
        if (table) table.style.display = 'none';
        
        setTimeout(() => {
            if (loadingSpinner) loadingSpinner.style.display = 'none';
            
            if (inventoryState.filteredProducts.length === 0) {
                if (table) table.style.display = 'none';
                if (emptyState) emptyState.style.display = 'block';
                return;
            }
            
            if (emptyState) emptyState.style.display = 'none';
            if (table) table.style.display = 'table';
            
            // Calculate pagination
            const startIndex = (inventoryState.currentPage - 1) * inventoryState.itemsPerPage;
            const endIndex = Math.min(startIndex + inventoryState.itemsPerPage, inventoryState.filteredProducts.length);
            const pageProducts = inventoryState.filteredProducts.slice(startIndex, endIndex);
            
            const categoryIcons = {
                'tools': '🔧',
                'hardware': '🔩',
                'electrical': '⚡',
                'plumbing': '🔧',
                'paint': '🎨',
                'garden': '🌿',
                'building': '🏗️',
                'fasteners': '🔗',
                'safety': '🛡️'
            };
            
            tbody.innerHTML = pageProducts.map(product => {
                const status = getStockStatus(product.quantity, product.minStock);
                
                return `
                    <tr>
                        <td>
                            <div class="product-info">
                                <div class="product-image">${categoryIcons[product.category] || '📦'}</div>
                                <div class="product-details">
                                    <p class="product-name">${product.name}</p>
                                    <span class="product-sku">SKU: ${product.sku}</span>
                                </div>
                            </div>
                        </td>
                        <td>${product.category}</td>
                        <td>$${product.price.toFixed(2)}</td>
                        <td>
                            <input type="number" 
                                   class="quantity-input" 
                                   value="${product.quantity}" 
                                   min="0"
                                   data-product-id="${product.id}"
                                   onchange="updateQuantity(${product.id}, this.value)">
                        </td>
                        <td>${getStockBadge(status)}</td>
                        <td>${product.lastUpdated}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn-icon edit" onclick="editProduct(${product.id})" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn-icon delete" onclick="showDeleteModal(${product.id})" title="Delete">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }, 300);
    }

    // Render pagination
    function renderPagination() {
        const pagination = document.getElementById('inventoryPagination');
        if (!pagination) return;
        
        const totalPages = Math.ceil(inventoryState.filteredProducts.length / inventoryState.itemsPerPage);
        
        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }
        
        let paginationHTML = `
            <button class="page-btn" onclick="changePage(${inventoryState.currentPage - 1})" 
                    ${inventoryState.currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
        for (let i = 1; i <= totalPages; i++) {
            paginationHTML += `
                <button class="page-btn ${inventoryState.currentPage === i ? 'active' : ''}" 
                        onclick="changePage(${i})">
                    ${i}
                </button>
            `;
        }
        
        paginationHTML += `
            <button class="page-btn" onclick="changePage(${inventoryState.currentPage + 1})" 
                    ${inventoryState.currentPage === totalPages ? 'disabled' : ''}>
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        pagination.innerHTML = paginationHTML;
    }

    // Expose functions to global scope for onclick handlers
    window.changePage = function(page) {
        const totalPages = Math.ceil(inventoryState.filteredProducts.length / inventoryState.itemsPerPage);
        if (page < 1 || page > totalPages) return;
        inventoryState.currentPage = page;
        renderInventoryTable();
        renderPagination();
    };

    window.updateQuantity = function(productId, newQuantity) {
        const quantity = parseInt(newQuantity);
        if (quantity < 0 || isNaN(quantity)) return;
        
        const product = inventoryState.products.find(p => p.id === productId);
        if (product) {
            product.quantity = quantity;
            product.lastUpdated = new Date().toISOString().split('T')[0];
            saveProducts();
            updateInventoryStats();
            filterProducts();
            showToast('Quantity updated successfully', 'success');
        }
    };

    window.editProduct = function(productId) {
        openProductModal(productId);
    };

    window.showDeleteModal = function(productId) {
        inventoryState.deletingProductId = productId;
        const product = inventoryState.products.find(p => p.id === productId);
        if (product) {
            const deleteProductName = document.getElementById('deleteProductName');
            if (deleteProductName) deleteProductName.textContent = `${product.name} (${product.sku})`;
        }
        const deleteModal = document.getElementById('deleteModal');
        if (deleteModal) deleteModal.classList.add('active');
    };

    // Setup inventory event listeners
    function setupInventoryEventListeners() {
        // Add Product Button
        const addProductBtn = document.getElementById('addProductBtn');
        if (addProductBtn) {
            addProductBtn.onclick = function() {
                openProductModal(null);
            };
        }
        
        // Export Button
        const exportBtn = document.getElementById('exportInventoryBtn');
        if (exportBtn) {
            exportBtn.onclick = function() {
                exportInventory();
            };
        }
        
        // Search Input
        const searchInput = document.getElementById('inventorySearch');
        if (searchInput) {
            searchInput.oninput = function() {
                inventoryState.searchTerm = this.value;
                filterProducts();
            };
        }
        
        // Category Filter
        const categoryFilter = document.getElementById('categoryFilter');
        if (categoryFilter) {
            categoryFilter.onchange = function() {
                inventoryState.categoryFilter = this.value;
                filterProducts();
            };
        }
        
        // Stock Filter
        const stockFilter = document.getElementById('stockFilter');
        if (stockFilter) {
            stockFilter.onchange = function() {
                inventoryState.stockFilter = this.value;
                filterProducts();
            };
        }
        
        // Product Modal
        const closeProductModalBtn = document.getElementById('closeProductModal');
        if (closeProductModalBtn) {
            closeProductModalBtn.onclick = closeProductModal;
        }
        
        const cancelProductBtn = document.getElementById('cancelProductBtn');
        if (cancelProductBtn) {
            cancelProductBtn.onclick = closeProductModal;
        }
        
        const productForm = document.getElementById('productForm');
        if (productForm) {
            productForm.onsubmit = saveProduct;
        }
        
        // Delete Modal
        const closeDeleteModalBtn = document.getElementById('closeDeleteModal');
        if (closeDeleteModalBtn) {
            closeDeleteModalBtn.onclick = closeDeleteModal;
        }
        
        const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
        if (cancelDeleteBtn) {
            cancelDeleteBtn.onclick = closeDeleteModal;
        }
        
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        if (confirmDeleteBtn) {
            confirmDeleteBtn.onclick = confirmDelete;
        }
        
        // Close modals on outside click
        window.onclick = function(event) {
            const productModal = document.getElementById('productModal');
            const deleteModal = document.getElementById('deleteModal');
            if (event.target === productModal) {
                closeProductModal();
            }
            if (event.target === deleteModal) {
                closeDeleteModal();
            }
        };
    }

    // Open product modal
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
                document.getElementById('productLocation').value = product.location || '';
                document.getElementById('productDescription').value = product.description || '';
            }
        } else {
            title.textContent = 'Add Product';
        }
        
        modal.classList.add('active');
    }

    // Close product modal
    function closeProductModal() {
        const modal = document.getElementById('productModal');
        if (modal) modal.classList.remove('active');
        inventoryState.editingProductId = null;
    }

    // Save product
    function saveProduct(event) {
        event.preventDefault();
        
        const productData = {
            name: document.getElementById('productName').value.trim(),
            sku: document.getElementById('productSKU').value.trim(),
            category: document.getElementById('productCategory').value,
            price: parseFloat(document.getElementById('productPrice').value),
            quantity: parseInt(document.getElementById('productQuantity').value),
            minStock: parseInt(document.getElementById('productMinStock').value),
            supplier: document.getElementById('productSupplier').value.trim(),
            location: document.getElementById('productLocation').value.trim(),
            description: document.getElementById('productDescription').value.trim()
        };
        
        // Validate SKU uniqueness
        const skuExists = inventoryState.products.some(p => 
            p.sku === productData.sku && p.id !== inventoryState.editingProductId
        );
        
        if (skuExists) {
            showToast('SKU already exists', 'error');
            return;
        }
        
        if (inventoryState.editingProductId) {
            // Update existing product
            const index = inventoryState.products.findIndex(p => p.id === inventoryState.editingProductId);
            if (index !== -1) {
                inventoryState.products[index] = {
                    ...inventoryState.products[index],
                    ...productData,
                    lastUpdated: new Date().toISOString().split('T')[0]
                };
                showToast('Product updated successfully', 'success');
            }
        } else {
            // Add new product
            const newProduct = {
                id: Date.now(),
                ...productData,
                lastUpdated: new Date().toISOString().split('T')[0]
            };
            inventoryState.products.push(newProduct);
            showToast('Product added successfully', 'success');
        }
        
        saveProducts();
        updateInventoryStats();
        filterProducts();
        closeProductModal();
    }

    // Close delete modal
    function closeDeleteModal() {
        const modal = document.getElementById('deleteModal');
        if (modal) modal.classList.remove('active');
        inventoryState.deletingProductId = null;
    }

    // Confirm delete
    function confirmDelete() {
        if (inventoryState.deletingProductId) {
            inventoryState.products = inventoryState.products.filter(p => p.id !== inventoryState.deletingProductId);
            saveProducts();
            updateInventoryStats();
            filterProducts();
            showToast('Product deleted successfully', 'success');
        }
        closeDeleteModal();
    }

    // Export inventory to CSV
    function exportInventory() {
        if (inventoryState.products.length === 0) {
            showToast('No products to export', 'error');
            return;
        }
        
        const headers = ['ID', 'Name', 'SKU', 'Category', 'Price', 'Quantity', 'Min Stock', 'Supplier', 'Location', 'Description', 'Last Updated'];
        const csvData = inventoryState.products.map(p => [
            p.id,
            p.name,
            p.sku,
            p.category,
            p.price,
            p.quantity,
            p.minStock,
            p.supplier || '',
            p.location || '',
            p.description || '',
            p.lastUpdated
        ]);
        
        const csvContent = [
            headers.join(','),
            ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `inventory_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('Inventory exported successfully', 'success');
    }

    // ---------- CHECK AUTH STATUS ON LOAD ----------
    async function checkAuth() {
        try {
            if (getAuthMode() === authMode.supabase) {
                const { user, error } = await getCurrentUser();
                if (user && !error) {
                    loadDashboard(user);
                    return;
                }
            }
            
            // Check if user is already logged in (local mode or no session)
            const sessionUser = localStorage.getItem('pos_current_user');
            if (sessionUser) {
                try {
                    const user = JSON.parse(sessionUser);
                    loadDashboard(user);
                    return;
                } catch (e) {
                    localStorage.removeItem('pos_current_user');
                }
            }
            
            showLoginView();
        } catch (error) {
            console.error('Auth check error:', error);
            showLoginView();
        }
    }

    // ---------- WINDOW RESIZE HANDLER ----------
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // Handle responsive changes
        }, 250);
    });

    // ---------- PREVENT LAYOUT SHIFT ----------
    document.addEventListener('DOMContentLoaded', () => {
        if (isMobile()) {
            document.body.style.overflow = 'overlay';
        }
    });

    // ---------- INIT ----------
    function init() {
        // Check authentication status
        checkAuth();

        // Restore the admin-only-once rule from Supabase after refresh.
        refreshAdminAvailability();
        
        // Update system status
        updateSystemStatus();

        // Log device type
        if (isDesktop()) {
            console.log('Desktop view initialized');
        } else if (isTablet()) {
            console.log('Tablet view initialized');
        } else {
            console.log('Mobile view initialized');
        }
        
        // Show Supabase status
        if (isSupabaseReady()) {
            console.log('✅ Supabase connected');
            if (accountStatusText) {
                accountStatusText.textContent = 'Supabase connected ✓';
            }
        } else {
            console.log('⚠️ Using local storage mode');
        }
    }
    
    // Override loadDashboard to save session
    const originalLoadDashboard = loadDashboard;
    loadDashboard = function(user) {
        originalLoadDashboard(user);
        // Save session for local mode
        if (getAuthMode() !== authMode.supabase) {
            try {
                localStorage.setItem('pos_current_user', JSON.stringify(user));
            } catch (e) {}
        }
    };
    
    // Override showLoginView to clear session
    const originalShowLoginView = showLoginView;
    showLoginView = function() {
        originalShowLoginView();
        try {
            localStorage.removeItem('pos_current_user');
        } catch (e) {}
    };
    
    init();
})();