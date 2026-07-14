// Initial Preset Events Data
const DEFAULT_EVENTS = [];

// Presets Avatars
const AVATAR_PRESETS = [
  { icon: "👌", name: "Pitú", class: "bg-amber-500 text-white" },
  { icon: "💃", name: "Hittler", class: "bg-pink-500 text-white" },
  { icon: "🌴", name: "KID B", class: "bg-emerald-500 text-white" },
  { icon: "⚽", name: "CV", class: "bg-blue-500 text-white" },
  { icon: "🎭", name: "BDM", class: "bg-purple-500 text-white" }
];

const CATEGORY_MAP = {
  all: { label: "Todos", class: "bg-blue-600 border-blue-600 text-white" },
  shows: { label: "Shows & Festas", class: "bg-blue-500/10 border-blue-500/20 text-blue-400" },
  sports: { label: "Esportes & Saúde", class: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" },
  culture: { label: "Teatro & Cultura", class: "bg-purple-500/10 border-purple-500/20 text-purple-400" },
  local_fest: { label: "Eventos Locais", class: "bg-amber-500/10 border-amber-500/20 text-amber-400" },
  lectures: { label: "Aulas & Palestras", class: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" }
};

// Application State
let events = [];
let favorites = [];
let currentUser = null;
let theme = "dark";
let sidebarOpen = false;
let selectedDate = null; // YYYY-MM-DD
let selectedCategory = "all";
let searchQuery = "";
let showOnlyFavorites = false;

// Calendar State
let calendarYear = 2026;
let calendarMonth = 6; // July (0-indexed)

// Audio Chime Generator
function playChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.12); // A5
    
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.warn("Web Audio API not supported or blocked", e);
  }
}

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
  initLoader();
  loadData();
  applyTheme();
  setupEventListeners();
  renderCalendar();
  renderEvents();
  renderHeaderUser();
  updateFiltersDisplay();
});

// Minimal Loader Progress Simulation
function initLoader() {
  const loader = document.getElementById("app-loader");
  const progressFill = document.getElementById("loader-progress-fill");
  const progressText = document.getElementById("loader-progress-text");
  
  if (!loader) return;
  
  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.floor(Math.random() * 12) + 8;
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      setTimeout(() => {
        loader.classList.add("opacity-0", "pointer-events-none");
        setTimeout(() => loader.remove(), 400);
      }, 250);
    }
    if (progressFill) progressFill.style.width = `${progress}%`;
    if (progressText) progressText.textContent = `${progress}%`;
  }, 45);
}

// Load Persistent Data from LocalStorage
function loadData() {
  // Theme
  theme = localStorage.getItem("alagoinhas_theme") || "dark";
  
  // Events
  const savedEvents = localStorage.getItem("alagoinhas_events");
  if (savedEvents) {
    events = JSON.parse(savedEvents);
  } else {
    events = [...DEFAULT_EVENTS];
    localStorage.setItem("alagoinhas_events", JSON.stringify(events));
  }
  
  // Favorites
  const savedFavs = localStorage.getItem("alagoinhas_favorites");
  if (savedFavs) {
    favorites = JSON.parse(savedFavs);
  } else {
    favorites = [];
  }
  
  // User
  const savedUser = localStorage.getItem("alagoinhas_user");
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
  }
}

