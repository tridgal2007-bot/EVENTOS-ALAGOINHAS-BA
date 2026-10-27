/* global supabaseClient */
/* ============================================
   SCRIPT PRINCIPAL - ALAGOINHAS EVENTOS
   ============================================ */

const IMAGE_BUCKET = 'alagoinhas-images';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

let allEvents = [];
let activeCategory = 'all';
let currentUser = null;
let currentProfile = null;
let isRegisterMode = false;
let isAdmin = false;
let profileImageObjectUrl = null;

const CATEGORIES = [
    { id: 'all', label: 'Todos os eventos', icon: 'calendar-days' },
    { id: 'shows', label: 'Shows e Música', icon: 'mic-2' },
    { id: 'festas', label: 'Festas e Forró', icon: 'party-popper' },
    { id: 'cultura', label: 'Cultura e Arte', icon: 'palette' },
    { id: 'esportes', label: 'Esportes', icon: 'trophy' },
    { id: 'gastronomia', label: 'Gastronomia', icon: 'utensils' },
    { id: 'infantil', label: 'Infantil', icon: 'baby' },
    { id: 'religioso', label: 'Religioso', icon: 'church' },
    { id: 'outros', label: 'Outros', icon: 'tag' }
];

const CATEGORY_META = Object.fromEntries(
    CATEGORIES.map(item => [item.id, item])
);

const QUICK_CATEGORY_META = {
    all: {
        label: 'Todos',
        categories: null
    },
    'shows-festas': {
        label: 'Shows & Festas',
        categories: ['shows', 'festas']
    },
    'esportes-saude': {
        label: 'Esportes & Saúde',
        categories: ['esportes']
    },
    cultura: {
        label: 'Cultura',
        categories: ['cultura']
    },
    gastronomia: {
        label: 'Gastronomia',
        categories: ['gastronomia']
    },
    infantil: {
        label: 'Infantil',
        categories: ['infantil']
    },
    religioso: {
        label: 'Religioso',
        categories: ['religioso']
    },
    outros: {
        label: 'Outros',
        categories: ['outros']
    }
};

let calendarMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
);

let selectedCalendarDate = dateKey(new Date());

const $ = id => document.getElementById(id);

/* ============================================
   FUNÇÕES GERAIS
   ============================================ */

function refreshIcons() {
    if (
        window.lucide &&
        typeof window.lucide.createIcons === 'function'
    ) {
        window.lucide.createIcons();
    }
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
}

function safeUrl(value) {
    try {
        const url = new URL(String(value || ''), window.location.href);

        return ['http:', 'https:'].includes(url.protocol)
            ? url.href
            : '';
    } catch {
        return '';
    }
}

function dateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function eventDateKey(eventItem) {
    if (!eventItem?.date) return '';

    const date = new Date(eventItem.date);

    return Number.isNaN(date.getTime())
        ? ''
        : dateKey(date);
}

