/* ============================================
   SCRIPT PRINCIPAL - ALAGOINHAS EVENTOS
   ============================================ */

let allEvents = [];
let activeCategory = 'all';
let currentUser = null;
let currentProfile = null;
let isRegisterMode = false;
let isAdmin = false; // NOVA VARIÁVEL

/* ============================================
   CATEGORIAS
   ============================================ */
const CATEGORIES = [
    { id: 'all',         label: 'Todos os eventos',  icon: 'layout-grid',  color: 'bg-alagoinhas-500' },
    { id: 'shows',       label: 'Shows e Música',     icon: 'mic-2',        color: 'bg-fuchsia-500' },
    { id: 'festas',      label: 'Festas e Forró',     icon: 'party-popper', color: 'bg-amber-500' },
    { id: 'cultura',     label: 'Cultura e Arte',     icon: 'palette',      color: 'bg-purple-500' },
    { id: 'esportes',    label: 'Esportes',           icon: 'trophy',       color: 'bg-emerald-500' },
    { id: 'gastronomia', label: 'Gastronomia',        icon: 'utensils',     color: 'bg-orange-500' },
    { id: 'infantil',    label: 'Infantil',           icon: 'baby',         color: 'bg-pink-500' },
    { id: 'religioso',   label: 'Religioso',          icon: 'church',       color: 'bg-sky-500' },
    { id: 'outros',      label: 'Outros',             icon: 'tag',          color: 'bg-slate-500' }
];

function categoryMeta(id) {
    return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}

/* ============================================
   RENDERIZAR LISTA DE CATEGORIAS
   ============================================ */
function renderCategoryList() {
    const list = document.getElementById('category-list');
    if (!list) return;

    list.innerHTML = CATEGORIES.map(cat => `
        <button type="button" data-category="${cat.id}" class="category-chip ${cat.id === activeCategory ? 'active' : ''} w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-alagoinhas-100 dark:border-white/10 bg-white/60 dark:bg-white/5 hover:bg-alagoinhas-50 dark:hover:bg-white/10 text-left">
            <span class="chip-icon-wrap w-9 h-9 rounded-xl ${cat.color} bg-opacity-15 flex items-center justify-center flex-shrink-0">
                <i data-lucide="${cat.icon}" class="w-4 h-4 text-alagoinhas-700 dark:text-alagoinhas-100"></i>
            </span>
            <span class="font-semibold text-alagoinhas-900 dark:text-alagoinhas-50">${cat.label}</span>
        </button>
    `).join('');

    if (window.lucide) lucide.createIcons();

    list.querySelectorAll('.category-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            activeCategory = btn.dataset.category;
            updateCategoryUI();
            applyFilters();
            closeCategoryDrawer();
        });
    });
}

/* ============================================
   ATUALIZAR UI DE CATEGORIAS
   ============================================ */
function updateCategoryUI() {
    document.querySelectorAll('.category-chip').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === activeCategory);
    });

    const badge = document.getElementById('category-badge');
    const label = document.getElementById('category-label');
    const pillWrap = document.getElementById('active-category-pill');
    const pillText = document.getElementById('active-category-text');

    if (activeCategory === 'all') {
        if (badge) badge.classList.add('hidden');
        if (label) label.textContent = 'Categorias';
        if (pillWrap) pillWrap.classList.add('hidden');
    } else {
        const meta = categoryMeta(activeCategory);
        if (badge) badge.classList.remove('hidden');
        if (label) label.textContent = 'Categorias';
        if (pillWrap) {
            pillWrap.classList.remove('hidden');
            pillWrap.classList.add('flex');
        }
        if (pillText) pillText.textContent = meta.label;
    }
}

/* ============================================
   GAVETA DE CATEGORIAS
   ============================================ */