// Apply theme classes to document body
function applyTheme() {
  const body = document.body;
  const themeToggleIcon = document.getElementById("theme-toggle-icon");
  const themeToggleText = document.getElementById("theme-toggle-text");
  
  if (theme === "dark") {
    body.classList.add("dark", "bg-[#070c19]", "text-white");
    body.classList.remove("bg-[#f3f6fc]", "text-slate-800");
    if (themeToggleIcon) themeToggleIcon.setAttribute("data-lucide", "sun");
    if (themeToggleText) themeToggleText.textContent = "Modo Claro";
  } else {
    body.classList.add("bg-[#f3f6fc]", "text-slate-800");
    body.classList.remove("dark", "bg-[#070c19]", "text-white");
    if (themeToggleIcon) themeToggleIcon.setAttribute("data-lucide", "moon");
    if (themeToggleText) themeToggleText.textContent = "Modo Escuro";
  }
  
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Render dynamic elements in header depending on user status
function renderHeaderUser() {
  const userContainer = document.getElementById("header-user-container");
  if (!userContainer) return;
  
  if (currentUser) {
    userContainer.innerHTML = `
      <div class="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 bg-white/5 border border-white/10 rounded-full max-w-[100px] sm:max-w-[150px] truncate cursor-pointer" onclick="openLoginModal()">
        <div class="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs shrink-0 ${AVATAR_PRESETS[currentUser.avatarIdx]?.class}">
          ${AVATAR_PRESETS[currentUser.avatarIdx]?.icon}
        </div>
        <span class="hidden xs:inline text-[10px] sm:text-xs font-bold text-white truncate">${currentUser.name}</span>
      </div>
    `;
  } else {
    userContainer.innerHTML = `
      <button onclick="openLoginModal()" class="flex items-center gap-1.5 text-[10px] sm:text-xs font-black text-white hover:text-blue-300 transition-colors px-2.5 py-1.5 sm:px-3 sm:py-2 bg-white/5 rounded-full border border-white/5 hover:border-white/10 cursor-pointer shrink-0">
        <i data-lucide="user" class="w-3.5 h-3.5"></i>
        <span class="hidden xs:inline">Entrar</span>
      </button>
    `;
  }
  
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Render the Sidebar Calendar Grid
function renderCalendar() {
  const monthTitle = document.getElementById("calendar-month-title");
  const daysGrid = document.getElementById("calendar-days-grid");
  if (!monthTitle || !daysGrid) return;
  
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  
  monthTitle.textContent = `${monthNames[calendarMonth]} ${calendarYear}`;
  
  daysGrid.innerHTML = "";
  
  // Grid construction variables
  const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay();
  const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const prevMonthTotalDays = new Date(calendarYear, calendarMonth, 0).getDate();
  
  // 1. Render overlap days from previous month
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = prevMonthTotalDays - i;
    const btn = document.createElement("button");
    btn.disabled = true;
    btn.className = "p-1.5 text-center text-xs text-slate-600 font-medium opacity-40 cursor-not-allowed";
    btn.textContent = dayNum;
    daysGrid.appendChild(btn);
  }
  
  // 2. Render actual current month days
  for (let d = 1; d <= totalDays; d++) {
    const dayStr = String(d).padStart(2, '0');
    const monthStr = String(calendarMonth + 1).padStart(2, '0');
    const fullDateStr = `${calendarYear}-${monthStr}-${dayStr}`;
    
    // Check if this day has any active events
    const hasEvents = events.some(e => e.date === fullDateStr);
    const isSelected = selectedDate === fullDateStr;
    
    // Is today
    const today = new Date();
    const isToday = today.getDate() === d && today.getMonth() === calendarMonth && today.getFullYear() === calendarYear;
    
    const btn = document.createElement("button");
    btn.className = `calendar-day-btn w-8 h-8 rounded-full text-xs font-bold transition-all flex flex-col items-center justify-center cursor-pointer relative active:scale-95
      ${isSelected 
        ? "bg-blue-600 text-white shadow-md font-black" 
        : isToday 
          ? "border border-blue-400 text-blue-400 font-extrabold" 
          : theme === "dark" 
            ? "text-slate-300 hover:bg-white/5" 
            : "text-slate-700 hover:bg-slate-200"
      }`;
      
    btn.onclick = () => selectCalendarDate(fullDateStr);
    btn.textContent = d;
    
    // Add blue event indicators
    if (hasEvents && !isSelected) {
      const dot = document.createElement("span");
      dot.className = "calendar-day-dot bg-blue-400";
      btn.appendChild(dot);
    }
    
    daysGrid.appendChild(btn);
  }
}

// Select calendar day for filtering events
function selectCalendarDate(dateStr) {
  if (selectedDate === dateStr) {
    selectedDate = null; // Clear filter
  } else {
    selectedDate = dateStr;
  }
  renderCalendar();
  renderEvents();
  updateFiltersDisplay();
}

// Go to next month in Calendar view
function nextMonth() {
  calendarMonth++;
  if (calendarMonth > 11) {
    calendarMonth = 0;
    calendarYear++;
  }
  renderCalendar();
}

// Go to previous month in Calendar view
function prevMonth() {
  calendarMonth--;
  if (calendarMonth < 0) {
    calendarMonth = 11;
    calendarYear--;
  }
  renderCalendar();
}

// Search, Filter, and render events list
function renderEvents() {
  const eventsContainer = document.getElementById("events-grid-container");
  const featuredSection = document.getElementById("featured-event-section");
  if (!eventsContainer) return;
  
  // Apply all filters: Search Query, Category, Selected Date, Favorite Status
  const filtered = events.filter(event => {
    // Search matching
    const searchMatch = searchQuery === "" || 
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.organizer.toLowerCase().includes(searchQuery.toLowerCase());
      
    // Category matching
    const categoryMatch = selectedCategory === "all" || event.category === selectedCategory;
    
    // Date matching
    const dateMatch = !selectedDate || event.date === selectedDate;
    
    // Favorite status matching
    const favMatch = !showOnlyFavorites || favorites.includes(event.id);
    
    return searchMatch && categoryMatch && dateMatch && favMatch;
  });
  
  // Render Featured event banner if no active filters
  const isFiltering = selectedDate || searchQuery !== "" || selectedCategory !== "all" || showOnlyFavorites;
  const featuredEvent = events.find(e => e.isFeatured);
  
  if (!isFiltering && featuredEvent && featuredSection) {
    featuredSection.classList.remove("hidden");
    featuredSection.innerHTML = `
      <div class="max-w-7xl mx-auto">
        <div class="rounded-[24px] sm:rounded-[32px] overflow-hidden relative h-[250px] xs:h-[300px] sm:h-[380px] bg-cover bg-center border-2 sm:border-4 shadow-xl group transition-all duration-500 border-white/10"
          style="background-image: url('${featuredEvent.imageUrl}')"
        >
          <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-[#0a1428]/40 to-transparent z-10"></div>
          
          <div class="absolute bottom-3 left-3 right-3 sm:bottom-6 sm:left-6 sm:right-6 z-20 text-left">
            <span class="px-2 py-0.5 sm:px-3 sm:py-1 bg-amber-400 text-blue-950 text-[8px] sm:text-[10px] font-black uppercase tracking-widest rounded-full mb-1.5 sm:mb-2.5 inline-block shadow">
              ★ DESTAQUE DO PORTAL
            </span>
            
            <h2 class="text-sm xs:text-base sm:text-3xl font-black font-display text-white mb-1 sm:mb-2 max-w-2xl leading-tight">
              ${featuredEvent.title}
            </h2>
            
            <p class="hidden sm:block text-slate-200/90 text-xs max-w-xl mb-4 leading-relaxed line-clamp-2 font-semibold">
              ${featuredEvent.description}
            </p>
            
            <div class="flex flex-wrap items-center gap-y-1 gap-x-2 sm:gap-x-4 text-[9px] sm:text-xs font-bold text-white mb-2 sm:mb-4">
              <span class="flex items-center gap-1 bg-white/10 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full">
                <i data-lucide="calendar" class="w-3 sm:w-3.5 h-3 sm:h-3.5 text-blue-300"></i> 
                ${featuredEvent.date.split("-").reverse().join("/")}
              </span>
              <span class="flex items-center gap-1 bg-white/10 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full">
                <i data-lucide="clock" class="w-3 sm:w-3.5 h-3 sm:h-3.5 text-blue-300"></i> 
                ${featuredEvent.time}
              </span>
              <span class="flex items-center gap-1 bg-white/10 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full">
                <i data-lucide="map-pin" class="w-3 sm:w-3.5 h-3 sm:h-3.5 text-amber-300"></i> 
                ${featuredEvent.location}
              </span>
            </div>

            <div class="pt-0.5 flex flex-wrap gap-1.5 sm:gap-2.5">
              ${featuredEvent.isPaid ? `
                <a href="${featuredEvent.ticketLink || '#'}" target="_blank" class="bg-blue-500 hover:bg-blue-600 text-white font-black text-[9px] sm:text-xs px-3 py-1.5 sm:px-5 sm:py-3 rounded-full shadow-lg flex items-center gap-1 sm:gap-1.5 transition-all active:scale-95 cursor-pointer">
                  <i data-lucide="ticket" class="w-3 h-3 sm:w-4 sm:h-4"></i>
                  <span>Ingressos (${featuredEvent.ticketPrice || 'R$ 0,00'})</span>
                  <i data-lucide="external-link" class="w-3 h-3 stroke-[3]"></i>
                </a>
              ` : `
                <span class="bg-emerald-500 text-white font-black text-[9px] sm:text-xs px-3 py-1.5 sm:px-5 sm:py-3 rounded-full flex items-center gap-1 shadow">
                  <span>Gratuito</span>
                </span>
              `}
              
              <button onclick="scrollToEvent('event-card-${featuredEvent.id}')" class="bg-white/15 hover:bg-white/25 text-white font-bold text-[9px] sm:text-xs px-3 py-1.5 sm:px-5 sm:py-3 rounded-full border border-white/20 transition-all flex items-center gap-1 cursor-pointer">
                Ver no Feed <i data-lucide="chevron-right" class="w-3 h-3 sm:w-4 sm:h-4"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (featuredSection) {
    featuredSection.classList.add("hidden");
  }
  
  // Render Main Grid List
  eventsContainer.innerHTML = "";
  
  if (filtered.length === 0) {
    eventsContainer.innerHTML = `
      <div class="col-span-full py-16 px-4 text-center space-y-4">
        <div class="w-16 h-16 bg-blue-500/10 border border-blue-500/10 rounded-full flex items-center justify-center text-blue-400 mx-auto">
          <i data-lucide="calendar" class="w-8 h-8"></i>
        </div>
        <div class="space-y-1">
          <h3 class="text-lg font-bold">Nenhum evento encontrado</h3>
          <p class="text-xs text-slate-400 max-w-sm mx-auto">Tente alterar os filtros de categoria, data ou digite outros termos de busca.</p>
        </div>
        <button onclick="clearAllFilters()" class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-full transition-all cursor-pointer">
          Limpar Filtros
        </button>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }
  
  filtered.forEach(event => {
    const isFav = favorites.includes(event.id);
    const categoryInfo = CATEGORY_MAP[event.category] || CATEGORY_MAP.all;
    
    // Check ownership to allow deletion
    const isOwner = currentUser && event.organizer === currentUser.name;
    
    const card = document.createElement("article");
    card.id = `event-card-${event.id}`;
    card.className = `border-2 rounded-[20px] sm:rounded-[28px] overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col group h-full relative text-left
      ${theme === "dark" 
        ? event.isPaid ? "bg-[#0e172e] border-blue-500/30" : "bg-[#0e162a] border-white/5"
        : event.isPaid ? "bg-white border-blue-400 shadow-md" : "bg-white border-slate-200/80"}`;
        
    card.innerHTML = `
      <!-- Event image & category -->
      <div class="relative h-40 sm:h-48 w-full overflow-hidden shrink-0 border-b border-white/5">
        <img
          src="${event.imageUrl}"
          alt="${event.title}"
          class="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
          loading="lazy"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent"></div>
        
        <span class="absolute top-4 left-4 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow border backdrop-blur-md bg-slate-900/80 text-white border-white/10">
          ${categoryInfo.label}
        </span>
        
        <!-- Action buttons inside image header -->
        <div class="absolute top-4 right-4 flex items-center gap-2">
          ${isOwner ? `
            <button onclick="deleteEvent('${event.id}')" class="p-2 bg-red-600/90 hover:bg-red-700 text-white rounded-full shadow-lg cursor-pointer backdrop-blur-sm active:scale-90 transition-all" title="Excluir Evento">
              <i data-lucide="trash" class="w-3.5 h-3.5"></i>
            </button>
          ` : ''}
          
          <button onclick="toggleFavorite('${event.id}')" class="p-2 rounded-full shadow-lg cursor-pointer backdrop-blur-sm bg-slate-900/85 hover:bg-slate-950 text-white border border-white/10 active:scale-90 transition-all">
            <i data-lucide="heart" class="w-3.5 h-3.5 ${isFav ? 'fill-red-500 text-red-500' : 'text-white'}"></i>
          </button>
        </div>
      </div>

      <!-- Card Body -->
      <div class="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div class="space-y-2">
          <h3 class="text-base font-extrabold tracking-tight leading-snug font-display line-clamp-2 hover:text-blue-400 transition-colors
            ${theme === "dark" ? "text-white" : "text-slate-900"}"
          >
            ${event.title}
          </h3>
          
          <p class="text-xs font-medium leading-relaxed line-clamp-3
            ${theme === "dark" ? "text-slate-400" : "text-slate-500"}"
          >
            ${event.description}
          </p>
        </div>

        <div class="mt-4 pt-4 border-t space-y-3 shrink-0 ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}">
          <!-- Event core stats -->
          <div class="grid grid-cols-2 gap-2 text-[11px] font-bold">
            <span class="flex items-center gap-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}">
              <i data-lucide="calendar" class="w-3.5 h-3.5 text-blue-400"></i>
              ${event.date.split("-").reverse().join("/")}
            </span>
            <span class="flex items-center gap-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}">
              <i data-lucide="clock" class="w-3.5 h-3.5 text-blue-400"></i>
              ${event.time}
            </span>
          </div>

          <span class="flex items-center gap-1.5 text-[11px] font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'} truncate">
            <i data-lucide="map-pin" class="w-3.5 h-3.5 text-amber-500 shrink-0"></i>
            <span class="truncate">${event.location}</span>
          </span>

          <!-- Creator/Organizer Badge -->
          <div class="flex items-center justify-between gap-2 pt-1">
            <span class="text-[9px] font-bold uppercase tracking-wider text-slate-500 truncate max-w-[120px]" title="Organizador">
              By: ${event.organizer}
            </span>
            
            <!-- Price and Link CTA -->
            <div>
              ${event.isPaid ? `
                <a href="${event.ticketLink || '#'}" target="_blank" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-full text-[10px] font-extrabold shadow flex items-center gap-1 cursor-pointer transition-all">
                  <i data-lucide="ticket" class="w-3 h-3"></i>
                  <span>Ingressos (${event.ticketPrice || 'R$ 0,00'})</span>
                </a>
              ` : `
                <span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider">
                  Gratuito
                </span>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
    
    eventsContainer.appendChild(card);
  });
  
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Favorite Toggle handling
function toggleFavorite(eventId) {
  const idx = favorites.indexOf(eventId);
  if (idx > -1) {
    favorites.splice(idx, 1);
  } else {
    favorites.push(eventId);
  }
  localStorage.setItem("alagoinhas_favorites", JSON.stringify(favorites));
  renderEvents();
}

// Delete Event (Owner only)
function deleteEvent(eventId) {
  if (confirm("Tem certeza que deseja excluir seu evento anunciado?")) {
    events = events.filter(e => e.id !== eventId);
    localStorage.setItem("alagoinhas_events", JSON.stringify(events));
    renderEvents();
    renderCalendar();
    updateFiltersDisplay();
  }
}

// Scrolling down helper
function scrollToEvent(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
}

// Setup Event listeners for buttons
function setupEventListeners() {
  // Theme Toggle Header
  const themeBtn = document.getElementById("theme-toggle-btn");
  if (themeBtn) {
    themeBtn.onclick = () => {
      theme = theme === "dark" ? "light" : "dark";
      localStorage.setItem("alagoinhas_theme", theme);
      applyTheme();
      renderEvents();
      renderCalendar();
    };
  }
  
  // Sidebar Toggler
  const sidebarBtn = document.getElementById("btn-menu-sidebar");
  const sidebarEl = document.getElementById("app-sidebar");
  const sidebarOverlay = document.getElementById("sidebar-overlay");
  
  if (sidebarBtn && sidebarEl && sidebarOverlay) {
    const toggleSidebar = () => {
      sidebarOpen = !sidebarOpen;
      if (sidebarOpen) {
        sidebarEl.classList.remove("-translate-x-full");
        sidebarOverlay.classList.remove("hidden", "opacity-0");
        sidebarOverlay.classList.add("opacity-100");
      } else {
        sidebarEl.classList.add("-translate-x-full");
        sidebarOverlay.classList.remove("opacity-100");
        sidebarOverlay.classList.add("opacity-0");
        setTimeout(() => {
          if (!sidebarOpen) sidebarOverlay.classList.add("hidden");
        }, 300);
      }
    };
    
    sidebarBtn.onclick = toggleSidebar;
    sidebarOverlay.onclick = toggleSidebar;
    
    // Close button in sidebar
    const sidebarClose = document.getElementById("sidebar-close-btn");
    if (sidebarClose) sidebarClose.onclick = toggleSidebar;
  }
  
  // Search Box Inputs
  const searchInput = document.getElementById("search-input");
  const clearSearchBtn = document.getElementById("clear-search-btn");
  
  if (searchInput) {
    searchInput.oninput = (e) => {
      searchQuery = e.target.value;
      renderEvents();
      updateFiltersDisplay();
      if (clearSearchBtn) {
        if (searchQuery !== "") {
          clearSearchBtn.classList.remove("hidden");
        } else {
          clearSearchBtn.classList.add("hidden");
        }
      }
    };
  }
  
  if (clearSearchBtn) {
    clearSearchBtn.onclick = () => {
      searchQuery = "";
      if (searchInput) searchInput.value = "";
      clearSearchBtn.classList.add("hidden");
      renderEvents();
      updateFiltersDisplay();
    };
  }
  
  // Category Pill Filter rendering & interaction
  const categoryContainer = document.getElementById("category-filters-pills");
  if (categoryContainer) {
    categoryContainer.innerHTML = "";
    Object.keys(CATEGORY_MAP).forEach(catKey => {
      const cat = CATEGORY_MAP[catKey];
      const pill = document.createElement("button");
      pill.className = `px-4 py-2 sm:py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer border select-none active:scale-95`;
      pill.id = `btn-category-tab-${catKey}`;
      pill.textContent = cat.label;
      pill.onclick = () => selectCategoryFilter(catKey);
      categoryContainer.appendChild(pill);
    });
    updateCategoryPillState();
  }
  
  // Modal forms setup
  const eventFormEl = document.getElementById("add-event-form");
  if (eventFormEl) {
    eventFormEl.onsubmit = handleAddEventSubmit;
  }
  
  // Preset Avatar selecting in Login modal
  const avatarList = document.getElementById("login-avatars-list");
  if (avatarList) {
    avatarList.innerHTML = "";
    AVATAR_PRESETS.forEach((preset, idx) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "p-3 border rounded-2xl flex flex-col items-center justify-center gap-1 bg-white/5 hover:bg-white/10 cursor-pointer border-white/10 active:scale-95 transition-all";
      card.id = `avatar-choice-${idx}`;
      card.onclick = () => selectAvatarChoice(idx);
      card.innerHTML = `
        <span class="text-3xl">${preset.icon}</span>
        <span class="text-[9px] font-bold text-slate-300 truncate max-w-[70px]">${preset.name}</span>
      `;
      avatarList.appendChild(card);
    });
  }
  
  // Paid option toggling in the add event form
  const isPaidCheckbox = document.getElementById("form-is-paid");
  const paidFields = document.getElementById("form-paid-fields");
  if (isPaidCheckbox && paidFields) {
    isPaidCheckbox.onchange = (e) => {
      if (e.target.checked) {
        paidFields.classList.remove("hidden");
      } else {
        paidFields.classList.add("hidden");
      }
    };
  }
}

// Toggle pill color states
function selectCategoryFilter(catKey) {
  selectedCategory = catKey;
  updateCategoryPillState();
  renderEvents();
  updateFiltersDisplay();
}

function updateCategoryPillState() {
  Object.keys(CATEGORY_MAP).forEach(catKey => {
    const pill = document.getElementById(`btn-category-tab-${catKey}`);
    if (!pill) return;
    
    const isActive = selectedCategory === catKey;
    if (isActive) {
      pill.className = "px-4 py-2 sm:py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer border select-none active:scale-95 bg-blue-600 text-white border-blue-600 shadow-md scale-[1.02]";
    } else {
      if (theme === "dark") {
        pill.className = "px-4 py-2 sm:py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer border select-none active:scale-95 bg-[#0e162a] text-slate-300 border-white/5 hover:bg-white/5 hover:text-white";
      } else {
        pill.className = "px-4 py-2 sm:py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer border select-none active:scale-95 bg-white text-slate-600 border-slate-200 hover:bg-blue-50 hover:text-blue-900";
      }
    }
  });
}

// Sidebars & checkbox lists categories setup
function toggleFavoriteFilter(checkbox) {
  showOnlyFavorites = checkbox.checked;
  renderEvents();
  updateFiltersDisplay();
}

// Active filters display counters & clear buttons
function updateFiltersDisplay() {
  const container = document.getElementById("active-filters-bar");
  const pillsList = document.getElementById("active-filters-list");
  if (!container || !pillsList) return;
  
  const hasActiveFilters = selectedDate || selectedCategory !== "all" || searchQuery !== "" || showOnlyFavorites;
  
  if (!hasActiveFilters) {
    container.classList.add("hidden");
    pillsList.innerHTML = "";
    return;
  }
  
  container.classList.remove("hidden");
  pillsList.innerHTML = "";
  
  // Date pill
  if (selectedDate) {
    const formatted = selectedDate.split("-").reverse().join("/");
    pillsList.appendChild(createFilterBadge(`Data: ${formatted}`, () => {
      selectedDate = null;
      renderCalendar();
      renderEvents();
      updateFiltersDisplay();
    }));
  }
  
  // Category pill
  if (selectedCategory !== "all") {
    const label = CATEGORY_MAP[selectedCategory]?.label || selectedCategory;
    pillsList.appendChild(createFilterBadge(`Categoria: ${label}`, () => {
      selectedCategory = "all";
      updateCategoryPillState();
      renderEvents();
      updateFiltersDisplay();
    }));
  }
  
  // Search text pill
  if (searchQuery !== "") {
    pillsList.appendChild(createFilterBadge(`Busca: "${searchQuery}"`, () => {
      searchQuery = "";
      const input = document.getElementById("search-input");
      if (input) input.value = "";
      const btn = document.getElementById("clear-search-btn");
      if (btn) btn.classList.add("hidden");
      renderEvents();
      updateFiltersDisplay();
    }));
  }
  
  // Only Favorites
  if (showOnlyFavorites) {
    pillsList.appendChild(createFilterBadge("Apenas Favoritos", () => {
      showOnlyFavorites = false;
      const chkSidebar = document.getElementById("fav-only-checkbox");
      if (chkSidebar) chkSidebar.checked = false;
      renderEvents();
      updateFiltersDisplay();
    }));
  }
}

function createFilterBadge(text, onClear) {
  const badge = document.createElement("div");
  badge.className = "flex items-center gap-1.5 px-3 py-1 bg-blue-600/10 border border-blue-500/20 rounded-full text-[10px] font-bold text-blue-400";
  badge.innerHTML = `
    <span>${text}</span>
    <button class="hover:text-white transition-colors cursor-pointer text-slate-400 font-bold text-[10px]" onclick="(${onClear.toString()})()">×</button>
  `;
  return badge;
}

// Clear all active filters helper
function clearAllFilters() {
  selectedDate = null;
  selectedCategory = "all";
  searchQuery = "";
  showOnlyFavorites = false;
  
  // Reset fields
  const sInput = document.getElementById("search-input");
  if (sInput) sInput.value = "";
  
  const clearSBtn = document.getElementById("clear-search-btn");
  if (clearSBtn) clearSBtn.classList.add("hidden");
  
  const chkSidebar = document.getElementById("fav-only-checkbox");
  if (chkSidebar) chkSidebar.checked = false;
  
  updateCategoryPillState();
  renderCalendar();
  renderEvents();
  updateFiltersDisplay();
}

// Create Event submitting handler
function handleAddEventSubmit(e) {
  e.preventDefault();
  
  const title = document.getElementById("form-title").value;
  const description = document.getElementById("form-desc").value;
  const category = document.getElementById("form-cat").value;
  const date = document.getElementById("form-date").value;
  const time = document.getElementById("form-time").value;
  const location = document.getElementById("form-location").value;
  const imageUrlInput = document.getElementById("form-img").value;
  const isPaid = document.getElementById("form-is-paid").checked;
  const ticketPrice = document.getElementById("form-price").value;
  const ticketLink = document.getElementById("form-ticket-link").value;
  
  // Check login required to post events
  if (!currentUser) {
    alert("Por favor, faça login ou identifique-se clicando em 'Entrar' no topo para poder anunciar eventos!");
    closeAddEventModal();
    openLoginModal();
    return;
  }
  
  const defaultImage = "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&auto=format&fit=crop&q=60";
  const finalImageUrl = imageUrlInput.trim() !== "" ? imageUrlInput : defaultImage;
  
  const newEvent = {
    id: String(Date.now()),
    title,
    description,
    category,
    date,
    time,
    location,
    imageUrl: finalImageUrl,
    organizer: currentUser.name,
    isFeatured: false,
    createdTimestamp: Date.now(),
    isPaid,
    ticketPrice: isPaid ? ticketPrice : undefined,
    ticketLink: isPaid ? ticketLink : undefined
  };
  
  events.push(newEvent);
  localStorage.setItem("alagoinhas_events", JSON.stringify(events));
  
  // Success flow
  playChime();
  closeAddEventModal();
  renderEvents();
  renderCalendar();
  updateFiltersDisplay();
  
  // Dynamic Alert box toast
  showToastNotification(`Seu evento "${title}" foi anunciado com sucesso no portal!`);
  
  // Reset form
  document.getElementById("add-event-form").reset();
  document.getElementById("form-paid-fields").classList.add("hidden");
}

// Custom Toast notifications
function showToastNotification(msg) {
  const toast = document.createElement("div");
  toast.className = "fixed bottom-5 right-5 z-50 p-4 rounded-2xl bg-slate-900 border border-emerald-500/30 text-white shadow-2xl animate-fade-in max-w-sm flex items-center gap-3";
  toast.innerHTML = `
    <div class="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
      <i data-lucide="check" class="w-4.5 h-4.5"></i>
    </div>
    <div>
      <h4 class="text-xs font-black uppercase text-emerald-400">Portal de Eventos</h4>
      <p class="text-[11px] text-slate-300 font-semibold mt-0.5 leading-snug">${msg}</p>
    </div>
  `;
  document.body.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();
  
  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-2", "transition-all", "duration-300");
    setTimeout(() => toast.remove(), 350);
  }, 4500);
}