function dateLabelFromKey(key) {
    const [year, month, day] = key.split('-').map(Number);

    return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function setMessage(element, message, type = 'error') {
    if (!element) return;

    element.textContent = message;

    element.classList.remove(
        'hidden',
        'text-red-500',
        'text-emerald-500',
        'text-alagoinhas-500',
        'bg-red-500/10',
        'bg-emerald-500/10'
    );

    if (type === 'success') {
        element.classList.add(
            'text-emerald-500',
            'bg-emerald-500/10'
        );
    } else if (type === 'info') {
        element.classList.add('text-alagoinhas-500');
    } else {
        element.classList.add(
            'text-red-500',
            'bg-red-500/10'
        );
    }
}

function clearMessage(element) {
    if (!element) return;

    element.textContent = '';
    element.classList.add('hidden');
}

function formatDate(value) {
    if (!value) return 'Data a confirmar';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 'Data a confirmar';
    }

    return date.toLocaleString('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatPrice(eventItem) {
    if (!eventItem.has_ticket) {
        return 'Gratuito';
    }

    return `A partir de ${Number(eventItem.price || 0).toLocaleString(
        'pt-BR',
        {
            style: 'currency',
            currency: 'BRL'
        }
    )}`;
}

function showLoadingMessage(message) {
    const eventsContainer = $('events');

    if (eventsContainer) {
        eventsContainer.innerHTML = `
            <div class="col-span-full text-center py-14 text-slate-500 dark:text-slate-400">
                ${escapeHtml(message)}
            </div>
        `;
    }
}

/* ============================================
   EVENTOS
   ============================================ */

function renderEvents() {
    const container = $('events');

    if (!container) return;

    const searchText = ($('search')?.value || '')
        .trim()
        .toLocaleLowerCase('pt-BR');

    const allowedCategories =
        QUICK_CATEGORY_META[activeCategory]?.categories;

    const filtered = allEvents.filter(eventItem => {
        const matchesCategory =
            !allowedCategories ||
            allowedCategories.includes(eventItem.category);

        const combinedText = `
            ${eventItem.name || ''}
            ${eventItem.description || ''}
            ${eventItem.category || ''}
        `.toLocaleLowerCase('pt-BR');

        return matchesCategory &&
            combinedText.includes(searchText);
    });

    updateCategoryFilterUI();

    if (!filtered.length) {
        container.innerHTML = `
            <div class="col-span-full text-center py-16 glass-card rounded-2xl">
                <div class="w-14 h-14 mx-auto mb-4 rounded-2xl bg-alagoinhas-100 dark:bg-white/5 flex items-center justify-center">
                    <i data-lucide="calendar-search" class="w-7 h-7 text-alagoinhas-500"></i>
                </div>
                <h3 class="font-display text-lg font-bold text-alagoinhas-900 dark:text-white">
                    Nenhum evento encontrado
                </h3>
                <p class="text-sm text-slate-500 dark:text-slate-400 mt-2">
                    Tente mudar sua busca ou categoria.
                </p>
                <button id="empty-clear-filters" type="button" class="mt-5 text-sm font-semibold text-alagoinhas-600 dark:text-alagoinhas-300 underline">
                    Limpar filtros
                </button>
            </div>
        `;

        $('empty-clear-filters')?.addEventListener('click', () => {
            activeCategory = 'all';

            if ($('search')) {
                $('search').value = '';
            }

            renderEvents();
        });

        refreshIcons();
        return;
    }

    container.innerHTML = filtered.map((eventItem, index) => {
        const category =
            CATEGORY_META[eventItem.category] ||
            CATEGORY_META.outros;

        const imageUrl = safeUrl(eventItem.image);
        const categoryLabel = category.label || 'Outros';
        const dateLabel = formatDate(eventItem.date);

        return `
            <article
                class="event-card glass-card rounded-2xl overflow-hidden cursor-pointer group fade-slide-in"
                style="animation-delay:${index * 45}ms"
                data-event-id="${escapeHtml(eventItem.id)}"
                tabindex="0"
                role="button"
                aria-label="Ver evento ${escapeHtml(eventItem.name)}"
            >
                <div class="relative overflow-hidden bg-slate-100 dark:bg-white/5">
                    ${
                        imageUrl
                            ? `
                                <img
                                    src="${escapeHtml(imageUrl)}"
                                    alt="${escapeHtml(eventItem.name)}"
                                    class="w-full h-56 object-cover transition-transform duration-500 group-hover:scale-105"
                                    loading="lazy"
                                    onerror="this.style.display='none'"
                                >
                            `
                            : `
                                <div class="w-full h-56 flex items-center justify-center">
                                    <i data-lucide="calendar-days" class="w-12 h-12 text-alagoinhas-300"></i>
                                </div>
                            `
                    }

                    <div class="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent pointer-events-none"></div>

                    <span class="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold bg-white/95 text-alagoinhas-700 shadow">
                        <i data-lucide="${category.icon}" class="w-3.5 h-3.5"></i>
                        ${escapeHtml(categoryLabel)}
                    </span>
                </div>

                <div class="p-5">
                    <div class="flex items-start gap-3 mb-3">
                        <div class="w-10 h-10 shrink-0 rounded-xl bg-alagoinhas-100 dark:bg-alagoinhas-500/10 text-alagoinhas-600 dark:text-alagoinhas-300 flex items-center justify-center">
                            <i data-lucide="calendar-clock" class="w-5 h-5"></i>
                        </div>
                        <div class="min-w-0">
                            <p class="text-xs font-semibold text-alagoinhas-600 dark:text-alagoinhas-300">
                                ${escapeHtml(dateLabel)}
                            </p>
                            <h3 class="mt-1 font-display text-lg font-bold text-alagoinhas-900 dark:text-white line-clamp-2">
                                ${escapeHtml(eventItem.name)}
                            </h3>
                        </div>
                    </div>

                    <p class="event-desc text-sm leading-6 line-clamp-3">
                        ${escapeHtml(eventItem.description)}
                    </p>

                    <div class="mt-5 pt-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-between gap-3">
                        <span class="text-sm font-bold ${eventItem.has_ticket ? 'text-alagoinhas-600 dark:text-alagoinhas-300' : 'text-emerald-600 dark:text-emerald-400'}">
                            ${escapeHtml(formatPrice(eventItem))}
                        </span>
                        <span class="text-xs font-bold text-alagoinhas-600 dark:text-alagoinhas-300 inline-flex items-center gap-1">
                            Ver detalhes
                            <i data-lucide="arrow-up-right" class="w-4 h-4"></i>
                        </span>
                    </div>
                </div>
            </article>
        `;
    }).join('');

    container.querySelectorAll('[data-event-id]').forEach(card => {
        const open = () => openEventModal(card.dataset.eventId);

        card.addEventListener('click', open);

        card.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                open();
            }
        });
    });

    refreshIcons();
}

