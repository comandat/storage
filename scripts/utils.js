// --- Navigare SPA ---
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    const activePage = document.getElementById(pageId);
    if (activePage) {
        activePage.classList.add('active');
        document.getElementById('app-container').scrollTop = 0;
    }

    const bubble = document.getElementById('floating-order-bubble');
    const notifFooter = document.getElementById('notification-footer');
    
    if (pageId === 'page-dashboard') {
        setupDashboardNotification(); // Acum gestionează și footer-ul
    } else {
        bubble.classList.remove('visible');
        notifFooter.style.display = 'none'; // Ascunde footer-ul de notificare
    }

    // Resetează fluxurile la intrare
    if (pageId === 'page-add-product') {
        resetAddFlow(false);
    }
     if (pageId === 'page-move-product') {
        resetMoveFlow(false);
    }
    if (pageId === 'page-picking') {
        startPickingProcess();
        setupPickingPageFooter(true); // Arată footer-ul de picking
    } else {
        setupPickingPageFooter(false); // Ascunde footer-ul de picking
    }
}

function setupPickingPageFooter(show) {
    const footer = document.getElementById('picking-footer');
    if (show) {
        // Verifică dacă picking-ul e completat
        const complete = document.getElementById('picking-complete').style.display !== 'none';
        footer.style.display = complete ? 'none' : 'block';
    } else {
        footer.style.display = 'none';
    }
}

// --- Logică LocalStorage ---
function loadFromLocalStorage(key, defaultValue = {}) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
}
function saveToLocalStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

// --- Funcții Utilitare UI ---
function formatLocation(locationKey, large = false) {
    const parts = locationKey.split(',');
    if (parts.length === 3) {
        if (large) {
            // Format mare pentru paginile de picking și adăugare
            return `
                <span class="block">Rand: <span class="text-4xl">${parts[0]}</span></span>
                <span class="block">Deschidere: <span class="text-4xl">${parts[1]}</span></span>
                <span class="block">Poliță: <span class="text-4xl">${parts[2]}</span></span>
            `;
        }
        return `Rand: <span class="font-bold">${parts[0]}</span>, Deschidere: <span class="font-bold">${parts[1]}</span>, Poliță: <span class="font-bold">${parts[2]}</span>`;
    }
    return locationKey;
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.backgroundColor = isError ? '#E53E3E' : '#007AFF';
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showLoading(isLoading) {
    document.getElementById('loading-overlay').style.display = isLoading ? 'flex' : 'none';
}

// ExpuN funcțiile necesare global
window.showPage = showPage;
