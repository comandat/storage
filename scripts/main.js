// scripts/main.js

// --- Inițializare ---
document.addEventListener("DOMContentLoaded", () => {
    // Încarcă stocul și apoi preia comenzile (funcții din api.js)
    loadInitialStorage(); 
    showPage('page-dashboard');

    // Listener pentru a închide căutarea dacă se dă click în afara ei
    document.getElementById('app-container').addEventListener('click', (e) => {
        const searchForm = document.getElementById('search-form');
        const resultsContainer = document.getElementById('find-results');
        
        // Verifică dacă click-ul a fost în afara zonei de search
        if (searchForm && !searchForm.contains(e.target) && 
            resultsContainer && !resultsContainer.contains(e.target)) {
            toggleSearchFocus(false);
        }
    });
    
    // Event Listeners pentru Căutare
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', searchProducts);
        searchInput.addEventListener('focus', () => toggleSearchFocus(true));
    }
    
    // Setează starea inițială a footer-ului
    setupPickingPageFooter(false);
});

// --- Logică Settings / Refresh Token (NOU) ---

function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) {
        modal.classList.remove('hidden');
        // Focus automat pe textarea pentru paste rapid
        setTimeout(() => {
            const input = document.getElementById('settings-curl-input');
            if(input) input.focus();
        }, 100);
    }
}

function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    const input = document.getElementById('settings-curl-input');
    if (input) {
        input.value = ''; // Curăță inputul la închidere
    }
}

async function handleTokenSubmit() {
    const input = document.getElementById('settings-curl-input');
    const curlText = input ? input.value.trim() : '';
    
    if (!curlText) {
        showToast("Introdu textul cURL.", true);
        return;
    }
    
    // Apelăm funcția din api.js (sendPrintTokenUpdate)
    if (window.sendPrintTokenUpdate) {
        const success = await window.sendPrintTokenUpdate(curlText);
        
        if (success) {
            closeSettingsModal();
        }
    } else {
        console.error("Funcția sendPrintTokenUpdate nu este definită în api.js");
        showToast("Eroare internă.", true);
    }
}

// Expunem funcțiile global pentru a putea fi apelate din HTML (onclick="...")
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.handleTokenSubmit = handleTokenSubmit;