function openCategoryDrawer() {
    const drawer = document.getElementById('category-drawer');
    if (!drawer) return;
    drawer.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeCategoryDrawer() {
    const drawer = document.getElementById('category-drawer');
    if (!drawer) return;
    drawer.classList.remove('open');
    document.body.style.overflow = '';
}

window.openCategoryDrawer = openCategoryDrawer;
window.closeCategoryDrawer = closeCategoryDrawer;

/* ============================================
   VERIFICAR STATUS DE ADMIN
   ============================================ */
async function checkAdminStatus() {
    if (!currentUser) {
        isAdmin = false;
        return;
    }
    
    try {
        const { data, error } = await supabaseClient
            .from('admins')
            .select('email')
            .eq('email', currentUser.email)
            .single();
        
        isAdmin = !!data;
        
        const adminLink = document.getElementById('admin-link');
        if (adminLink) {
            if (isAdmin) {
                adminLink.classList.remove('hidden');
                adminLink.style.display = '';
            } else {
                adminLink.classList.add('hidden');
            }
        }
    } catch (error) {
        isAdmin = false;
        const adminLink = document.getElementById('admin-link');
        if (adminLink) adminLink.classList.add('hidden');
    }
}

/* ============================================
   CARREGAMENTO DE EVENTOS
   ============================================ */
async function loadEvents() {
    const container = document.getElementById('events');

    try {
        const { data, error } = await supabaseClient
            .from('events')
            .select('*')
            .order('date', { ascending: true });

        if (error) throw error;

        allEvents = data || [];
        renderEvents(allEvents);

        if (window.hideLoadingScreen) {
            window.hideLoadingScreen();
        }
    } catch (error) {
        console.error('Erro ao carregar eventos:', error);
        container.innerHTML = `
            <div class="col-span-full text-center py-20">
                <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 mb-4">
                    <i data-lucide="alert-circle" class="w-8 h-8 text-red-400"></i>
                </div>
                <p class="text-red-500 dark:text-red-400 text-lg font-semibold">Erro ao carregar eventos.</p>
                <p class="text-slate-500 dark:text-slate-400 text-sm mt-2">Verifique a configuração do Supabase.</p>
            </div>`;
        if (window.lucide) lucide.createIcons();
        if (window.hideLoadingScreen) window.hideLoadingScreen();
    }
}

/* ============================================
   RENDERIZAR EVENTOS
   ============================================ */
function renderEvents(events) {
    const container = document.getElementById('events');

    if (events.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-20">
                <div class="inline-flex items-center justify-center w-16 h-16 rounded-full glass-effect mb-4">
                    <i data-lucide="search-x" class="w-8 h-8 text-alagoinhas-300"></i>
                </div>
                <p class="event-title text-lg font-semibold">Nenhum evento encontrado 😢</p>
                <p class="event-desc text-sm mt-2">Tente ajustar os filtros de busca</p>
            </div>`;
        if (window.lucide) lucide.createIcons();
        return;
    }

    container.innerHTML = events.map((ev, idx) => {
        const date = new Date(ev.date);
        const dateStr = date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const badge = ev.has_ticket
            ? `<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-alagoinhas-500/20 text-alagoinhas-700 dark:text-alagoinhas-300 text-xs font-bold border border-alagoinhas-500/30"><i data-lucide="ticket" class="w-3.5 h-3.5"></i> R$ ${Number(ev.price).toFixed(2)}</span>`
            : `<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-500/30"><i data-lucide="gift" class="w-3.5 h-3.5"></i> Gratuito</span>`;

        const meta = categoryMeta(ev.category);
        const categoryTag = `<span class="absolute top-3 left-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${meta.color} text-white text-xs font-bold shadow-lg backdrop-blur-sm"><i data-lucide="${meta.icon}" class="w-3.5 h-3.5"></i> ${meta.label}</span>`;

        return `
            <article class="event-card cursor-pointer group" data-event-id="${ev.id}" onclick="openModalById(${ev.id})">
                <div class="relative overflow-hidden h-48">
                    <img src="${ev.image}" alt="${escapeHtml(ev.name)}" onerror="this.src='https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80'" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-80"></div>
                    ${ev.category ? categoryTag : ''}
                </div>
                <div class="p-5 flex flex-col flex-1">
                    <h3 class="text-xl font-bold event-title mb-2 line-clamp-2 group-hover:text-alagoinhas-500 transition-colors">${escapeHtml(ev.name)}</h3>
                    <p class="flex items-center gap-2 event-date text-sm font-medium mb-3">
                        <i data-lucide="calendar" class="w-4 h-4"></i> ${dateStr}
                    </p>
                    <p class="event-desc text-sm line-clamp-3 mb-4 flex-1">${escapeHtml(ev.description)}</p>
                    <div class="mt-auto">${badge}</div>
                </div>
            </article>
        `;
    }).join('');

    if (window.lucide) setTimeout(() => lucide.createIcons(), 50);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/* ============================================
   MODAL DE EVENTO
   ============================================ */
function openModalById(id) {
    const ev = allEvents.find(e => e.id === id);
    if (!ev) return;
    openModal(ev);
}
window.openModalById = openModalById;

function openModal(eventData) {
    const date = new Date(eventData.date);
    const dateStr = date.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    document.getElementById('modal-img').src = eventData.image;
    document.getElementById('modal-title').textContent = eventData.name;
    document.getElementById('modal-date').innerHTML = `<i data-lucide="clock" class="w-5 h-5"></i> ${dateStr}`;
    document.getElementById('modal-desc').textContent = eventData.description;

    const modalCategory = document.getElementById('modal-category');
    if (modalCategory) {
        if (eventData.category) {
            const meta = categoryMeta(eventData.category);
            modalCategory.innerHTML = `<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${meta.color} text-white text-xs font-bold shadow-lg"><i data-lucide="${meta.icon}" class="w-3.5 h-3.5"></i> ${meta.label}</span>`;
            modalCategory.classList.remove('hidden');
        } else {
            modalCategory.classList.add('hidden');
        }
    }

    const priceEl = document.getElementById('modal-price');
    const linkEl = document.getElementById('modal-link');

    if (eventData.has_ticket) {
        priceEl.innerHTML = `<span class="block text-slate-500 dark:text-slate-400 text-sm font-normal mb-1">Valor do ingresso</span>R$ ${Number(eventData.price).toFixed(2)}`;
        priceEl.classList.remove('hidden');
        if (eventData.link) {
            linkEl.href = eventData.link;
            linkEl.classList.remove('hidden');
            linkEl.classList.add('inline-flex');
        } else {
            linkEl.classList.add('hidden');
            linkEl.classList.remove('inline-flex');
        }
    } else {
        priceEl.innerHTML = `<span class="block text-slate-500 dark:text-slate-400 text-sm font-normal mb-1">Entrada</span><span class="text-emerald-500">Gratuita</span>`;
        priceEl.classList.remove('hidden');
        linkEl.classList.add('hidden');
        linkEl.classList.remove('inline-flex');
    }

    const modal = document.getElementById('modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';

    if (window.lucide) setTimeout(() => lucide.createIcons(), 50);
}
window.openModal = openModal;

function closeModal() {
    const modal = document.getElementById('modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
}
window.closeModal = closeModal;

/* ============================================
   AUTENTICAÇÃO
   ============================================ */
async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    currentUser = session?.user || null;
    
    if (currentUser) {
        await loadProfile();
        await checkAdminStatus(); // VERIFICA SE É ADMIN
    } else {
        isAdmin = false;
    }
    
    updateAuthUI();
}

async function loadProfile() {
    if (!currentUser) return;
    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();
        if (error) throw error;
        currentProfile = data;
    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
    }
}

function updateAuthUI() {
    const loginButton = document.getElementById('login-button');
    const userMenu = document.getElementById('user-menu');
    const adminLink = document.getElementById('admin-link');
    const userName = document.getElementById('user-name');
    const userEmail = document.getElementById('dropdown-email');
    const dropdownName = document.getElementById('dropdown-name');
    const userAvatar = document.getElementById('user-avatar');
    const userAvatarIcon = document.getElementById('user-avatar-icon');

    if (currentUser) {
        if (loginButton) loginButton.classList.add('hidden');
        if (userMenu) {
            userMenu.classList.remove('hidden');
            const displayName = currentProfile?.full_name || currentUser.email.split('@')[0];
            const avatarUrl = currentProfile?.avatar_url;
            
            if (userName) userName.textContent = displayName;
            if (dropdownName) dropdownName.textContent = displayName;
            if (userEmail) userEmail.textContent = currentUser.email;
            
            if (avatarUrl) {
                userAvatar.src = avatarUrl;
                userAvatar.classList.remove('hidden');
                userAvatarIcon.classList.add('hidden');
            } else {
                userAvatar.classList.add('hidden');
                userAvatarIcon.classList.remove('hidden');
            }
        }
        if (adminLink) {
            if (isAdmin) {
                adminLink.classList.remove('hidden');
                adminLink.style.display = '';
            } else {
                adminLink.classList.add('hidden');
            }
        }
    } else {
        if (loginButton) loginButton.classList.remove('hidden');
        if (userMenu) userMenu.classList.add('hidden');
        if (adminLink) adminLink.classList.add('hidden');
    }
}

function openAuthModal() {
    const modal = document.getElementById('auth-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
    if (window.lucide) lucide.createIcons();
}
window.openAuthModal = openAuthModal;

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
    document.getElementById('auth-form').reset();
    document.getElementById('auth-message').classList.add('hidden');
    isRegisterMode = false;
    updateAuthModeUI();
}
window.closeAuthModal = closeAuthModal;

function updateAuthModeUI() {
    const title = document.getElementById('auth-title');
    const submit = document.getElementById('auth-submit');
    const toggle = document.getElementById('toggle-auth-mode');

    if (isRegisterMode) {
        title.textContent = 'Criar Conta';
        submit.textContent = 'Criar Conta';
        toggle.textContent = 'Já tem conta? Entrar';
    } else {
        title.textContent = 'Entrar';
        submit.textContent = 'Entrar';
        toggle.textContent = 'Não tem conta? Criar uma';
    }
}

function showAuthMessage(message, type) {
    const msgEl = document.getElementById('auth-message');
    msgEl.textContent = message;
    msgEl.className = `text-sm font-semibold p-3 rounded-xl ${
        type === 'error' 
            ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
            : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
    }`;
    msgEl.classList.remove('hidden');
}

document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const submitBtn = document.getElementById('auth-submit');

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin inline-block"></i> Processando...';
    if (window.lucide) lucide.createIcons();

    try {
        let result;
        if (isRegisterMode) {
            result = await supabaseClient.auth.signUp({ email, password });
            if (result.error) throw result.error;
            showAuthMessage('Conta criada com sucesso! Verifique seu email para confirmar.', 'success');
            setTimeout(() => {
                isRegisterMode = false;
                updateAuthModeUI();
                document.getElementById('auth-form').reset();
                document.getElementById('auth-message').classList.add('hidden');
            }, 3000);
        } else {
            result = await supabaseClient.auth.signInWithPassword({ email, password });
            if (result.error) throw result.error;
            currentUser = result.data.user;
            await loadProfile();
            await checkAdminStatus();
            updateAuthUI();
            closeAuthModal();
        }
    } catch (error) {
        console.error('Auth error:', error);
        showAuthMessage(error.message || 'Erro ao processar. Tente novamente.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = isRegisterMode ? 'Criar Conta' : 'Entrar';
    }
});