async function loadEvents() {
    showLoadingMessage('Carregando eventos...');

    try {
        const { data, error } = await supabaseClient
            .from('events')
            .select('*')
            .order('date', { ascending: true });

        if (error) throw error;

        allEvents = data || [];

        renderEvents();
        renderCalendar();
    } catch (error) {
        console.error('Erro ao carregar eventos:', error);

        showLoadingMessage(
            'Não foi possível carregar os eventos. Atualize a página ou tente novamente mais tarde.'
        );
    } finally {
        window.hideLoadingScreen?.();
    }
}

/* ============================================
   FILTROS DE CATEGORIA
   ============================================ */

function updateCategoryFilterUI() {
    const active =
        QUICK_CATEGORY_META[activeCategory] ||
        QUICK_CATEGORY_META.all;

    const pill = $('active-category-pill');
    const text = $('active-category-text');

    if (activeCategory === 'all') {
        pill?.classList.add('hidden');
    } else {
        pill?.classList.remove('hidden');
        pill?.classList.add('flex');

        if (text) {
            text.textContent = active.label;
        }
    }

    document.querySelectorAll('[data-quick-category]').forEach(button => {
        const selected =
            button.dataset.quickCategory === activeCategory;

        button.classList.toggle('active', selected);
        button.setAttribute('aria-pressed', String(selected));
    });

    document.querySelectorAll('[data-category]').forEach(button => {
        const selected =
            button.dataset.category === activeCategory;

        button.classList.toggle('bg-alagoinhas-100', selected);
        button.classList.toggle('dark:bg-white/10', selected);
        button.classList.toggle('border-alagoinhas-300', selected);
        button.setAttribute('aria-pressed', String(selected));
    });
}

function renderCategoryList() {
    const container = $('category-list');

    if (!container) return;

    container.innerHTML = CATEGORIES.map(category => `
        <button
            type="button"
            data-category="${category.id}"
            class="w-full flex items-center gap-3 rounded-xl border border-transparent px-4 py-3 text-left text-sm font-semibold text-alagoinhas-800 dark:text-slate-200 hover:bg-alagoinhas-50 dark:hover:bg-white/5 transition-all"
        >
            <span class="w-9 h-9 rounded-xl bg-alagoinhas-100 dark:bg-white/5 text-alagoinhas-600 dark:text-alagoinhas-300 flex items-center justify-center">
                <i data-lucide="${category.icon}" class="w-4 h-4"></i>
            </span>
            <span class="flex-1">${escapeHtml(category.label)}</span>
            <i data-lucide="check" class="w-4 h-4 category-check ${category.id === activeCategory ? '' : 'hidden'}"></i>
        </button>
    `).join('');

    container.querySelectorAll('[data-category]').forEach(button => {
        button.addEventListener('click', () => {
            activeCategory = button.dataset.category;
            closeCategoryDrawer();
            renderEvents();
        });
    });

    refreshIcons();
}

function openCategoryDrawer() {
    $('category-drawer')?.classList.add('open');
}

function closeCategoryDrawer() {
    $('category-drawer')?.classList.remove('open');
}

/* ============================================
   DETALHES DO EVENTO
   ============================================ */

