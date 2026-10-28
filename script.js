/* Eventos em Alagoinhas — interface, eventos, autenticação e notificações */
(() => {
  'use strict';

  const CATEGORY_META = {
    shows: { label: 'Shows e Música', icon: 'mic-2' },
    festas: { label: 'Festas e Forró', icon: 'party-popper' },
    cultura: { label: 'Cultura e Arte', icon: 'palette' },
    esportes: { label: 'Esportes', icon: 'trophy' },
    gastronomia: { label: 'Gastronomia', icon: 'utensils' },
    infantil: { label: 'Infantil', icon: 'baby' },
    religioso: { label: 'Religioso', icon: 'church' },
    outros: { label: 'Outros', icon: 'tag' }
  };

  const IMAGE_BUCKET = 'alagoinhas-images';
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const EVENT_TIME_ZONE = 'America/Bahia';
  const FEATURED_INTERVAL_MS = 5500;
  const supabaseClient = window.supabaseClient || null;

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

  function localDateKey(value = new Date()) {
    // Uma string YYYY-MM-DD já é uma data de calendário; não a interprete como UTC.
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = value instanceof Date ? value : new Date(value);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: EVENT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function firstDayOfBahiaMonth(value = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: EVENT_TIME_ZONE, year: 'numeric', month: '2-digit'
    }).formatToParts(value);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return new Date(Number(values.year), Number(values.month) - 1, 1);
  }

  const state = {
    events: [],
    visibleEvents: [],
    selectedCategory: 'all',
    search: '',
    featuredIndex: 0,
    featuredTimer: null,
    session: null,
    user: null,
    authMode: 'login',
    calendarDate: firstDayOfBahiaMonth(),
    eventLifecycleTimer: null,
    selectedCalendarDate: localDateKey(),
    notificationKnownIds: new Set(),
    notificationChannel: null,
    notificationPolling: null,
    profileObjectUrl: null,
    loadingFailed: false
  };

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value || ''), window.location.href);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function parseEventDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function getEventEnd(eventItem) {
    return parseEventDate(eventItem.end_date || eventItem.date);
  }

  function isEventPast(eventItem, now = Date.now()) {
    const end = getEventEnd(eventItem);
    return Boolean(end && end.getTime() < now);
  }

  function isEventExpired(eventItem, now = Date.now()) {
    const end = getEventEnd(eventItem);
    return Boolean(end && now > end.getTime() + THREE_DAYS_MS);
  }

  function formatDate(value, options = {}) {
    const date = parseEventDate(value);
    if (!date) return 'Data não informada';
    const formatOptions = {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: EVENT_TIME_ZONE,
      ...options
    };
    return new Intl.DateTimeFormat('pt-BR', formatOptions).format(date);
  }

  function formatTimeRange(eventItem) {
    const start = parseEventDate(eventItem.date);
    const end = parseEventDate(eventItem.end_date);
    if (!start) return 'Data não informada';
    const day = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: EVENT_TIME_ZONE }).format(start);
    const startTime = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: EVENT_TIME_ZONE }).format(start);
    const startDateKey = localDateKey(start);
    const endDateKey = end ? localDateKey(end) : '';
    if (!end || startDateKey !== endDateKey) return `${day} · ${startTime}`;
    const endTime = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: EVENT_TIME_ZONE }).format(end);
    return `${day} · ${startTime}–${endTime}`;
  }

  function showLoadingScreen() {
    $('#loading-screen')?.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
  }

  function hideLoadingScreen() {
    const loading = $('#loading-screen');
    if (!loading) return;
    loading.classList.add('opacity-0', 'pointer-events-none');
    window.setTimeout(() => loading.classList.add('hidden'), 450);
  }
  window.hideLoadingScreen = hideLoadingScreen;
  window.closeAuthModal = () => closeModal($('#auth-modal'));
  window.closeProfileModal = () => closeModal($('#profile-modal'));

  function showNotice(message, kind = 'info') {
    let notice = $('#site-notice');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'site-notice';
      notice.className = 'site-notice';
      notice.setAttribute('role', 'status');
      notice.setAttribute('aria-live', 'polite');
      document.body.appendChild(notice);
    }
    notice.dataset.kind = kind;
    notice.textContent = message;
    notice.classList.add('visible');
    window.clearTimeout(notice._hideTimer);
    notice._hideTimer = window.setTimeout(() => notice.classList.remove('visible'), 4200);
  }

  function categoryMatches(eventItem, selected) {
    if (selected === 'all') return true;
    const category = String(eventItem.category || 'outros').toLowerCase();
    const grouped = {
      'shows-festas': ['shows', 'festas'],
      'esportes-saude': ['esportes'],
      cultura: ['cultura'], gastronomia: ['gastronomia'], infantil: ['infantil'],
      religioso: ['religioso'], outros: ['outros']
    };
    return (grouped[selected] || [selected]).includes(category);
  }

  function renderEventCard(eventItem, { featured = false } = {}) {
    const category = CATEGORY_META[eventItem.category] || CATEGORY_META.outros;
    const image = safeUrl(eventItem.image) || 'perfil.png';
    const past = isEventPast(eventItem);
    const priceLabel = eventItem.has_ticket
      ? `R$ ${Number(eventItem.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : 'Gratuito';
    const description = String(eventItem.description || 'Confira os detalhes deste evento.');
    return `
      <article class="event-card${past ? ' is-past' : ''}${featured ? ' is-featured' : ''}" data-event-id="${escapeHtml(eventItem.id)}" tabindex="0" role="button" aria-label="Ver detalhes de ${escapeHtml(eventItem.name)}">
        <div class="event-image-wrap">
          <img class="event-image" src="${escapeHtml(image)}" alt="Imagem do evento ${escapeHtml(eventItem.name)}" loading="lazy" onerror="this.onerror=null;this.src='perfil.png'">
        </div>
        <div class="event-content">
          ${past ? '<span class="past-event-badge"><i data-lucide="check-circle-2"></i> Já aconteceu</span>' : ''}
          <div class="event-meta"><span><i data-lucide="calendar-days"></i>${escapeHtml(formatTimeRange(eventItem))}</span><span><i data-lucide="tag"></i>${escapeHtml(category.label)}</span></div>
          <h3 class="event-title">${escapeHtml(eventItem.name || 'Evento sem título')}</h3>
          <p class="event-desc">${escapeHtml(description)}</p>
          <div class="event-card-footer"><span class="event-price ${eventItem.has_ticket ? '' : 'is-free'}"><i data-lucide="${eventItem.has_ticket ? 'ticket' : 'gift'}"></i>${escapeHtml(priceLabel)}</span><span class="event-details-link">Detalhes <i data-lucide="arrow-up-right"></i></span></div>
        </div>
      </article>`;
  }

  function eventCardListener(container) {
    $$('[data-event-id]', container).forEach(card => {
      const open = () => openEventModal(card.dataset.eventId);
      card.addEventListener('click', open);
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      });
    });
  }

  function renderEvents() {
    const allEvents = state.events.filter(eventItem => !isEventExpired(eventItem));
    const filtered = allEvents.filter(eventItem => {
      const matchesCategory = categoryMatches(eventItem, state.selectedCategory);
      const haystack = `${eventItem.name || ''} ${eventItem.description || ''} ${eventItem.category || ''}`.toLocaleLowerCase('pt-BR');
      return matchesCategory && (!state.search || haystack.includes(state.search.toLocaleLowerCase('pt-BR')));
    });
    state.visibleEvents = filtered;
    const eventsContainer = $('#events');
    if (eventsContainer) {
      eventsContainer.innerHTML = filtered.length
        ? filtered.map(eventItem => renderEventCard(eventItem)).join('')
        : `<div class="empty-events col-span-full"><i data-lucide="calendar-search"></i><h3>Nenhum evento encontrado</h3><p>Tente mudar a busca ou selecionar outra categoria.</p></div>`;
      eventCardListener(eventsContainer);
    }
    const pill = $('#active-category-pill');
    if (pill) {
      const categoryButton = $(`[data-quick-category="${CSS.escape(state.selectedCategory)}"]`);
      if (state.selectedCategory !== 'all' && categoryButton) {
        pill.classList.remove('hidden');
        pill.classList.add('flex');
        $('#active-category-text').textContent = categoryButton.textContent.trim();
      } else {
        pill.classList.add('hidden');
        pill.classList.remove('flex');
      }
    }
    $$('.quick-category').forEach(button => {
      const active = button.dataset.quickCategory === state.selectedCategory;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    renderFeatured();
    renderCalendar();
    refreshIcons();
  }

  function renderFeatured() {
    const track = $('#featured-events');
    const dots = $('#featured-dots');
    const section = $('#featured-section');
    if (!track || !dots || !section) return;
    const now = Date.now();
    const upcoming = state.events
      .filter(eventItem => !isEventExpired(eventItem) && !isEventPast(eventItem, now))
      .sort((a, b) => (parseEventDate(a.date)?.getTime() ?? Infinity) - (parseEventDate(b.date)?.getTime() ?? Infinity))
      .slice(0, 6);

    if (!upcoming.length) {
      section.classList.add('hidden');
      track.innerHTML = '';
      dots.innerHTML = '';
      stopFeaturedCarousel();
      return;
    }
    section.classList.remove('hidden');
    state.featuredIndex = Math.min(state.featuredIndex, upcoming.length - 1);
    track.innerHTML = upcoming.map(eventItem => renderEventCard(eventItem, { featured: true })).join('');
    track.style.transform = `translateX(-${state.featuredIndex * 100}%)`;
    dots.innerHTML = upcoming.map((eventItem, index) => `<button class="featured-dot" type="button" data-featured-index="${index}" aria-label="Mostrar destaque ${index + 1}: ${escapeHtml(eventItem.name)}" aria-current="${index === state.featuredIndex ? 'true' : 'false'}"></button>`).join('');
    $$('[data-featured-index]', dots).forEach(button => button.addEventListener('click', () => {
      state.featuredIndex = Number(button.dataset.featuredIndex);
      updateFeaturedPosition();
      restartFeaturedCarousel();
    }));
    eventCardListener(track);
    track.querySelectorAll('img').forEach(img => { img.draggable = false; });
    refreshIcons();
    restartFeaturedCarousel();
  }

  function updateFeaturedPosition() {
    const track = $('#featured-events');
    if (!track) return;
    const count = track.children.length;
    if (!count) return;
    state.featuredIndex = ((state.featuredIndex % count) + count) % count;
    track.style.transform = `translateX(-${state.featuredIndex * 100}%)`;
    $$('[data-featured-index]').forEach((dot, index) => {
      dot.setAttribute('aria-current', String(index === state.featuredIndex));
    });
  }

  function stopFeaturedCarousel() {
    if (state.featuredTimer) window.clearInterval(state.featuredTimer);
    state.featuredTimer = null;
  }

  function restartFeaturedCarousel() {
    stopFeaturedCarousel();
    if ($('#featured-events')?.children.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    state.featuredTimer = window.setInterval(() => {
      state.featuredIndex += 1;
      updateFeaturedPosition();
    }, FEATURED_INTERVAL_MS);
  }

  function showModal(modal) {
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.classList.add('modal-open');
    refreshIcons();
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    if (!$('.fixed.inset-0:not(.hidden)[role="dialog"]')) document.body.classList.remove('modal-open');
  }

  function openEventModal(id) {
    const eventItem = state.events.find(item => String(item.id) === String(id));
    if (!eventItem) return;
    $('#modal-title').textContent = eventItem.name || 'Evento';
    $('#modal-date').innerHTML = `<i data-lucide="calendar-clock" class="w-4 h-4"></i>${escapeHtml(formatTimeRange(eventItem))}`;
    $('#modal-desc').textContent = eventItem.description || 'Não há descrição disponível para este evento.';
    $('#modal-img').src = safeUrl(eventItem.image) || 'perfil.png';
    $('#modal-img').alt = `Imagem do evento ${eventItem.name || ''}`;
    const category = CATEGORY_META[eventItem.category] || CATEGORY_META.outros;
    $('#modal-category').textContent = category.label;
    $('#modal-category').classList.remove('hidden');
    $('#modal-price').textContent = eventItem.has_ticket
      ? `Ingresso: R$ ${Number(eventItem.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : 'Evento gratuito';
    const link = $('#modal-link');
    const safeTicketLink = safeUrl(eventItem.link);
    if (safeTicketLink && eventItem.has_ticket) {
      link.href = safeTicketLink;
      link.classList.remove('hidden');
      link.classList.add('inline-flex');
    } else {
      link.removeAttribute('href');
      link.classList.add('hidden');
      link.classList.remove('inline-flex');
    }
    let pastBadge = $('#modal-past-badge');
    if (!pastBadge && $('#modal-title')) {
      pastBadge = document.createElement('span');
      pastBadge.id = 'modal-past-badge';
      pastBadge.className = 'past-event-badge mb-4';
      $('#modal-title').parentElement.insertBefore(pastBadge, $('#modal-title'));
    }
    if (pastBadge) {
      pastBadge.innerHTML = '<i data-lucide="check-circle-2"></i> Já aconteceu';
      pastBadge.classList.toggle('hidden', !isEventPast(eventItem));
    }
    showModal($('#modal'));
  }

  function openDrawer(id) {
    const drawer = $(id);
    if (!drawer) return;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('drawer-open');
  }

  function closeDrawer(id) {
    const drawer = $(id);
    if (!drawer) return;
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    if (!$('.fixed.inset-0.open')) document.body.classList.remove('drawer-open');
  }

  function renderCategoryDrawer() {
    const container = $('#category-list');
    if (!container) return;
    const items = [
      ['all', 'Todos os eventos', 'calendar-days'], ['shows-festas', 'Shows & Festas', 'music'],
      ['esportes-saude', 'Esportes & Saúde', 'trophy'], ['cultura', 'Cultura', 'palette'],
      ['gastronomia', 'Gastronomia', 'utensils'], ['infantil', 'Infantil', 'baby'],
      ['religioso', 'Religioso', 'church'], ['outros', 'Outros', 'shapes']
    ];
    container.innerHTML = items.map(([key, label, icon]) => `<button type="button" class="category-drawer-option${state.selectedCategory === key ? ' active' : ''}" data-drawer-category="${key}"><i data-lucide="${icon}"></i><span>${label}</span><i data-lucide="arrow-right"></i></button>`).join('');
    $$('[data-drawer-category]', container).forEach(button => button.addEventListener('click', () => {
      state.selectedCategory = button.dataset.drawerCategory;
      renderEvents();
      closeDrawer('#category-drawer');
      window.scrollTo({ top: $('#quick-categories')?.offsetTop || 0, behavior: 'smooth' });
    }));
    refreshIcons();
  }

  async function loadEvents({ notifyNew = false } = {}) {
    const container = $('#events');
    if (!supabaseClient) {
      state.loadingFailed = true;
      if (container) container.innerHTML = '<div class="empty-events col-span-full"><i data-lucide="settings-2"></i><h3>Configure a conexão do Supabase</h3><p>Abra <code>supabase-config.js</code> e preencha a URL e a chave pública do seu projeto para carregar os eventos.</p></div>';
      renderFeatured();
      refreshIcons();
      return;
    }
    if (container && !state.events.length) container.innerHTML = '<div class="loading-events"><span class="loading-spinner"></span><p>Carregando eventos...</p></div>';
    try {
      const { data, error } = await supabaseClient.from('events').select('*').order('date', { ascending: true });
      if (error) throw error;
      const all = Array.isArray(data) ? data : [];
      if (notifyNew) {
        all.forEach(eventItem => {
          if (!state.notificationKnownIds.has(String(eventItem.id))) {
            state.notificationKnownIds.add(String(eventItem.id));
            dispatchEventNotification(eventItem);
          }
        });
      } else {
        all.forEach(eventItem => state.notificationKnownIds.add(String(eventItem.id)));
      }
      state.events = all.filter(eventItem => !isEventExpired(eventItem));
      renderEvents();
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
      if (container) container.innerHTML = `<div class="empty-events col-span-full"><i data-lucide="cloud-off"></i><h3>Não foi possível carregar os eventos</h3><p>${escapeHtml(error.message || 'Verifique a conexão com o Supabase.')}</p><button type="button" id="retry-load-events" class="retry-button">Tentar novamente</button></div>`;
      $('#retry-load-events')?.addEventListener('click', () => loadEvents());
      refreshIcons();
    }
  }

  function initEventLifecycle() {
    if (state.eventLifecycleTimer) window.clearInterval(state.eventLifecycleTimer);
    const wasPast = new Map(state.events.map(item => [String(item.id), isEventPast(item)]));

    // Mantém o selo cinza atualizado quando o evento termina e oculta itens após 3 dias.
    state.eventLifecycleTimer = window.setInterval(() => {
      const beforeCount = state.events.length;
      state.events = state.events.filter(item => !isEventExpired(item));
      let shouldRender = state.events.length !== beforeCount;
      const remainingIds = new Set(state.events.map(item => String(item.id)));

      for (const [id] of wasPast) {
        if (!remainingIds.has(id)) wasPast.delete(id);
      }
      for (const item of state.events) {
        const id = String(item.id);
        const currentPast = isEventPast(item);
        if (wasPast.has(id) && wasPast.get(id) !== currentPast) shouldRender = true;
        wasPast.set(id, currentPast);
      }
      if (shouldRender) renderEvents();
    }, 30_000);
  }

  function updateThemeUI() {
    const isDark = document.documentElement.classList.contains('dark');
    $('#light-theme')?.classList.toggle('bg-alagoinhas-100', !isDark);
    $('#dark-theme')?.classList.toggle('bg-alagoinhas-100', isDark);
  }

  function setTheme(theme) {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme === 'dark' ? 'dark' : 'light');
    updateThemeUI();
    refreshIcons();
  }

  function initThemeAndSettings() {
    const savedTheme = localStorage.getItem('theme');
    setTheme(savedTheme || 'dark');
    const wrapper = $('#settings-wrapper');
    $('#settings-button')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      wrapper?.classList.toggle('open');
    });
    $('#settings-menu')?.addEventListener('click', event => event.stopPropagation());
    document.addEventListener('click', () => wrapper?.classList.remove('open'));
    $('#light-theme')?.addEventListener('click', () => { setTheme('light'); wrapper?.classList.remove('open'); });
    $('#dark-theme')?.addEventListener('click', () => { setTheme('dark'); wrapper?.classList.remove('open'); });
  }

  function updateAuthUI() {
    const loggedIn = Boolean(state.user);
    $('#login-button')?.classList.toggle('hidden', loggedIn);
    $('#user-menu')?.classList.toggle('hidden', !loggedIn);
    $('#user-dropdown')?.classList.add('hidden');
    const user = state.user;
    if (user) {
      const metadata = user.user_metadata || {};
      const name = metadata.full_name || metadata.name || user.email?.split('@')[0] || 'Usuário';
      const avatar = safeUrl(metadata.avatar_url || metadata.picture) || 'perfil.png';
      $('#dropdown-name').textContent = name;
      $('#dropdown-email').textContent = user.email || '';
      const img = $('#user-avatar');
      if (img) { img.src = avatar; img.alt = `Foto de perfil de ${name}`; img.classList.remove('hidden'); }
      $('#user-avatar-icon')?.classList.add('hidden');
      $('#profile-name').value = name;
      const preview = $('#profile-preview');
      if (preview) { preview.src = avatar; preview.classList.remove('hidden'); }
      $('#profile-icon')?.classList.add('hidden');
    } else {
      const img = $('#user-avatar');
      if (img) { img.src = 'perfil.png'; img.classList.remove('hidden'); }
      $('#user-avatar-icon')?.classList.add('hidden');
    }
    refreshIcons();
    checkAdminAccess();
  }

  async function checkAdminAccess() {
    const adminLink = $('#admin-link');
    if (!adminLink || !supabaseClient || !state.user?.email) {
      adminLink?.classList.add('hidden');
      return;
    }
    try {
      const { data, error } = await supabaseClient.from('admins').select('email').eq('email', state.user.email).maybeSingle();
      adminLink.classList.toggle('hidden', Boolean(error || !data));
    } catch (_) {
      adminLink.classList.add('hidden');
    }
  }

  function openAuthModal(mode = 'login') {
    state.authMode = mode;
    updateAuthModeUI();
    showModal($('#auth-modal'));
    $('#auth-message')?.classList.add('hidden');
  }

  function updateAuthModeUI() {
    const register = state.authMode === 'register';
    $('#auth-title').textContent = register ? 'Criar conta' : 'Entrar';
    $('#auth-submit').textContent = register ? 'Criar conta' : 'Entrar';
    $('#toggle-auth-mode').textContent = register ? 'Já tem conta? Entrar' : 'Não tem conta? Criar uma';
  }

  function showAuthMessage(message, type = 'error') {
    const element = $('#auth-message');
    if (!element) return;
    element.textContent = message;
    element.className = `text-sm font-semibold p-3 rounded-xl ${type === 'success' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'}`;
  }

  function initAuth() {
    $('#login-button')?.addEventListener('click', () => openAuthModal('login'));
    $('#close-auth-modal')?.addEventListener('click', () => closeModal($('#auth-modal')));
    $('#auth-modal')?.addEventListener('click', event => { if (event.target === $('#auth-modal') || event.target.matches('[data-close-auth]')) closeModal($('#auth-modal')); });
    $('#toggle-auth-mode')?.addEventListener('click', () => {
      state.authMode = state.authMode === 'login' ? 'register' : 'login';
      updateAuthModeUI();
      $('#auth-message')?.classList.add('hidden');
    });
    $('#auth-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      if (!supabaseClient) return showAuthMessage('Configure a conexão do Supabase em supabase-config.js.');
      const submit = $('#auth-submit');
      const email = $('#auth-email').value.trim();
      const password = $('#auth-password').value;
      submit.disabled = true;
      submit.textContent = state.authMode === 'register' ? 'Criando conta...' : 'Entrando...';
      try {
        if (state.authMode === 'register') {
          const { data, error } = await supabaseClient.auth.signUp({ email, password });
          if (error) throw error;
          if (!data.session) {
            showAuthMessage('Conta criada. Verifique seu e-mail para confirmar o cadastro.', 'success');
          } else {
            closeModal($('#auth-modal'));
            showNotice('Conta criada com sucesso!', 'success');
          }
        } else {
          const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
          if (error) throw error;
          closeModal($('#auth-modal'));
          showNotice('Login realizado com sucesso.', 'success');
        }
      } catch (error) {
        showAuthMessage(error.message || 'Não foi possível autenticar sua conta.');
      } finally {
        submit.disabled = false;
        updateAuthModeUI();
      }
    });
    $('#google-login')?.addEventListener('click', async () => {
      if (!supabaseClient) return showAuthMessage('Configure a conexão do Supabase em supabase-config.js.');
      try {
        const { error } = await supabaseClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}${window.location.pathname}` } });
        if (error) throw error;
      } catch (error) { showAuthMessage(error.message || 'Não foi possível entrar com Google.'); }
    });
    $('#logout-button')?.addEventListener('click', async () => {
      if (!supabaseClient) return;
      const { error } = await supabaseClient.auth.signOut();
      if (error) showNotice(error.message, 'error');
      else showNotice('Você saiu da sua conta.', 'success');
    });
    $('#user-button')?.addEventListener('click', event => {
      event.stopPropagation();
      $('#user-dropdown')?.classList.toggle('hidden');
    });
    $('#user-dropdown')?.addEventListener('click', event => event.stopPropagation());
    document.addEventListener('click', () => $('#user-dropdown')?.classList.add('hidden'));
    $('#edit-profile-button')?.addEventListener('click', () => {
      $('#user-dropdown')?.classList.add('hidden');
      $('#profile-message')?.classList.add('hidden');
      $('#profile-avatar').value = '';
      const avatar = safeUrl(state.user?.user_metadata?.avatar_url || state.user?.user_metadata?.picture) || 'perfil.png';
      $('#profile-preview').src = avatar;
      $('#profile-preview').classList.remove('hidden');
      $('#profile-icon')?.classList.add('hidden');
      showModal($('#profile-modal'));
    });
    $('#close-profile-modal')?.addEventListener('click', () => closeModal($('#profile-modal')));
    $('#profile-modal')?.addEventListener('click', event => { if (event.target === $('#profile-modal') || event.target.matches('[data-close-profile]')) closeModal($('#profile-modal')); });
    $('#profile-avatar')?.addEventListener('change', event => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024) {
        event.target.value = '';
        showProfileMessage('Escolha JPG, PNG, WEBP ou GIF de até 5 MB.', 'error');
        return;
      }
      if (state.profileObjectUrl) URL.revokeObjectURL(state.profileObjectUrl);
      state.profileObjectUrl = URL.createObjectURL(file);
      $('#profile-preview').src = state.profileObjectUrl;
      $('#profile-preview').classList.remove('hidden');
    });
    $('#profile-form')?.addEventListener('submit', saveProfile);
    if (supabaseClient) {
      supabaseClient.auth.getSession().then(({ data, error }) => {
        if (error) console.warn('Não foi possível recuperar a sessão:', error.message);
        state.session = data?.session || null;
        state.user = state.session?.user || null;
        updateAuthUI();
      }).catch(error => console.error(error));
      supabaseClient.auth.onAuthStateChange((_event, session) => {
        state.session = session || null;
        state.user = session?.user || null;
        updateAuthUI();
      });
    }
  }

  function showProfileMessage(message, type = 'error') {
    const element = $('#profile-message');
    if (!element) return;
    element.textContent = message;
    element.className = `text-sm font-semibold p-3 rounded-xl ${type === 'success' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'}`;
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!supabaseClient || !state.user) return showProfileMessage('Entre na sua conta antes de editar o perfil.');
    const submit = $('#profile-submit');
    submit.disabled = true;
    const original = submit.textContent;
    submit.textContent = 'Salvando...';
    try {
      const fullName = $('#profile-name').value.trim();
      const file = $('#profile-avatar').files?.[0];
      const updates = { full_name: fullName };
      if (file) {
        const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
        const path = `profiles/${state.user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabaseClient.storage.from(IMAGE_BUCKET).upload(path, file, { upsert: true, cacheControl: '3600', contentType: file.type });
        if (uploadError) throw new Error(`Não foi possível enviar a foto: ${uploadError.message}`);
        const { data } = supabaseClient.storage.from(IMAGE_BUCKET).getPublicUrl(path);
        if (data?.publicUrl) updates.avatar_url = data.publicUrl;
      }
      const { data, error } = await supabaseClient.auth.updateUser({ data: updates });
      if (error) throw error;
      state.user = data.user || state.user;
      updateAuthUI();
      closeModal($('#profile-modal'));
      showNotice('Perfil atualizado.', 'success');
    } catch (error) {
      showProfileMessage(error.message || 'Não foi possível salvar as alterações.');
    } finally {
      submit.disabled = false;
      submit.textContent = original;
    }
  }

  function notificationEnabled() {
    return localStorage.getItem('event-notifications') === 'true';
  }

  function updateNotificationUI() {
    const enabled = notificationEnabled();
    const button = $('#event-notifications-toggle');
    if (button) button.setAttribute('aria-pressed', String(enabled));
    const label = $('#event-notifications-label');
    if (label) label.textContent = enabled ? 'Avisos de eventos ativados' : 'Ativar avisos de eventos';
    button?.classList.toggle('is-enabled', enabled);
  }

  async function toggleEventNotifications() {
    if (notificationEnabled()) {
      localStorage.setItem('event-notifications', 'false');
      stopNotificationListening();
      updateNotificationUI();
      showNotice('Avisos de eventos desativados.');
      return;
    }
    if (!('Notification' in window)) {
      showNotice('Este navegador não oferece notificações.', 'error');
      return;
    }
    let permission = Notification.permission;
    try {
      if (permission === 'default') permission = await Notification.requestPermission();
    } catch (error) {
      console.warn('Não foi possível solicitar permissão para notificações:', error);
      showNotice('O navegador não permitiu solicitar notificações. Confira as permissões do site.', 'error');
      updateNotificationUI();
      return;
    }
    if (permission !== 'granted') {
      showNotice('Permita notificações nas configurações do navegador para ativar os avisos.', 'error');
      updateNotificationUI();
      return;
    }
    state.events.forEach(item => state.notificationKnownIds.add(String(item.id)));
    localStorage.setItem('event-notifications', 'true');
    updateNotificationUI();
    startNotificationListening();
    showNotice('Avisos de novos eventos ativados.', 'success');
  }

  function dispatchEventNotification(eventItem) {
    if (!notificationEnabled() || !('Notification' in window) || Notification.permission !== 'granted') return;
    {
      try {
        const notification = new Notification('Novo evento em Alagoinhas', {
          body: `${eventItem.name || 'Novo evento'} · ${formatTimeRange(eventItem)}`,
          icon: 'perfil.png',
          tag: `event-${eventItem.id}`,
          data: { eventId: eventItem.id }
        });
        notification.onclick = () => {
          window.focus();
          openEventModal(eventItem.id);
          notification.close();
        };
      } catch (error) { console.warn('Não foi possível exibir a notificação:', error); }
    }
  }

  function startNotificationListening() {
    stopNotificationListening();
    if (!supabaseClient || !notificationEnabled()) return;
    try {
      state.notificationChannel = supabaseClient.channel('agenda-event-notifications')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, payload => {
          const eventItem = payload.new;
          if (!eventItem?.id) return;
          const id = String(eventItem.id);
          if (state.notificationKnownIds.has(id)) return;
          state.notificationKnownIds.add(id);
          state.events.push(eventItem);
          state.events = state.events.filter(item => !isEventExpired(item));
          renderEvents();
          dispatchEventNotification(eventItem);
        })
        .subscribe(status => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn('Notificações em tempo real indisponíveis; usando consulta periódica.');
        });
    } catch (error) { console.warn('Realtime indisponível:', error); }
    state.notificationPolling = window.setInterval(() => loadEvents({ notifyNew: true }), 60000);
  }

  function stopNotificationListening() {
    if (state.notificationChannel && supabaseClient) {
      supabaseClient.removeChannel(state.notificationChannel).catch(() => {});
    }
    state.notificationChannel = null;
    if (state.notificationPolling) window.clearInterval(state.notificationPolling);
    state.notificationPolling = null;
  }

  function initNotifications() {
    updateNotificationUI();
    $('#event-notifications-toggle')?.addEventListener('click', toggleEventNotifications);
    if (notificationEnabled()) startNotificationListening();
  }

  function renderCalendar() {
    const grid = $('#calendar-grid');
    if (!grid) return;
    const year = state.calendarDate.getFullYear();
    const month = state.calendarDate.getMonth();
    const first = new Date(year, month, 1);
    const days = new Date(year, month + 1, 0).getDate();
    const startOffset = (first.getDay() + 6) % 7;
    const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(first);
    $('#calendar-month').textContent = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
    const weekNames = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
    const cells = weekNames.map(day => `<div class="calendar-weekday">${day}</div>`);
    for (let i = 0; i < startOffset; i++) cells.push('<div class="calendar-day is-empty"></div>');
    const eventDates = new Set(state.events.filter(item => !isEventExpired(item)).map(item => {
      const d = parseEventDate(item.date);
      return d ? localDateKey(d) : '';
    }));
    for (let day = 1; day <= days; day++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isSelected = dateKey === state.selectedCalendarDate;
      const hasEvent = eventDates.has(dateKey);
      cells.push(`<button type="button" class="calendar-day${isSelected ? ' selected' : ''}${hasEvent ? ' has-event' : ''}" data-calendar-date="${dateKey}" aria-label="${day} ${monthLabel}" aria-pressed="${isSelected}">${day}${hasEvent ? '<span class="calendar-event-dot"></span>' : ''}</button>`);
    }
    grid.innerHTML = cells.join('');
    $$('[data-calendar-date]', grid).forEach(button => button.addEventListener('click', () => {
      state.selectedCalendarDate = button.dataset.calendarDate;
      renderCalendar();
    }));
    const selectedEvents = state.events.filter(item => {
      const date = parseEventDate(item.date);
      const key = date ? localDateKey(date) : '';
      return key === state.selectedCalendarDate && !isEventExpired(item);
    }).sort((a, b) => (parseEventDate(a.date)?.getTime() || 0) - (parseEventDate(b.date)?.getTime() || 0));
    const list = $('#calendar-event-list');
    if (list) {
      list.innerHTML = selectedEvents.length ? selectedEvents.map(item => `<button type="button" class="calendar-event-row" data-calendar-event="${escapeHtml(item.id)}"><span class="calendar-event-time">${escapeHtml(parseEventDate(item.date) ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: EVENT_TIME_ZONE }).format(parseEventDate(item.date)) : '--:--')}</span><span class="calendar-event-name">${escapeHtml(item.name)}</span></button>`).join('') : '<p class="text-sm text-slate-500 py-4">Nenhum evento nesta data.</p>';
      $$('[data-calendar-event]', list).forEach(button => button.addEventListener('click', () => openEventModal(button.dataset.calendarEvent)));
    }
    $('#calendar-selected-count').textContent = `${selectedEvents.length} ${selectedEvents.length === 1 ? 'evento' : 'eventos'}`;
    $('#calendar-selected-title').textContent = `Eventos de ${state.selectedCalendarDate.split('-').reverse().join('/')}`;
    refreshIcons();
  }

  function initCalendarAndDrawers() {
    $('#menu-button')?.addEventListener('click', () => openDrawer('#calendar-drawer'));
    $('#calendar-close')?.addEventListener('click', () => closeDrawer('#calendar-drawer'));
    $('#calendar-backdrop')?.addEventListener('click', () => closeDrawer('#calendar-drawer'));
    $('#calendar-prev')?.addEventListener('click', () => { state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() - 1, 1); renderCalendar(); });
    $('#calendar-next')?.addEventListener('click', () => { state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + 1, 1); renderCalendar(); });
    $('#close-category')?.addEventListener('click', () => closeDrawer('#category-drawer'));
    $('#category-backdrop')?.addEventListener('click', () => closeDrawer('#category-drawer'));
    renderCategoryDrawer();
  }

  function initMainInteractions() {
    $('#search')?.addEventListener('input', event => { state.search = event.target.value.trim(); renderEvents(); });
    $('#quick-categories')?.addEventListener('click', event => {
      const button = event.target.closest('[data-quick-category]');
      if (!button) return;
      state.selectedCategory = button.dataset.quickCategory;
      renderEvents();
    });
    $('#clear-category')?.addEventListener('click', () => { state.selectedCategory = 'all'; renderEvents(); });
    $('#close-modal')?.addEventListener('click', () => closeModal($('#modal')));
    $('#modal-backdrop')?.addEventListener('click', () => closeModal($('#modal')));
    $('#close-auth-modal')?.addEventListener('click', () => closeModal($('#auth-modal')));
    $('#close-profile-modal')?.addEventListener('click', () => closeModal($('#profile-modal')));
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      ['#modal', '#auth-modal', '#profile-modal'].forEach(selector => closeModal($(selector)));
      closeDrawer('#calendar-drawer');
      closeDrawer('#category-drawer');
    });
    $('#footer-year').textContent = String(new Date().getFullYear());
    const carousel = $('#featured-carousel');
    carousel?.addEventListener('mouseenter', stopFeaturedCarousel);
    carousel?.addEventListener('mouseleave', restartFeaturedCarousel);
    carousel?.addEventListener('focusin', stopFeaturedCarousel);
    carousel?.addEventListener('focusout', event => { if (!carousel.contains(event.relatedTarget)) restartFeaturedCarousel(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopFeaturedCarousel(); else restartFeaturedCarousel();
    });
  }

  async function initialize() {
    const savedTheme = localStorage.getItem('theme');
    document.documentElement.classList.toggle('dark', savedTheme !== 'light');
    initThemeAndSettings();
    initMainInteractions();
    initAuth();
    initCalendarAndDrawers();
    refreshIcons();
    await loadEvents();
    initEventLifecycle();
    initNotifications();
    hideLoadingScreen();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