document.getElementById('toggle-auth-mode').addEventListener('click', () => {
    isRegisterMode = !isRegisterMode;
    updateAuthModeUI();
    document.getElementById('auth-message').classList.add('hidden');
});

document.getElementById('google-login').addEventListener('click', async () => {
    try {
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin + '/index.html' }
        });
        if (error) throw error;
    } catch (error) {
        console.error('Google login error:', error);
        showAuthMessage(error.message || 'Erro ao fazer login com Google.', 'error');
    }
});

document.getElementById('logout-button').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    currentUser = null;
    currentProfile = null;
    isAdmin = false;
    updateAuthUI();
});

document.getElementById('user-button').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('user-dropdown').classList.toggle('hidden');
});

document.addEventListener('click', () => {
    document.getElementById('user-dropdown').classList.add('hidden');
});

document.getElementById('login-button').addEventListener('click', openAuthModal);

supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN') {
        currentUser = session.user;
        await loadProfile();
        await checkAdminStatus();
        updateAuthUI();
    } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        currentProfile = null;
        isAdmin = false;
        updateAuthUI();
    }
});

/* ============================================
   EDIÇÃO DE PERFIL
   ============================================ */
function openProfileModal() {
    const modal = document.getElementById('profile-modal');
    const nameInput = document.getElementById('profile-name');
    const avatarInput = document.getElementById('profile-avatar');
    const preview = document.getElementById('profile-preview');
    const icon = document.getElementById('profile-icon');
    
    if (currentProfile) {
        nameInput.value = currentProfile.full_name || '';
        avatarInput.value = currentProfile.avatar_url || '';
        if (currentProfile.avatar_url) {
            preview.src = currentProfile.avatar_url;
            preview.classList.remove('hidden');
            icon.classList.add('hidden');
        } else {
            preview.classList.add('hidden');
            icon.classList.remove('hidden');
        }
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
    if (window.lucide) lucide.createIcons();
}
window.openProfileModal = openProfileModal;

function closeProfileModal() {
    const modal = document.getElementById('profile-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
    document.getElementById('profile-form').reset();
    document.getElementById('profile-message').classList.add('hidden');
}
window.closeProfileModal = closeProfileModal;

document.getElementById('profile-avatar').addEventListener('input', (e) => {
    const url = e.target.value;
    const preview = document.getElementById('profile-preview');
    const icon = document.getElementById('profile-icon');
    if (url) {
        preview.src = url;
        preview.classList.remove('hidden');
        icon.classList.add('hidden');
    } else {
        preview.classList.add('hidden');
        icon.classList.remove('hidden');
    }
});

function showProfileMessage(message, type) {
    const msgEl = document.getElementById('profile-message');
    msgEl.textContent = message;
    msgEl.className = `text-sm font-semibold p-3 rounded-xl ${
        type === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
    }`;
    msgEl.classList.remove('hidden');
}

document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = document.getElementById('profile-name').value.trim();
    const avatarUrl = document.getElementById('profile-avatar').value.trim();
    const submitBtn = document.getElementById('profile-submit');

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin inline-block"></i> Salvando...';
    if (window.lucide) lucide.createIcons();

    try {
        const { error } = await supabaseClient.from('profiles').update({ full_name: fullName, avatar_url: avatarUrl || null }).eq('id', currentUser.id);
        if (error) throw error;
        showProfileMessage('Perfil atualizado com sucesso!', 'success');
        await loadProfile();
        updateAuthUI();
        setTimeout(() => { closeProfileModal(); }, 1500);
    } catch (error) {
        console.error('Profile update error:', error);
        showProfileMessage(error.message || 'Erro ao atualizar perfil.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Salvar Alterações';
    }
});

document.getElementById('edit-profile-button').addEventListener('click', () => {
    document.getElementById('user-dropdown').classList.add('hidden');
    openProfileModal();
});

/* ============================================
   EVENT LISTENERS
   ============================================ */
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search');
    if (searchInput) searchInput.addEventListener('input', applyFilters);

    const categoryDrawerBtn = document.getElementById('category-drawer-btn');
    if (categoryDrawerBtn) categoryDrawerBtn.addEventListener('click', openCategoryDrawer);

    const closeCategoryBtn = document.getElementById('close-category');
    if (closeCategoryBtn) closeCategoryBtn.addEventListener('click', closeCategoryDrawer);

    const categoryBackdrop = document.getElementById('category-backdrop');
    if (categoryBackdrop) categoryBackdrop.addEventListener('click', closeCategoryDrawer);

    const clearCategoryBtn = document.getElementById('clear-category');
    if (clearCategoryBtn) {
        clearCategoryBtn.addEventListener('click', () => {
            activeCategory = 'all';
            updateCategoryUI();
            applyFilters();
        });
    }

    const modalBackdrop = document.getElementById('modal-backdrop');
    if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);

    const closeModalBtn = document.getElementById('close-modal');
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeModal();
            closeCategoryDrawer();
            closeAuthModal();
            closeProfileModal();
        }
    });

    renderCategoryList();
    updateCategoryUI();
    loadEvents();
    checkAuth();
});

function applyFilters() {
    const searchInput = document.getElementById('search');
    const search = searchInput ? searchInput.value.toLowerCase() : '';
    let filtered = allEvents.filter(ev =>
        ev.name.toLowerCase().includes(search) ||
        (ev.description && ev.description.toLowerCase().includes(search))
    );
    if (activeCategory !== 'all') {
        filtered = filtered.filter(ev => ev.category === activeCategory);
    }
    renderEvents(filtered);
}