function openEventModal(id) {
    const eventItem = allEvents.find(
        item => String(item.id) === String(id)
    );

    if (!eventItem) return;

    const imageUrl = safeUrl(eventItem.image);
    const image = $('modal-img');

    if (image) {
        image.src = imageUrl;
        image.alt = eventItem.name || 'Foto do evento';
        image.classList.toggle('hidden', !imageUrl);
    }

    $('modal-title').textContent = eventItem.name || 'Evento';

    $('modal-date').innerHTML = `
        <i data-lucide="calendar-clock" class="w-4 h-4"></i>
        ${escapeHtml(formatDate(eventItem.date))}
    `;

    $('modal-desc').textContent =
        eventItem.description || 'Sem descrição disponível.';

    $('modal-price').textContent = formatPrice(eventItem);

    const category =
        CATEGORY_META[eventItem.category] ||
        CATEGORY_META.outros;

    const categoryBadge = $('modal-category');

    if (categoryBadge) {
        categoryBadge.innerHTML = `
            <span class="inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-xs font-bold text-alagoinhas-700 shadow">
                <i data-lucide="${category.icon}" class="w-4 h-4"></i>
                ${escapeHtml(category.label)}
            </span>
        `;

        categoryBadge.classList.remove('hidden');
    }

    const link = $('modal-link');
    const ticketUrl = safeUrl(eventItem.link);

    if (link) {
        if (eventItem.has_ticket && ticketUrl) {
            link.href = ticketUrl;
            link.classList.remove('hidden');
            link.classList.add('inline-flex');
            link.rel = 'noopener noreferrer';
        } else {
            link.removeAttribute('href');
            link.classList.add('hidden');
            link.classList.remove('inline-flex');
        }
    }

    $('modal')?.classList.remove('hidden');
    $('modal')?.classList.add('flex');

    document.body.classList.add('overflow-hidden');

    refreshIcons();
}

function closeEventModal() {
    $('modal')?.classList.add('hidden');
    $('modal')?.classList.remove('flex');

    document.body.classList.remove('overflow-hidden');
}

/* ============================================
   CALENDÁRIO DO MENU ☰
   ============================================ */

function openCalendarDrawer() {
    $('calendar-drawer')?.classList.add('open');
    $('calendar-drawer')?.setAttribute('aria-hidden', 'false');

    renderCalendar();
}

function closeCalendarDrawer() {
    $('calendar-drawer')?.classList.remove('open');
    $('calendar-drawer')?.setAttribute('aria-hidden', 'true');
}

function renderCalendar() {
    const title = $('calendar-month');
    const grid = $('calendar-grid');

    if (!title || !grid) return;

    title.textContent = calendarMonth.toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric'
    });

    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayKey = dateKey(new Date());

    const eventDays = new Set(
        allEvents.map(eventDateKey).filter(Boolean)
    );

    const cells = [];

    for (let i = 0; i < firstWeekday; i++) {
        cells.push(
            '<span class="calendar-day empty" aria-hidden="true"></span>'
        );
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const key = dateKey(date);
        const hasEvents = eventDays.has(key);

        const classes = [
            'calendar-day',
            key === selectedCalendarDate ? 'selected' : '',
            key === todayKey ? 'today' : ''
        ].filter(Boolean).join(' ');

        cells.push(`
            <button
                type="button"
                class="${classes}"
                data-calendar-date="${key}"
                aria-label="${day}${hasEvents ? ', tem eventos' : ''}"
                aria-pressed="${key === selectedCalendarDate}"
            >
                <span>${day}</span>
                ${
                    hasEvents
                        ? '<span class="event-dot" aria-hidden="true"></span>'
                        : '<span class="h-[5px]"></span>'
                }
            </button>
        `);
    }

    grid.innerHTML = cells.join('');

    grid.querySelectorAll('[data-calendar-date]').forEach(button => {
        button.addEventListener('click', () => {
            selectedCalendarDate = button.dataset.calendarDate;

            renderCalendar();
            renderCalendarEventsForDate(selectedCalendarDate);
        });
    });

    renderCalendarEventsForDate(selectedCalendarDate);
    refreshIcons();
}

