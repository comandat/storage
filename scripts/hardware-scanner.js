// scripts/hardware-scanner.js

let scanBuffer = '';
let lastKeyTime = 0;

// Timpul maxim (ms) permis între taste pentru a considera că fac parte din aceeași secvență.
// Dacă depășești acest timp, se consideră tastare manuală lentă și se resetează ce s-a adunat.
const TYPING_TIMEOUT = 300; 

document.addEventListener('keydown', async (e) => {
    const currentTime = Date.now();

    // 1. Resetăm buffer-ul dacă a trecut prea mult timp de la ultima tastă
    if (currentTime - lastKeyTime > TYPING_TIMEOUT) {
        if (scanBuffer.length > 0) {
            scanBuffer = '';
        }
    }
    lastKeyTime = currentTime;

    // 2. Tasta Enter indică finalul scanării
    if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        
        // Dacă s-a adunat un cod valid, îl procesăm
        if (scanBuffer.length > 1) {
            const codeToProcess = scanBuffer;
            scanBuffer = ''; // Golim buffer-ul imediat pentru următoarea scanare
            
            await processHardwareScan(codeToProcess);
        }
        return;
    }

    // 3. Colectăm caracterele
    // Suportăm și cazul în care Honeywell trimite mai multe caractere deodată pe modul Keyboard, 
    // dar ignorăm tastele speciale gen Shift, Control, Unidentified
    if (e.key.length > 1 && e.key !== 'Unidentified' && e.key !== 'Shift' && e.key !== 'Control') {
         scanBuffer += e.key;
    } else if (e.key.length === 1) {
         scanBuffer += e.key;
    }
});

// Funcția originală care trimite codul către pagini
async function processHardwareScan(code) {
    console.log("Hardware Scan Detected:", code);
    
    // Determinăm pagina activă
    const activePage = document.querySelector('.page.active');
    const pageId = activePage ? activePage.id : '';
    
    // Curățăm codul (uppercase, trim spaces)
    const cleanCode = code.trim().toUpperCase();

    // --- LOGICA: ADĂUGĂ PRODUS ---
    if (pageId === 'page-add-product') {
        if (cleanCode.startsWith('B')) {
            if (window.quickAddProductBySku) {
                await window.quickAddProductBySku(cleanCode);
            }
            return;
        }
        
        if (/^\d+,/.test(cleanCode)) {
            if (window.scannedProductList && window.scannedProductList.length > 0) {
                if (window.handleLocationScan) window.handleLocationScan(cleanCode);
            } else {
                window.showToast("Adaugă produse în listă înainte de a scana locația.", true);
            }
            return;
        }
    }

    // --- LOGICA: ȘTERGE PRODUS ---
    if (pageId === 'page-delete-product') {
        if (cleanCode.startsWith('B')) {
            if (window.quickDeleteProductBySku) {
                await window.quickDeleteProductBySku(cleanCode);
            }
            return;
        }

        if (/^\d+,/.test(cleanCode)) {
            if (window.deleteProductList && window.deleteProductList.length > 0) {
                if (window.handleDeleteLocationScan) window.handleDeleteLocationScan(cleanCode);
            } else {
                window.showToast("Scanează produse înainte de a scana locația.", true);
            }
            return;
        }
    }

    // --- LOGICA: GENERALĂ (HOME / DASHBOARD / SEARCH) ---
    if (cleanCode.startsWith('B')) {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.value = cleanCode;
            if (window.searchProducts) window.searchProducts(); 
            if (window.toggleSearchFocus) window.toggleSearchFocus(true);
            
            if (pageId !== 'page-dashboard') {
                window.showPage('page-dashboard');
                setTimeout(() => {
                   if(window.toggleSearchFocus) window.toggleSearchFocus(true);
                   if(window.searchProducts) window.searchProducts();
                }, 100);
            }
        }
    }
}
