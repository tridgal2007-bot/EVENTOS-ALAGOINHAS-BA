/* ============================================
   SCRIPT ADMIN - ALAGOINHAS EVENTOS
   ============================================ */

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

const form = document.getElementById('event-form');
const ticketCheckbox = document.getElementById('has-ticket');
const ticketFields = document.getElementById('ticket-fields');
const msg = document.getElementById('form-msg');

/* ============================================
   VERIFICAR AUTENTICAÇÃO E PERMISSÃO DE ADMIN
   ============================================ */
async function checkAdminAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        alert('Você precisa estar logado para acessar o painel admin.');
        window.location.href = 'index.html';
        return;
    }

    const { data: adminData, error: adminError } = await supabaseClient
        .from('admins')
        .select('email')
        .eq('email', session.user.email)
        .single();

    if (adminError || !adminData) {
        alert('Acesso negado: Você não tem permissão de administrador.');
        window.location.href = 'index.html';
        return;
    }

    console.log('Admin logado:', session.user.email);
    loadAdminEvents();
    loadAdminsList();
}

/* ============================================
   GERENCIAMENTO DE ADMINISTRADORES
   ============================================ */
async function loadAdminsList() {
    const container = document.getElementById('admins-list');
    
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
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-alagoinhas-500 flex items-center justify-center text-white font-bold text-xs">
                    ${admin.email.charAt(0).toUpperCase()}
                </div>
                <div>
                    <p class="font-semibold text-alagoinhas-900 dark:text-white text-sm">${admin.email}</p>
                    <p class="text-xs text-slate-500">Adicionado em: ${new Date(admin.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
            </div>
            <button onclick="removeAdmin('${admin.email}')" class="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors" title="Remover administrador">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
}

document.getElementById('add-admin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('new-admin-email');
    const newEmail = emailInput.value.trim().toLowerCase();
    const btn = e.target.querySelector('button');

    if (!newEmail) return;

    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>';
    if (window.lucide) lucide.createIcons();

    const { data: { session } } = await supabaseClient.auth.getSession();

    const { error } = await supabaseClient.from('admins').insert({
        email: newEmail,
        added_by: session.user.email
    });

    if (error) {
        alert('Erro ao adicionar: ' + (error.message.includes('duplicate') ? 'Este e-mail já é administrador.' : error.message));
    } else {
        emailInput.value = '';
        loadAdminsList();
    }

    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="plus" class="w-5 h-5"></i> Adicionar';
    if (window.lucide) lucide.createIcons();
});

async function removeAdmin(email) {
    if (!confirm(`Tem certeza que deseja remover ${email} da lista de administradores?`)) return;

    const { error } = await supabaseClient.from('admins').delete().eq('email', email);
    
    if (error) {
        alert('Erro ao remover: ' + error.message);
    } else {
        loadAdminsList();
    }
}
window.removeAdmin = removeAdmin;

/* ============================================
   CRUD DE EVENTOS
   ============================================ */
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.innerHTML = '<span class="inline-flex items-center gap-2 text-alagoinhas-500"><i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Publicando...</span>';
    if (window.lucide) lucide.createIcons();

    const eventData = {
        name: document.getElementById('name').value.trim(),
        description: document.getElementById('description').value.trim(),
        image: document.getElementById('image').value.trim(),
        date: document.getElementById('date').value,
        category: document.getElementById('category').value,
        has_ticket: ticketCheckbox.checked,
        price: ticketCheckbox.checked ? (parseFloat(document.getElementById('price').value) || 0) : null,
        link: ticketCheckbox.checked ? (document.getElementById('link').value.trim() || null) : null
    };

    try {
        const { error } = await supabaseClient.from('events').insert([eventData]);
        if (error) throw error;

        msg.innerHTML = '<span class="inline-flex items-center gap-2 text-emerald-500"><i data-lucide="check-circle" class="w-4 h-4"></i> Evento publicado com sucesso!</span>';
        form.reset();
        ticketFields.classList.remove('open');
        loadAdminEvents();
        setTimeout(() => { msg.innerHTML = ''; }, 4000);
    } catch (error) {
        msg.innerHTML = `<span class="inline-flex items-center gap-2 text-red-500"><i data-lucide="alert-circle" class="w-4 h-4"></i> Erro: ${error.message}</span>`;
    }
    if (window.lucide) lucide.createIcons();
});

async function loadAdminEvents() {
    const container = document.getElementById('admin-events');
    try {
        const { data, error } = await supabaseClient.from('events').select('*').order('date', { ascending: false });
        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = `<div class="text-center py-14 glass-card rounded-2xl"><i data-lucide="inbox" class="w-12 h-12 text-alagoinhas-300 dark:text-white/20 mx-auto mb-3"></i><p class="text-alagoinhas-500 dark:text-white/50">Nenhum evento cadastrado ainda.</p></div>`;
            if (window.lucide) lucide.createIcons();
            return;
        }

        container.innerHTML = data.map((ev, i) => {
            const date = new Date(ev.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const cat = CATEGORY_META[ev.category] || CATEGORY_META.outros;
            return `
                <div class="admin-event-row fade-slide-in glass-card rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4" style="animation-delay:${i * 60}ms">
                    <div class="flex items-start gap-4 flex-1 min-w-0">
                        <img src="${ev.image}" onerror="this.src='https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=200&q=80'" class="w-16 h-16 rounded-xl object-cover bg-alagoinhas-50 dark:bg-white/5 flex-shrink-0" />
                        <div class="min-w-0">
                            <h4 class="font-bold text-alagoinhas-900 dark:text-white line-clamp-1">${escapeHtml(ev.name)}</h4>
                            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-sm">
                                <span class="flex items-center gap-1 text-alagoinhas-500 dark:text-white/50"><i data-lucide="calendar" class="w-3.5 h-3.5"></i> ${date}</span>
                                <span class="flex items-center gap-1 ${cat.color}"><i data-lucide="${cat.icon}" class="w-3.5 h-3.5"></i> ${cat.label}</span>
                                <span class="flex items-center gap-1 ${ev.has_ticket ? 'text-alagoinhas-500' : 'text-emerald-500'}">
                                    <i data-lucide="${ev.has_ticket ? 'ticket' : 'gift'}" class="w-3.5 h-3.5"></i>
                                    ${ev.has_ticket ? 'R$ ' + Number(ev.price).toFixed(2) : 'Gratuito'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button onclick="deleteEvent(${ev.id})" class="w-full sm:w-auto px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-semibold text-sm transition-all flex items-center justify-center gap-2 flex-shrink-0">
                        <i data-lucide="trash-2" class="w-4 h-4"></i> Excluir
                    </button>
                </div>
            `;
        }).join('');
        if (window.lucide) setTimeout(() => lucide.createIcons(), 50);
    } catch (error) {
        container.innerHTML = `<div class="text-center py-14 glass-card rounded-2xl"><i data-lucide="alert-circle" class="w-12 h-12 text-red-400 mx-auto mb-3"></i><p class="text-red-500">Erro ao carregar eventos.</p></div>`;
    }
}

async function deleteEvent(id) {
    if (!confirm('Tem certeza que deseja excluir este evento?')) return;
    try {
        const { error } = await supabaseClient.from('events').delete().eq('id', id);
        if (error) throw error;
        loadAdminEvents();
    } catch (error) {
        alert('Erro ao excluir: ' + error.message);
    }
}
window.deleteEvent = deleteEvent;

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Inicialização
checkAdminAuth();