function renderCalendarEventsForDate(key) {
    const list = $('calendar-event-list');
    const title = $('calendar-selected-title');
    const count = $('calendar-selected-count');

    if (!list) return;

    if (!key) {
        list.innerHTML = `
            <p class="py-4 text-slate-500">
                Selecione uma data no calendário.
            </p>
        `;

        if (title) title.textContent = 'Eventos do dia';
        if (count) count.textContent = '';

        return;
    }

    const events = allEvents
        .filter(eventItem => eventDateKey(eventItem) === key)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (title) {
        title.textContent = dateLabelFromKey(key);
    }

    if (count) {
        count.textContent = `${events.length} ${
            events.length === 1 ? 'evento' : 'eventos'
        }`;
    }

    if (!events.length) {
        list.innerHTML = `
            <p class="py-4 text-slate-500">
                Nenhum evento nesta data.
            </p>
        `;
        return;
    }

    list.innerHTML = events.map(eventItem => {
        const time = new Date(eventItem.date).toLocaleTimeString(
            'pt-BR',
            {
                hour: '2-digit',
                minute: '2-digit'
            }
        );

        const categoryLabel =
            CATEGORY_META[eventItem.category]?.label || 'Outros';

        return `
            <button
                type="button"
                class="calendar-event-row w-full text-left hover:bg-white/5 rounded-lg px-2 -mx-2"
                data-calendar-event="${escapeHtml(eventItem.id)}"
            >
                <span class="mt-1 w-2 h-2 rounded-full bg-blue-400 shrink-0"></span>
                <span class="min-w-0 flex-1">
                    <span class="block text-sm font-bold text-white">
                        ${escapeHtml(eventItem.name)}
                    </span>
                    <span class="block text-xs text-slate-400 mt-1">
                        ${time} · ${escapeHtml(categoryLabel)}
                    </span>
                </span>
                <i data-lucide="chevron-right" class="w-4 h-4 text-slate-500 mt-1"></i>
            </button>
        `;
    }).join('');

    list.querySelectorAll('[data-calendar-event]').forEach(button => {
        button.addEventListener('click', () => {
            closeCalendarDrawer();
            openEventModal(button.dataset.calendarEvent);
        });
    });

    refreshIcons();
}

/* ============================================
   LOGIN E CADASTRO
   ============================================ */

function openAuthModal(register = false) {
    isRegisterMode = Boolean(register);
    updateAuthModeUI();

    $('auth-modal')?.classList.remove('hidden');
    $('auth-modal')?.classList.add('flex');

    clearMessage($('auth-message'));
}

function closeAuthModal() {
    $('auth-modal')?.classList.add('hidden');
    $('auth-modal')?.classList.remove('flex');
}

function updateAuthModeUI() {
    const title = $('auth-title');
    const submit = $('auth-submit');
    const toggle = $('toggle-auth-mode');

    if (title) {
        title.textContent = isRegisterMode ? 'Criar conta' : 'Entrar';
    }

    if (submit) {
        submit.textContent = isRegisterMode ? 'Criar conta' : 'Entrar';
    }

    if (toggle) {
        toggle.textContent = isRegisterMode
            ? 'Já tem conta? Entrar'
            : 'Não tem conta? Criar uma';
    }
}

/* ============================================
   PERFIL DO USUÁRIO
   ============================================ */

async function getOrCreateProfile(user) {
    if (!user) return null;

    const metadata = user.user_metadata || {};

    const metadataName =
        metadata.full_name ||
        metadata.name ||
        user.email?.split('@')[0] ||
        'Usuário';

    const metadataAvatar =
        metadata.avatar_url ||
        metadata.picture ||
        null;

    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('id,name,avatar_url')
            .eq('id', user.id)
            .maybeSingle();

        if (error) throw error;

        if (data) {
            return {
                ...data,
                name:
                    metadata.full_name ||
                    metadata.name ||
                    data.name ||
                    metadataName,
                avatar_url:
                    metadataAvatar ||
                    data.avatar_url ||
                    null
            };
        }

        const newProfile = {
            id: user.id,
            name: metadataName,
            avatar_url: metadataAvatar
        };

        const { error: insertError } = await supabaseClient
            .from('profiles')
            .upsert(newProfile, {
                onConflict: 'id'
            });

        if (insertError) {
            console.warn(
                'Perfil será mantido nos metadados da conta:',
                insertError.message
            );
        }

        return newProfile;
    } catch (error) {
        console.warn(
            'Tabela profiles indisponível; usando metadados da conta:',
            error.message
        );

        return {
            id: user.id,
            name: metadataName,
            avatar_url: metadataAvatar
        };
    }
}

