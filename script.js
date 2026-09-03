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
        return getUsers().some(u => u.role === 'admin');
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
            
            // Close mobile sidebar
            if (sidebar) sidebar.classList.remove('open');
        });
    });

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