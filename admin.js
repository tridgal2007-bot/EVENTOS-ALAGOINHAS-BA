const supabaseClient = window.supabaseClient || null;

const CATEGORY_META = {

    shows: { label: 'Shows e Música', icon: 'mic-2', color: 'text-fuchsia-500' },

    festas: { label: 'Festas e Forró', icon: 'party-popper', color: 'text-amber-500' },

    cultura: { label: 'Cultura e Arte', icon: 'palette', color: 'text-purple-500' },

    esportes: { label: 'Esportes', icon: 'trophy', color: 'text-emerald-500' },

    gastronomia: { label: 'Gastronomia', icon: 'utensils', color: 'text-orange-500' },

    infantil: { label: 'Infantil', icon: 'baby', color: 'text-pink-500' },

    religioso: { label: 'Religioso', icon: 'church', color: 'text-sky-500' },

    outros: { label: 'Outros', icon: 'tag', color: 'text-slate-500' }

};

const IMAGE_BUCKET = 'alagoinhas-images';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function localDateTimeToISO(value) {
    if (!value) return null;
    // datetime-local não contém fuso. Como esta agenda é de Alagoinhas,
    // interpretamos o horário digitado no fuso de Bahia (UTC-03:00),
    // independentemente do fuso configurado no computador do administrador.
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/.exec(value);
    if (!match) throw new Error('Informe uma data e horário válidos.');
    const date = new Date(`${match[1]}T${match[2]}:${match[3] || '00'}-03:00`);
    if (Number.isNaN(date.getTime())) throw new Error('Informe uma data e horário válidos.');
    return date.toISOString();
}

function isAdminEventExpired(eventItem) {
    const end = eventItem.end_date || eventItem.date;
    if (!end) return false;
    const endTime = new Date(end).getTime();
    return Number.isFinite(endTime) && Date.now() > endTime + (3 * 24 * 60 * 60 * 1000);
}


const form = document.getElementById('event-form');

const ticketCheckboxElement = document.getElementById('has-ticket');

const ticketFieldsElement = document.getElementById('ticket-fields');

const msg = document.getElementById('form-msg');

const imageInput = document.getElementById('image');

const imagePreview = document.getElementById('image-preview');

const imagePreviewContainer = document.getElementById('image-preview-container');

let eventPreviewObjectUrl = null;