async function refreshUserUI() {
    const loggedIn = Boolean(currentUser);

    $('user-menu')?.classList.toggle('hidden', !loggedIn);
    $('login-button')?.classList.toggle('hidden', loggedIn);
    $('admin-link')?.classList.toggle('hidden', !isAdmin);

    if (!loggedIn) {
        currentProfile = null;
        $('user-dropdown')?.classList.add('hidden');
        return;
    }

    currentProfile = await getOrCreateProfile(currentUser);

    const displayName =
        currentProfile?.name ||
        currentUser.user_metadata?.full_name ||
        currentUser.user_metadata?.name ||
        currentUser.email?.split('@')[0] ||
        'Usuário';

    const avatarUrl = safeUrl(
        currentUser.user_metadata?.avatar_url ||
        currentUser.user_metadata?.picture ||
        currentProfile?.avatar_url ||
        ''
    );

    if ($('dropdown-name')) {
        $('dropdown-name').textContent = displayName;
    }

    if ($('dropdown-email')) {
        $('dropdown-email').textContent = currentUser.email || '';
    }

    const avatar = $('user-avatar');
    const avatarIcon = $('user-avatar-icon');

    if (avatar && avatarUrl) {
        avatar.onerror = () => {
            avatar.classList.add('hidden');
            avatar.removeAttribute('src');
            avatarIcon?.classList.remove('hidden');
        };

        avatar.onload = () => {
            avatarIcon?.classList.add('hidden');
        };

        avatar.src = avatarUrl;
        avatar.alt = `Foto de ${displayName}`;
        avatar.classList.remove('hidden');
        avatarIcon?.classList.add('hidden');
    } else {
        avatar?.classList.add('hidden');
        avatar?.removeAttribute('src');
        avatarIcon?.classList.remove('hidden');
    }

    try {
        const { data: adminData, error: adminError } = await supabaseClient
            .from('admins')
            .select('email')
            .eq('email', currentUser.email)
            .maybeSingle();

        isAdmin = !adminError && Boolean(adminData);
    } catch {
        isAdmin = false;
    }

    $('admin-link')?.classList.toggle('hidden', !isAdmin);

    refreshIcons();
}

function validateSelectedImage(file) {
    if (!file) {
        throw new Error('Selecione uma imagem.');
    }

    const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif'
    ];

    if (!allowedTypes.includes(file.type)) {
        throw new Error('Use uma imagem JPG, PNG, WEBP ou GIF.');
    }

    if (file.size > MAX_IMAGE_SIZE) {
        throw new Error('A imagem deve ter no máximo 5 MB.');
    }
}

async function uploadProfileImage(file) {
    if (!file) {
        return currentUser?.user_metadata?.avatar_url ||
            currentProfile?.avatar_url ||
            null;
    }

    validateSelectedImage(file);

    const extension = (file.name.split('.').pop() || 'jpg')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '') || 'jpg';

    const uniqueId = window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const path = `${currentUser.id}/${uniqueId}.${extension}`;

    const { error } = await supabaseClient.storage
        .from(IMAGE_BUCKET)
        .upload(path, file, {
            cacheControl: '3600',
            contentType: file.type,
            upsert: false
        });

    if (error) {
        throw new Error(
            `Não foi possível enviar a foto: ${error.message}`
        );
    }

    const { data } = supabaseClient
        .storage
        .from(IMAGE_BUCKET)
        .getPublicUrl(path);

    if (!data?.publicUrl) {
        throw new Error(
            'O Supabase não retornou o endereço da foto.'
        );
    }

    return data.publicUrl;
}

function openProfileModal() {
    if (!currentUser) {
        openAuthModal(false);
        return;
    }

    const nameInput = $('profile-name');

    if (nameInput) {
        nameInput.value =
            currentProfile?.name ||
            currentUser.user_metadata?.full_name ||
            currentUser.email?.split('@')[0] ||
            '';
    }

    const fileInput = $('profile-avatar');

    if (fileInput) {
        fileInput.value = '';
    }

    const preview = $('profile-preview');
    const icon = $('profile-icon');

    const avatarUrl = safeUrl(
        currentUser.user_metadata?.avatar_url ||
        currentUser.user_metadata?.picture ||
        currentProfile?.avatar_url ||
        ''
    );

    if (preview && avatarUrl) {
        preview.src = avatarUrl;
        preview.classList.remove('hidden');
        icon?.classList.add('hidden');
    } else {
        preview?.classList.add('hidden');
        preview?.removeAttribute('src');
        icon?.classList.remove('hidden');
    }

    clearMessage($('profile-message'));

    $('profile-modal')?.classList.remove('hidden');
    $('profile-modal')?.classList.add('flex');
}

function closeProfileModal() {
    $('profile-modal')?.classList.add('hidden');
    $('profile-modal')?.classList.remove('flex');

    if (profileImageObjectUrl) {
        URL.revokeObjectURL(profileImageObjectUrl);
    }

    profileImageObjectUrl = null;
}

window.closeProfileModal = closeProfileModal;