// Preset User / Login interactions
let selectedAvatarIdx = 0;
function selectAvatarChoice(idx) {
  selectedAvatarIdx = idx;
  AVATAR_PRESETS.forEach((p, i) => {
    const card = document.getElementById(`avatar-choice-${i}`);
    if (!card) return;
    if (i === idx) {
      card.className = "p-3 border-2 rounded-2xl flex flex-col items-center justify-center gap-1 bg-blue-500/10 border-blue-500 active:scale-95 transition-all scale-102 shadow-lg";
    } else {
      card.className = "p-3 border rounded-2xl flex flex-col items-center justify-center gap-1 bg-white/5 hover:bg-white/10 cursor-pointer border-white/10 active:scale-95 transition-all";
    }
  });
}

function handleLoginSubmit() {
  const nameInput = document.getElementById("login-username-field").value;
  if (!nameInput.trim()) {
    alert("Por favor, digite seu nome ou alcunha regional!");
    return;
  }
  
  currentUser = {
    name: nameInput,
    avatarIdx: selectedAvatarIdx
  };
  
  localStorage.setItem("alagoinhas_user", JSON.stringify(currentUser));
  renderHeaderUser();
  renderEvents();
  closeLoginModal();
  showToastNotification(`Bem-vindo, ${currentUser.name}! Pronto para anunciar eventos locais.`);
}

