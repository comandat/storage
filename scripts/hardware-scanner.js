// scripts/hardware-scanner.js

let scanBuffer = '';
let lastKeyTime = 0;
// Timpul maxim (ms) între taste pentru a fi considerat scanner. 
// Scanerele trimit caracterele foarte rapid (10-30ms). Tastarea manuală e > 100ms.
const SCANNER_TIMEOUT = 300; 

document.addEventListener('keydown', async (e) => {
    const currentTime = Date.now();
    const char = e.key;

    // 1. Logica de detecție a vitezei
    // Dacă a trecut prea mult timp de la ultima tastă, resetăm bufferul 
    // (presupunem că a început o nouă secvență sau e tastare manuală)
    if (currentTime - lastKeyTime > SCANNER_TIMEOUT) {
        // Excepție: Dacă bufferul e gol, e prima tastă, deci e ok.
        // Dacă bufferul avea ceva, îl ștergem pentru că a fost o pauză prea lungă.
        if (scanBuffer.length > 0) {
            scanBuffer = '';
        }
    }
    lastKeyTime = currentTime;

    // 2. Procesarea tastei 'Enter' (sfârșit de scanare)
    if (char === 'Enter') {
        // Dacă bufferul e suficient de lung, îl considerăm cod scanat
        if (scanBuffer.length > 1) { 
            e.preventDefault(); // Prevenim submiterea formularelor standard
            e.stopPropagation();
            
            await processHardwareScan(scanBuffer);
            scanBuffer = ''; // Resetăm după procesare
        }
        return;
    }

    // 3. Acumularea caracterelor (doar caractere printabile, lungime 1)
    if (char.length === 1) {
        scanBuffer += char;
    }
});

async function processHardwareScan(code) {
    console.log("Hardware Scan Detected:", code);
    
    // Determinăm pagina activă
    const activePage = document.querySelector('.page.active');
    const pageId = activePage ? activePage.id : '';
    
    // Curățăm codul (uppercase, trim spaces)
    const cleanCode = code.trim();
    const upperCode = cleanCode.toUpperCase();

    // --- LOGICA: ADĂUGĂ PRODUS ---
    if (pageId === 'page-add-product') {
        // CAZ 1: Produs (Începe cu B)
        if (upperCode.startsWith('B')) {
            if (window.quickAddProductBySku) {
                await window.quickAddProductBySku(cleanCode);
            }
            return;
        }
        
        // CAZ 2: Locație (Număr urmat de virgulă ex: "1,"...)
        // Regex: Începe cu una sau mai multe cifre, urmat de virgulă
        if (/^\d+,/.test(cleanCode)) {
            // Verificăm dacă avem produse în listă înainte de a încerca mutarea
            if (window.scannedProductList && window.scannedProductList.length > 0) {
                if (window.handleLocationScan) {
                    window.handleLocationScan(cleanCode);
                }
            } else {
                window.showToast("Adaugă produse în listă înainte de a scana locația.", true);
            }
            return;
        }
    }

    // --- LOGICA: ȘTERGE PRODUS ---
    if (pageId === 'page-delete-product') {
        // CAZ 1: Produs (Începe cu B)
        if (upperCode.startsWith('B')) {
            if (window.quickDeleteProductBySku) {
                await window.quickDeleteProductBySku(cleanCode);
            }
            return;
        }

        // CAZ 2: Locație (Număr urmat de virgulă)
        if (/^\d+,/.test(cleanCode)) {
            if (window.deleteProductList && window.deleteProductList.length > 0) {
                if (window.handleDeleteLocationScan) {
                    window.handleDeleteLocationScan(cleanCode);
                }
            } else {
                window.showToast("Scanează produse înainte de a scana locația.", true);
            }
            return;
        }
    }

    // --- LOGICA: GENERALĂ (HOME / DASHBOARD / SEARCH) ---
    // Se aplică dacă suntem pe Dashboard SAU bara de search e focusată 
    // SAU (opțional) dacă nu s-a potrivit nimic mai sus.
    if (upperCode.startsWith('B')) {
        // Resetăm câmpul de search vizual ca să vedem codul
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.value = cleanCode;
            // Dacă funcția searchProducts există
            if (window.searchProducts) {
                window.searchProducts(); 
            }
            // Dacă funcția toggleSearchFocus există
            if (window.toggleSearchFocus) {
                window.toggleSearchFocus(true);
            }
            // Dacă suntem pe altă pagină decât dashboard/find, mergem acolo
            // (Deși cerința spunea HOME/Cauta, e bine de știut)
            if (pageId !== 'page-dashboard') {
                window.showPage('page-dashboard');
                // Mic delay pentru a permite randarea
                setTimeout(() => {
                   if(window.toggleSearchFocus) window.toggleSearchFocus(true);
                   if(window.searchProducts) window.searchProducts();
                }, 100);
            }
        }
    }
}