function refreshAdminIcons() {

    if (window.lucide && typeof window.lucide.createIcons === 'function') {

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

function showFormMessage(message, type = 'info') {

    const colors = {

        info: 'text-alagoinhas-500',

        success: 'text-emerald-500',

        error: 'text-red-500'

    };

    const icons = {

        info: 'loader-2',

        success: 'check-circle',

        error: 'alert-circle'

    };

    if (!msg) return;

    msg.className = `text-sm font-semibold min-h-[1.25rem] ${colors[type] || colors.info}`;

    msg.innerHTML = `

        <span class="inline-flex items-center gap-2">

            <i data-lucide="${icons[type] || icons.info}" class="w-4 h-4 ${type === 'info' ? 'animate-spin' : ''}"></i>

            ${escapeHtml(message)}

        </span>

    `;

    refreshAdminIcons();

}

function validateImage(file) {

    if (!file) {

        throw new Error('Selecione uma foto para o evento.');

    }

    const allowedTypes = [

        'image/jpeg',

        'image/png',

        'image/webp',

        'image/gif'

    ];

    if (!allowedTypes.includes(file.type)) {

        throw new Error('Formato inválido. Use JPG, PNG, WEBP ou GIF.');

    }

    if (file.size > MAX_IMAGE_SIZE) {

        throw new Error('A foto deve ter no máximo 5 MB.');

    }

}

function makeSafeFilename(filename) {

    const extension = (filename.split('.').pop() || 'jpg')

        .toLowerCase()

        .replace(/[^a-z0-9]/g, '');

    return `${crypto.randomUUID()}.${extension || 'jpg'}`;

}

async function uploadEventImage(file) {

    validateImage(file);

    const path = `events/${makeSafeFilename(file.name)}`;

    const { error: uploadError } = await supabaseClient

        .storage

        .from(IMAGE_BUCKET)

        .upload(path, file, {

            cacheControl: '3600',

            contentType: file.type,

            upsert: false

        });

    if (uploadError) {

        throw new Error(`Não foi possível enviar a foto: ${uploadError.message}`);

    }

    const { data } = supabaseClient

        .storage

        .from(IMAGE_BUCKET)

        .getPublicUrl(path);

    if (!data?.publicUrl) {

        throw new Error('O Supabase não retornou o endereço público da foto.');

    }

    return data.publicUrl;

}

imageInput?.addEventListener('change', () => {

    const file = imageInput.files?.[0];

    if (!file) {

        imagePreviewContainer?.classList.add('hidden');

        if (imagePreview) {

            imagePreview.removeAttribute('src');

        }

        if (eventPreviewObjectUrl) {

            URL.revokeObjectURL(eventPreviewObjectUrl);

            eventPreviewObjectUrl = null;

        }

        return;

    }

    try {

        validateImage(file);

    } catch (error) {

        imageInput.value = '';

        imagePreviewContainer?.classList.add('hidden');

        if (imagePreview) {

            imagePreview.removeAttribute('src');

        }

        showFormMessage(error.message, 'error');

        return;

    }

    if (eventPreviewObjectUrl) {

        URL.revokeObjectURL(eventPreviewObjectUrl);

    }

    eventPreviewObjectUrl = URL.createObjectURL(file);

    if (imagePreview && imagePreviewContainer) {

        imagePreview.src = eventPreviewObjectUrl;

        imagePreviewContainer.classList.remove('hidden');

    }

    if (msg) {

        msg.textContent = '';

    }

});

async function checkAdminAuth() {

    if (!supabaseClient) {
        const container = document.getElementById('admin-events');
        if (container) {
            container.innerHTML = `
                <div class="glass-card rounded-2xl p-6 text-sm leading-relaxed text-amber-700 dark:text-amber-300" role="status">
                    <strong class="block mb-2">Supabase ainda não configurado</strong>
                    Preencha a URL e a chave pública em <code>supabase-config.js</code> para carregar eventos e validar o acesso administrativo.
                </div>`;
        }
        const adminsList = document.getElementById('admins-list');
        if (adminsList) adminsList.innerHTML = '<p class="text-sm text-amber-700 dark:text-amber-300">Configure o Supabase para gerenciar administradores.</p>';
        return;
    }

    try {

        const {

            data: { session },

            error: sessionError

        } = await supabaseClient.auth.getSession();

        if (sessionError) throw sessionError;

        if (!session) {

            alert('Você precisa estar logado para acessar o painel admin.');

            window.location.href = 'index.html';

            return;

        }

        const { data: adminData, error: adminError } = await supabaseClient

            .from('admins')

            .select('email')

            .eq('email', session.user.email)

            .maybeSingle();

        if (adminError || !adminData) {

            alert('Acesso negado: você não tem permissão de administrador.');

            window.location.href = 'index.html';

            return;

        }

        await Promise.all([

            loadAdminEvents(),

            loadAdminsList()

        ]);

    } catch (error) {

        console.error('Erro ao verificar administrador:', error);

        alert(`Não foi possível validar seu acesso: ${error.message || 'erro desconhecido'}`);

        window.location.href = 'index.html';

    }

}

async function loadAdminsList() {

    const container = document.getElementById('admins-list');

    if (!container) return;

    const { data, error } = await supabaseClient

        .from('admins')

        .select('*')

        .order('created_at', { ascending: false });

    if (error || !data) {

        container.innerHTML = '<p class="text-red-500 text-center">Erro ao carregar administradores.</p>';

        return;

    }

    container.innerHTML = data.map(admin => `

        <div class="flex items-center justify-between p-3 rounded-xl bg-alagoinhas-50 dark:bg-white/5 border border-alagoinhas-100 dark:border-white/10">

            <div class="flex items-center gap-3 min-w-0">

                <div class="w-8 h-8 rounded-full bg-alagoinhas-500 flex items-center justify-center text-white font-bold text-xs shrink-0">

                    ${escapeHtml((admin.email || '?').charAt(0).toUpperCase())}

                </div>

                <div class="min-w-0">

                    <p class="font-semibold text-alagoinhas-900 dark:text-white text-sm break-all">${escapeHtml(admin.email)}</p>

                    <p class="text-xs text-slate-500">

                        Adicionado em: ${admin.created_at ? new Date(admin.created_at).toLocaleDateString('pt-BR') : '—'}

                    </p>

                </div>

            </div>

            <button

                type="button"

                data-remove-admin="${escapeHtml(admin.email)}"

                class="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors"

                title="Remover administrador"

                aria-label="Remover administrador"

            >

                <i data-lucide="trash-2" class="w-4 h-4"></i>

            </button>

        </div>

    `).join('');

    container.querySelectorAll('[data-remove-admin]').forEach(button => {

        button.addEventListener('click', () => removeAdmin(button.dataset.removeAdmin));

    });

    refreshAdminIcons();

}

document.getElementById('add-admin-form')?.addEventListener('submit', async event => {

    event.preventDefault();

    const emailInput = document.getElementById('new-admin-email');

    const newEmail = emailInput.value.trim().toLowerCase();

    const button = event.currentTarget.querySelector('button[type="submit"]');

    if (!newEmail) return;

    button.disabled = true;

    try {

        const { data: { session } } = await supabaseClient.auth.getSession();

        const { error } = await supabaseClient

            .from('admins')

            .insert({

                email: newEmail,

                added_by: session?.user?.email || null

            });

        if (error) throw error;

        emailInput.value = '';

        await loadAdminsList();

    } catch (error) {

        const message = error.code === '23505' || error.message?.toLowerCase().includes('duplicate')

            ? 'Este e-mail já é administrador.'

            : error.message;

        alert(`Erro ao adicionar administrador: ${message}`);

    } finally {

        button.disabled = false;

        button.innerHTML = '<i data-lucide="plus" class="w-5 h-5"></i> Adicionar';

        refreshAdminIcons();

    }

});

async function removeAdmin(email) {

    if (!confirm(`Tem certeza que deseja remover ${email} da lista de administradores?`)) {

        return;

    }

    const { error } = await supabaseClient

        .from('admins')

        .delete()

        .eq('email', email);

    if (error) {

        alert(`Erro ao remover administrador: ${error.message}`);

    } else {

        await loadAdminsList();

    }

}

window.removeAdmin = removeAdmin;

form?.addEventListener('submit', async event => {

    event.preventDefault();

    if (!supabaseClient) {
        showFormMessage('Configure a URL e a chave pública do Supabase em supabase-config.js antes de publicar eventos.', 'error');
        return;
    }

    const submitButton = form.querySelector('button[type="submit"]');

    submitButton.disabled = true;

    showFormMessage('Enviando foto e publicando evento...', 'info');

    try {

        const file = imageInput?.files?.[0];

        validateImage(file);

        const imageUrl = await uploadEventImage(file);

        const hasTicket = Boolean(ticketCheckboxElement?.checked);

        const eventData = {

            name: document.getElementById('name').value.trim(),

            description: document.getElementById('description').value.trim(),

            image: imageUrl,

            date: localDateTimeToISO(document.getElementById('date').value),
            end_date: localDateTimeToISO(document.getElementById('end-date').value),

            category: document.getElementById('category').value,

            has_ticket: hasTicket,

            price: hasTicket

                ? (Number.parseFloat(document.getElementById('price').value) || 0)

                : null,

            link: hasTicket

                ? (document.getElementById('link').value.trim() || null)

                : null

        };

        if (!eventData.name || !eventData.description || !eventData.date || !eventData.end_date) {
            throw new Error('Preencha todos os campos obrigatórios, inclusive o horário de término.');
        }
        if (new Date(eventData.end_date).getTime() <= new Date(eventData.date).getTime()) {
            throw new Error('O término precisa ser posterior ao início do evento.');
        }

        const { error } = await supabaseClient

            .from('events')

            .insert([eventData]);

        if (error) throw error;

        showFormMessage('Evento publicado com sucesso!', 'success');

        form.reset();

        ticketFieldsElement?.classList.remove('open');

        imagePreviewContainer?.classList.add('hidden');

        if (imagePreview) {

            imagePreview.removeAttribute('src');

        }

        if (eventPreviewObjectUrl) {

            URL.revokeObjectURL(eventPreviewObjectUrl);

            eventPreviewObjectUrl = null;

        }

        await loadAdminEvents();

        setTimeout(() => {

            if (msg) msg.textContent = '';

        }, 4000);

    } catch (error) {

        console.error('Erro ao publicar evento:', error);

        showFormMessage(error.message || 'Não foi possível publicar o evento.', 'error');

    } finally {

        submitButton.disabled = false;

    }

});

async function loadAdminEvents() {

    const container = document.getElementById('admin-events');

    if (!container) return;

    container.innerHTML = '<div class="text-center py-8 text-slate-500">Carregando eventos...</div>';

    try {

        const { data, error } = await supabaseClient

            .from('events')

            .select('*')

            .order('date', { ascending: false });

        if (error) throw error;

        const visibleEvents = (data || []).filter(eventItem => !isAdminEventExpired(eventItem));

        if (!visibleEvents.length) {

            container.innerHTML = `

                <div class="text-center py-14 glass-card rounded-2xl">

                    <i data-lucide="inbox" class="w-12 h-12 text-alagoinhas-300 dark:text-white/20 mx-auto mb-3"></i>

                    <p class="text-alagoinhas-500 dark:text-white/50">Nenhum evento cadastrado ainda.</p>

                </div>

            `;

            refreshAdminIcons();

            return;

        }

        container.innerHTML = visibleEvents.map((eventItem, index) => {

            const date = eventItem.date

                ? new Date(eventItem.date).toLocaleString('pt-BR', {

                    day: '2-digit',

                    month: 'short',

                    year: 'numeric',

                    hour: '2-digit',

                    minute: '2-digit',
                    timeZone: 'America/Bahia'
                })

                : 'Data não informada';

            
            const endDate = eventItem.end_date ? new Date(eventItem.end_date).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bahia' }) : null;
            const isPast = new Date(eventItem.end_date || eventItem.date).getTime() < Date.now();
            const category = CATEGORY_META[eventItem.category] || CATEGORY_META.outros;

            return `

                <div class="admin-event-row fade-slide-in glass-card rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4" style="animation-delay:${index * 60}ms">

                    <div class="flex items-start gap-4 flex-1 min-w-0">

                        <img

                            src="${escapeHtml(eventItem.image || '')}"

                            alt="${escapeHtml(eventItem.name)}"

                            class="w-16 h-16 rounded-xl object-cover bg-alagoinhas-50 dark:bg-white/5 flex-shrink-0"

                            loading="lazy"

                            onerror="this.style.display='none'"

                        >

                        <div class="min-w-0">

                            <h4 class="font-bold text-alagoinhas-900 dark:text-white line-clamp-1">${escapeHtml(eventItem.name)}</h4>
                            ${isPast ? '<span class="past-admin-badge">Já aconteceu</span>' : ''}

                            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-sm">

                                <span class="flex items-center gap-1 text-alagoinhas-500 dark:text-white/50">

                                    <i data-lucide="calendar" class="w-3.5 h-3.5"></i>

                                    ${escapeHtml(date)}${endDate ? ` – término: ${escapeHtml(endDate)}` : ''}

                                </span>

                                <span class="flex items-center gap-1 ${category.color}">

                                    <i data-lucide="${category.icon}" class="w-3.5 h-3.5"></i>

                                    ${category.label}

                                </span>

                                <span class="flex items-center gap-1 ${eventItem.has_ticket ? 'text-alagoinhas-500' : 'text-emerald-500'}">

                                    <i data-lucide="${eventItem.has_ticket ? 'ticket' : 'gift'}" class="w-3.5 h-3.5"></i>

                                    ${eventItem.has_ticket

                                        ? 'R$ ' + Number(eventItem.price || 0).toFixed(2).replace('.', ',')

                                        : 'Gratuito'}

                                </span>

                            </div>

                        </div>

                    </div>

                    <button

                        type="button"

                        data-delete-event="${escapeHtml(eventItem.id)}"

                        class="w-full sm:w-auto px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-semibold text-sm transition-all flex items-center justify-center gap-2 flex-shrink-0"

                    >

                        <i data-lucide="trash-2" class="w-4 h-4"></i> Excluir

                    </button>

                </div>

            `;

        }).join('');

        container.querySelectorAll('[data-delete-event]').forEach(button => {

            button.addEventListener('click', () => deleteEvent(button.dataset.deleteEvent));

        });

        refreshAdminIcons();

    } catch (error) {

        console.error('Erro ao carregar eventos:', error);

        container.innerHTML = `

            <div class="text-center py-14 glass-card rounded-2xl">

                <i data-lucide="alert-circle" class="w-12 h-12 text-red-400 mx-auto mb-3"></i>

                <p class="text-red-500">Erro ao carregar eventos: ${escapeHtml(error.message)}</p>

            </div>

        `;

        refreshAdminIcons();

    }

}

async function deleteEvent(id) {

    if (!confirm('Tem certeza que deseja excluir este evento?')) {

        return;

    }

    const { error } = await supabaseClient

        .from('events')

        .delete()

        .eq('id', id);

    if (error) {

        alert(`Erro ao excluir evento: ${error.message}`);

    } else {

        await loadAdminEvents();

    }

}

window.deleteEvent = deleteEvent;

checkAdminAuth();


function initAdminAppearance() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    const themeToggleBtn = document.getElementById('theme-toggle');
    const htmlElement = document.documentElement;
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) htmlElement.classList.add('dark');
    else htmlElement.classList.remove('dark');
    themeToggleBtn?.addEventListener('click', () => {
        htmlElement.classList.toggle('dark');
        localStorage.theme = htmlElement.classList.contains('dark') ? 'dark' : 'light';
        if (window.lucide) window.lucide.createIcons();
    });
    ticketCheckboxElement?.addEventListener('change', () => ticketFieldsElement?.classList.toggle('open', ticketCheckboxElement.checked));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAdminAppearance, { once: true });
else initAdminAppearance();