async function handleProfileSubmit(event) {
    event.preventDefault();

    if (!currentUser) {
        setMessage(
            $('profile-message'),
            'Entre na sua conta para editar o perfil.'
        );
        return;
    }

    const button = $('profile-submit');
    const file = $('profile-avatar')?.files?.[0] || null;
    const name = ($('profile-name')?.value || '').trim();

    if (!name) {
        setMessage($('profile-message'), 'Informe seu nome.');
        return;
    }

    button.disabled = true;
    button.textContent = 'Salvando...';

    try {
        const avatarUrl = await uploadProfileImage(file);

        const userMetadata = {
            ...currentUser.user_metadata,
            full_name: name,
            name,
            avatar_url: avatarUrl
        };

        const {
            data: authData,
            error: authError
        } = await supabaseClient.auth.updateUser({
            data: userMetadata
        });

        if (authError) {
            throw authError;
        }

        if (authData?.user) {
            currentUser = authData.user;
        }

        const profileData = {
            id: currentUser.id,
            name,
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString()
        };

        // Os metadados da conta já foram atualizados.
        // Esta gravação tenta sincronizar também a tabela profiles.
        const { error: profileError } = await supabaseClient
            .from('profiles')
            .upsert(profileData, {
                onConflict: 'id'
            });

        if (profileError) {
            console.warn(
                'Perfil salvo nos metadados; tabela profiles não sincronizada:',
                profileError.message
            );
        }

        currentProfile = profileData;

        await refreshUserUI();

        setMessage(
            $('profile-message'),
            'Perfil atualizado com sucesso!',
            'success'
        );

        setTimeout(closeProfileModal, 900);
    } catch (error) {
        console.error('Erro ao atualizar perfil:', error);

        setMessage(
            $('profile-message'),
            error.message || 'Não foi possível salvar seu perfil.'
        );
    } finally {
        button.disabled = false;
        button.textContent = 'Salvar Alterações';
    }
}

/* ============================================
   AUTENTICAÇÃO
   ============================================ */

async function handleAuthSubmit(event) {
    event.preventDefault();

    const email = ($('auth-email')?.value || '')
        .trim()
        .toLowerCase();

    const password = $('auth-password')?.value || '';
    const button = $('auth-submit');

    if (!email || !password) {
        setMessage(
            $('auth-message'),
            'Preencha o e-mail e a senha.'
        );
        return;
    }

    if (isRegisterMode && password.length < 6) {
        setMessage(
            $('auth-message'),
            'A senha precisa ter pelo menos 6 caracteres.'
        );
        return;
    }

    button.disabled = true;
    button.textContent = isRegisterMode
        ? 'Criando conta...'
        : 'Entrando...';

    clearMessage($('auth-message'));

    try {
        const result = isRegisterMode
            ? await supabaseClient.auth.signUp({
                email,
                password
            })
            : await supabaseClient.auth.signInWithPassword({
                email,
                password
            });

        if (result.error) {
            throw result.error;
        }

        if (isRegisterMode && !result.data.session) {
            setMessage(
                $('auth-message'),
                'Conta criada! Confira seu e-mail para confirmar o cadastro.',
                'success'
            );

            return;
        }

        closeAuthModal();
        $('auth-form')?.reset();
    } catch (error) {
        setMessage(
            $('auth-message'),
            error.message || 'Não foi possível autenticar.'
        );
    } finally {
        button.disabled = false;
        updateAuthModeUI();
    }
}

async function signInWithGoogle() {
    const button = $('google-login');

    if (button) {
        button.disabled = true;
    }

    try {
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.href.split('#')[0]
            }
        });

        if (error) {
            throw error;
        }
    } catch (error) {
        setMessage(
            $('auth-message'),
            error.message || 'Não foi possível entrar com Google.'
        );

        if (button) {
            button.disabled = false;
        }
    }
}

async function logoutUser() {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        alert(`Erro ao sair: ${error.message}`);
    }

    $('user-dropdown')?.classList.add('hidden');
}

/* ============================================
   EVENTOS DOS BOTÕES E DA PÁGINA
   ============================================ */