function handleLogout() {
  if (confirm("Deseja desconectar sua conta local?")) {
    currentUser = null;
    localStorage.removeItem("alagoinhas_user");
    renderHeaderUser();
    renderEvents();
    closeLoginModal();
  }
}

// Modal control functions
function openAddEventModal() {
  if (!currentUser) {
    alert("Identifique-se primeiro para poder anunciar eventos, por enquanto tá sem backend, então tem esse cadastro fudido ai!");
    openLoginModal();
    return;
  }
  document.getElementById("modal-add-event").classList.remove("hidden");
}
function closeAddEventModal() {
  document.getElementById("modal-add-event").classList.add("hidden");
}

function openSettingsModal() {
  document.getElementById("modal-settings").classList.remove("hidden");
}
function closeSettingsModal() {
  document.getElementById("modal-settings").classList.add("hidden");
}

function openLoginModal() {
  const modal = document.getElementById("modal-login");
  modal.classList.remove("hidden");
  
  const loginBody = document.getElementById("login-box-body");
  const loggedBody = document.getElementById("logged-box-body");
  
  if (currentUser) {
    loginBody.classList.add("hidden");
    loggedBody.classList.remove("hidden");
    
    document.getElementById("logged-user-avatar").innerHTML = AVATAR_PRESETS[currentUser.avatarIdx]?.icon;
    document.getElementById("logged-user-name").textContent = currentUser.name;
    document.getElementById("logged-user-title").textContent = AVATAR_PRESETS[currentUser.avatarIdx]?.name;
  } else {
    loginBody.classList.remove("hidden");
    loggedBody.classList.add("hidden");
    selectAvatarChoice(0);
  }
}
function closeLoginModal() {
  document.getElementById("modal-login").classList.add("hidden");
}

// Reset Local Data
function clearAllLocalStorage() {
  if (confirm("Isso apagará todas as suas preferências, eventos cadastrados e curtidas locais. Deseja prosseguir?")) {
    localStorage.clear();
    location.reload();
  }
}