// --- Inițializare ---
document.addEventListener("DOMContentLoaded", () => {
    html5QrCode = new Html5Qrcode("reader", { 
        rememberLastUsedCamera: true,
        experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
        },
        // OPTIMIZARE: Spune bibliotecii să caute DOAR coduri QR
        formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE
        ]
    });
    loadInitialStorage(); // Încarcă stocul și apoi preia comenzile
    showPage('page-dashboard');

    // Listener pentru a închide căutarea dacă se dă click în afara ei
    document.getElementById('app-container').addEventListener('click', (e) => {
        const searchForm = document.getElementById('search-form');
        if (!searchForm.contains(e.target) && !document.getElementById('find-results').contains(e.target)) {
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