function setupPageEvents() {
    $('search')?.addEventListener('input', renderEvents);

    document.querySelectorAll('[data-quick-category]').forEach(button => {
        button.addEventListener('click', () => {
            activeCategory = button.dataset.quickCategory;
            renderEvents();
        });
    });

    $('menu-button')?.addEventListener(
        'click',
        openCalendarDrawer
    );

    $('calendar-close')?.addEventListener(
        'click',
        closeCalendarDrawer
    );

    $('calendar-backdrop')?.addEventListener(
        'click',
        closeCalendarDrawer
    );

    $('calendar-prev')?.addEventListener('click', () => {
        calendarMonth = new Date(
            calendarMonth.getFullYear(),
            calendarMonth.getMonth() - 1,
            1
        );

        selectedCalendarDate = dateKey(calendarMonth);

        renderCalendar();
    });

    $('calendar-next')?.addEventListener('click', () => {
        calendarMonth = new Date(
            calendarMonth.getFullYear(),
            calendarMonth.getMonth() + 1,
            1
        );

        selectedCalendarDate = dateKey(calendarMonth);

        renderCalendar();
    });

    $('category-drawer-btn')?.addEventListener(
        'click',
        openCategoryDrawer
    );

    $('close-category')?.addEventListener(
        'click',
        closeCategoryDrawer
    );

    $('category-backdrop')?.addEventListener(
        'click',
        closeCategoryDrawer
    );

    $('clear-category')?.addEventListener('click', () => {
        activeCategory = 'all';
        renderEvents();
    });

    $('close-modal')?.addEventListener(
        'click',
        closeEventModal
    );

    $('modal-backdrop')?.addEventListener(
        'click',
        closeEventModal
    );

    $('login-button')?.addEventListener(
        'click',
        () => openAuthModal(false)
    );

    $('toggle-auth-mode')?.addEventListener('click', () => {
        isRegisterMode = !isRegisterMode;
        updateAuthModeUI();
        clearMessage($('auth-message'));
    });

    $('auth-form')?.addEventListener(
        'submit',
        handleAuthSubmit
    );

    $('google-login')?.addEventListener(
        'click',
        signInWithGoogle
    );

    $('user-button')?.addEventListener('click', event => {
        event.stopPropagation();
        $('user-dropdown')?.classList.toggle('hidden');
    });

    $('user-dropdown')?.addEventListener('click', event => {
        event.stopPropagation();
    });

    document.addEventListener('click', () => {
        $('user-dropdown')?.classList.add('hidden');
    });

    $('edit-profile-button')?.addEventListener('click', () => {
        $('user-dropdown')?.classList.add('hidden');
        openProfileModal();
    });

    $('logout-button')?.addEventListener(
        'click',
        logoutUser
    );

    $('profile-form')?.addEventListener(
        'submit',
        handleProfileSubmit
    );

    $('profile-avatar')?.addEventListener('change', event => {
        const file = event.target.files?.[0];

        if (!file) return;

        try {
            validateSelectedImage(file);
        } catch (error) {
            event.target.value = '';

            setMessage(
                $('profile-message'),
                error.message
            );

            return;
        }

        if (profileImageObjectUrl) {
            URL.revokeObjectURL(profileImageObjectUrl);
        }

        profileImageObjectUrl = URL.createObjectURL(file);

        const preview = $('profile-preview');

        if (preview) {
            preview.src = profileImageObjectUrl;
            preview.classList.remove('hidden');
        }

        $('profile-icon')?.classList.add('hidden');
        clearMessage($('profile-message'));
    });

    $('auth-modal')?.addEventListener('click', event => {
        const modal = $('auth-modal');

        if (
            event.target === modal ||
            event.target === modal.firstElementChild
        ) {
            closeAuthModal();
        }
    });

    $('profile-modal')?.addEventListener('click', event => {
        const modal = $('profile-modal');

        if (
            event.target === modal ||
            event.target === modal.firstElementChild
        ) {
            closeProfileModal();
        }
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            closeCalendarDrawer();
            closeCategoryDrawer();
            closeEventModal();
            closeAuthModal();
            closeProfileModal();
        }
    });

    const footerYear = $('footer-year');

    if (footerYear) {
        footerYear.textContent = new Date().getFullYear();
    }
}

/* ============================================
   SESSÃO E INICIALIZAÇÃO
   ============================================ */

async function handleAuthState() {
    const {
        data,
        error
    } = await supabaseClient.auth.getSession();

    if (error) {
        console.warn(
            'Não foi possível recuperar a sessão:',
            error.message
        );
    }

    currentUser = data?.session?.user || null;

    await refreshUserUI();

    supabaseClient.auth.onAuthStateChange((_event, session) => {
        currentUser = session?.user || null;
        isAdmin = false;

        setTimeout(() => {
            refreshUserUI().catch(error => {
                console.warn(
                    'Erro ao atualizar sessão:',
                    error
                );
            });
        }, 0);
    });
}

async function initializeApp() {
    setupPageEvents();
    renderCategoryList();
    refreshIcons();

    if (
        typeof supabaseClient === 'undefined' ||
        !supabaseClient
    ) {
        showLoadingMessage(
            'Configuração do Supabase não encontrada. Confira o arquivo supabase-config.js.'
        );

        window.hideLoadingScreen?.();
        return;
    }

    await Promise.all([
        loadEvents(),
        handleAuthState()
    ]);
}

document.addEventListener(
    'DOMContentLoaded',
    initializeApp
);