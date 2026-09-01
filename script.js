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
    const CLIENT_LOGO_KEY = 'pos_client_logo';
    const GROUP_LOGO_KEY = 'pos_group_logo';
    
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

    // ---------- LOGO UPLOAD FUNCTIONS ----------
    function loadSavedLogos() {
        // Load client logo
        const savedClientLogo = localStorage.getItem(CLIENT_LOGO_KEY);
        if (savedClientLogo) {
            const clientLogoImg = document.getElementById('clientLogoImg');
            const clientLogoPlaceholder = document.getElementById('clientLogoPlaceholder');
            clientLogoImg.src = savedClientLogo;
            clientLogoImg.style.display = 'block';
            clientLogoPlaceholder.style.display = 'none';
        }

        // Load group logo
        const savedGroupLogo = localStorage.getItem(GROUP_LOGO_KEY);
        if (savedGroupLogo) {
            const groupLogoImg = document.getElementById('groupLogoImg');
            const groupLogoPlaceholder = document.getElementById('groupLogoPlaceholder');
            groupLogoImg.src = savedGroupLogo;
            groupLogoImg.style.display = 'block';
            groupLogoPlaceholder.style.display = 'none';
        }
    }

    function handleClientLogoUpload(file) {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showToast('Please select an image file', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showToast('Image size should be less than 5MB', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const imageData = e.target.result;
            localStorage.setItem(CLIENT_LOGO_KEY, imageData);
            const clientLogoImg = document.getElementById('clientLogoImg');
            const clientLogoPlaceholder = document.getElementById('clientLogoPlaceholder');
            clientLogoImg.src = imageData;
            clientLogoImg.style.display = 'block';
            clientLogoPlaceholder.style.display = 'none';
            showToast('Client logo updated successfully!', 'success');
        };
        reader.readAsDataURL(file);
    }

    function handleGroupLogoUpload(file) {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showToast('Please select an image file', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showToast('Image size should be less than 5MB', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const imageData = e.target.result;
            localStorage.setItem(GROUP_LOGO_KEY, imageData);
            const groupLogoImg = document.getElementById('groupLogoImg');
            const groupLogoPlaceholder = document.getElementById('groupLogoPlaceholder');
            groupLogoImg.src = imageData;
            groupLogoImg.style.display = 'block';
            groupLogoPlaceholder.style.display = 'none';
            showToast('Group logo updated successfully!', 'success');
        };
        reader.readAsDataURL(file);
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
    let selectedRole = 'admin';

    // ---------- TOAST ----------
    function showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
        container.appendChild(toast);
        
        // Auto-remove toast
        const toastTimeout = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(20px)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
        
        // Allow manual dismissal on touch
        if (isMobile()) {
            toast.style.cursor = 'pointer';
            toast.addEventListener('click', () => {
                clearTimeout(toastTimeout);
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(20px)';
                setTimeout(() => toast.remove(), 300);
            });
        }
    }

    // ---------- UPDATE SYSTEM STATUS ----------
    function updateSystemStatus() {
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
        const hasAdmin = hasAdminAccount();
        
        if (hasAdmin) {
            adminRoleOption.disabled = true;
            adminRoleOption.textContent = 'Admin (already exists)';
            signupRoleSelect.value = 'cashier';
            signupRoleInfo.textContent = 'Admin already registered. You can only create a Cashier.';
            roleAvailabilityAlert.style.display = 'flex';
            roleAvailabilityAlert.className = 'alert-box warning';
            roleAvailabilityText.textContent = 'Admin exists — new accounts must be Cashier.';
        } else {
            adminRoleOption.disabled = false;
            adminRoleOption.textContent = 'Admin';
            signupRoleSelect.value = 'admin';
            signupRoleInfo.textContent = 'No admin yet. Create an Admin account first.';
            roleAvailabilityAlert.style.display = 'flex';
            roleAvailabilityAlert.className = 'alert-box info';
            roleAvailabilityText.textContent = 'First account must be Admin — subsequent accounts will be Cashier.';
        }
    }

    // ---------- SHOW VIEW ----------
    function showView(view) {
        signinView.style.display = 'none';
        signupView.style.display = 'none';
        forgotView.style.display = 'none';
        view.style.display = 'block';
        
        // Scroll to top on mobile
        if (isMobile()) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        
        if (view === signupView) {
            updateSignupRoleAvailability();
        }
    }

    // ---------- ROLE SELECTOR ----------
    // ---------- PASSWORD TOGGLE ----------
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = btn.dataset.target;
            const input = document.getElementById(targetId);
            if (input.type === 'password') {
                input.type = 'text';
                btn.innerHTML = '<i class="fas fa-eye-slash"></i>';
            } else {
                input.type = 'password';
                btn.innerHTML = '<i class="fas fa-eye"></i>';
            }
        });
    });

    // ---------- PREVENT ZOOM ON INPUT FOCUS (Mobile) ----------
    if (isMobile()) {
        document.querySelectorAll('input, select, textarea').forEach(el => {
            el.addEventListener('focus', function() {
                // Prevent iOS zoom on input focus
                this.style.fontSize = '16px';
            });
        });
    }

    // ---------- FORM SWITCHING ----------
    document.getElementById('createAccountBtn').addEventListener('click', () => {
        showView(signupView);
        setTimeout(() => document.getElementById('signupFullName').focus(), 100);
    });
    document.getElementById('backToSignin').addEventListener('click', () => {
        showView(signinView);
        updateSystemStatus();
    });
    document.getElementById('forgotLink').addEventListener('click', () => {
        showView(forgotView);
        setTimeout(() => document.getElementById('forgotEmail').focus(), 100);
    });
    document.getElementById('backToSigninFromForgot').addEventListener('click', () => {
        showView(signinView);
        updateSystemStatus();
    });

    // ---------- VALIDATION ----------
    function validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
    function setError(id, msg) {
        const errorEl = document.getElementById(id);
        if (errorEl) {
            errorEl.textContent = msg;
            // Scroll to error on mobile
            if (isMobile() && msg) {
                errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }
    function clearErrors() {
        document.querySelectorAll('.error-message, .info-message').forEach(el => el.textContent = '');
    }

    // ---------- SIGN IN ----------
    signinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors();
        const email = document.getElementById('signinEmail').value.trim();
        const password = document.getElementById('signinPassword').value;
        let valid = true;

        if (!email) { setError('signinEmailError', 'Email is required'); valid = false; }
        else if (!validateEmail(email)) { setError('signinEmailError', 'Invalid email format'); valid = false; }
        if (!password) { setError('signinPasswordError', 'Password is required'); valid = false; }
        else if (password.length < 6) { setError('signinPasswordError', 'Minimum 6 characters'); valid = false; }

        if (!valid) return;

        const btn = document.getElementById('signinSubmitBtn');
        btn.classList.add('loading');
        btn.disabled = true;

        try {
            if (getAuthMode() === authMode.supabase) {
                const { data, error } = await signInWithSupabase(email, password);
                if (error) {
                    throw error;
                }

                const userMeta = data?.user?.user_metadata || {};
                showToast(`Welcome back, ${userMeta.full_name || userMeta.name || 'User'}! Redirecting...`, 'success');
                return;
            }

            await new Promise(r => setTimeout(r, 800));
            const user = findUserByEmail(email);
            if (user && user.password === password) {
                showToast(`Welcome back, ${user.name}! Redirecting...`, 'success');
            } else if (user) {
                showToast('Incorrect password.', 'error');
            } else {
                showToast('No account found with this email.', 'error');
            }
        } catch (error) {
            const message = error?.message || 'Unable to sign in.';
            showToast(message, 'error');
        } finally {
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    });

    // ---------- SIGN UP ----------
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors();
        const name = document.getElementById('signupFullName').value.trim();
        const email = document.getElementById('signupEmail').value.trim();
        const role = document.getElementById('signupRole').value;
        const password = document.getElementById('signupPassword').value;
        const confirm = document.getElementById('signupConfirmPassword').value;
        const agree = document.getElementById('agreeTerms').checked;
        let valid = true;

        if (!name) { setError('signupFullNameError', 'Your name is required'); valid = false; }
        else if (name.length < 2) { setError('signupFullNameError', 'Minimum 2 characters'); valid = false; }
        if (!email) { setError('signupEmailError', 'Email is required'); valid = false; }
        else if (!validateEmail(email)) { setError('signupEmailError', 'Invalid email format'); valid = false; }
        else if (findUserByEmail(email)) { setError('signupEmailError', 'Email already registered'); valid = false; }
        if (role === 'admin' && hasAdminAccount()) {
            setError('signupRoleError', 'Admin already exists. Select Cashier.');
            valid = false;
        }
        if (!password) { setError('signupPasswordError', 'Password is required'); valid = false; }
        else if (password.length < 6) { setError('signupPasswordError', 'Minimum 6 characters'); valid = false; }
        if (password !== confirm) { setError('signupConfirmPasswordError', 'Passwords do not match'); valid = false; }
        if (!agree) { setError('termsError', 'You must agree to terms'); valid = false; }

        if (!valid) return;

        const btn = document.getElementById('signupSubmitBtn');
        btn.classList.add('loading');
        btn.disabled = true;

        try {
            if (getAuthMode() === authMode.supabase) {
                const { data, error } = await signUpWithSupabase({ fullName: name, email, password, role });
                if (error) {
                    throw error;
                }

                showToast(`Account created for ${name} (${role})!`, 'success');
                document.getElementById('signinEmail').value = email;
                document.getElementById('signinPassword').value = '';
                showView(signinView);
                selectedRole = role;
                return;
            }

            await new Promise(r => setTimeout(r, 800));
            addUser({ name, email, password, role });
            updateSystemStatus();
            showToast(`Account created for ${name} (${role})!`, 'success');
            document.getElementById('signinEmail').value = email;
            document.getElementById('signinPassword').value = '';
            showView(signinView);
            selectedRole = role;
        } catch (error) {
            const message = error?.message || 'Unable to create account.';
            showToast(message, 'error');
        } finally {
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    });

    // ---------- FORGOT PASSWORD ----------
    forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors();
        const email = document.getElementById('forgotEmail').value.trim();
        let valid = true;

        if (!email) { setError('forgotEmailError', 'Email is required'); valid = false; }
        else if (!validateEmail(email)) { setError('forgotEmailError', 'Invalid email format'); valid = false; }

        if (!valid) return;

        const btn = document.getElementById('forgotSubmitBtn');
        btn.classList.add('loading');
        btn.disabled = true;

        try {
            if (getAuthMode() === authMode.supabase) {
                const { error } = await resetPasswordWithSupabase(email);
                if (error) {
                    throw error;
                }

                const infoBox = document.getElementById('forgotInfoBox');
                const infoText = document.getElementById('forgotInfoText');
                infoBox.style.display = 'flex';
                infoBox.className = 'alert-box success';
                infoText.textContent = `Reset link sent to ${email}. Check your inbox.`;
                showToast('Password reset link sent!', 'success');
                return;
            }

            await new Promise(r => setTimeout(r, 800));
            const user = findUserByEmail(email);
            const infoBox = document.getElementById('forgotInfoBox');
            const infoText = document.getElementById('forgotInfoText');

            if (user) {
                infoBox.style.display = 'flex';
                infoBox.className = 'alert-box success';
                infoText.textContent = `Reset link sent to ${user.email}. Check your inbox.`;
                showToast('Password reset link sent!', 'success');
            } else {
                infoBox.style.display = 'flex';
                infoBox.className = 'alert-box error';
                infoText.textContent = `No account found with ${email}.`;
                showToast('No account found with this email', 'error');
            }
        } catch (error) {
            const infoBox = document.getElementById('forgotInfoBox');
            const infoText = document.getElementById('forgotInfoText');
            infoBox.style.display = 'flex';
            infoBox.className = 'alert-box error';
            infoText.textContent = error?.message || 'Unable to reset password.';
            showToast(error?.message || 'Unable to reset password.', 'error');
        } finally {
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    });

    // ---------- WINDOW RESIZE HANDLER ----------
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // Re-initialize on breakpoint change
            if (isMobile()) {
                // Mobile-specific behavior
            } else if (isTablet()) {
                // Tablet-specific behavior
            } else {
                // Desktop-specific behavior
            }
        }, 250);
    });

    // ---------- PREVENT LAYOUT SHIFT ----------
    document.addEventListener('DOMContentLoaded', () => {
        // Ensure no layout shift on scroll
        if (isMobile()) {
            document.body.style.overflow = 'overlay';
        }
    });

    // ---------- INIT ----------
    function init() {
        updateSystemStatus();
        loadSavedLogos();
        
        // Log device type
        if (isDesktop()) {
            console.log('Desktop view initialized');
        } else if (isTablet()) {
            console.log('Tablet view initialized');
        } else {
            console.log('Mobile view initialized');
        }
    }
    init();
})();

