// scripts/hardware-scanner.js

let scanBuffer = '';
let lastKeyTime = 0;
let scanTimeout; // Variabilă nouă pentru a stoca timer-ul

// Timpul maxim (ms) permis între taste pentru a considera că fac parte din aceeași secvență
const TYPING_TIMEOUT = 300; 
// Timpul de așteptare (ms) după ultima tastă pentru a declanșa procesarea automată
const PROCESS_TIMEOUT = 50; 

document.addEventListener('keydown', async (e) => {
    // Ignorăm tasta Enter complet, dar îi dăm preventDefault ca să nu facă submit la vreun formular accidental
    if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        return;
    }

    // Ne interesează doar caracterele simple (litere, cifre, simboluri de lungime 1)
    if (e.key.length !== 1) return;

    const currentTime = Date.now();

    // 1. Dacă a trecut prea mult timp de la ultima tastă (>300ms), 
    // înseamnă că probabil cineva tastează manual, deci resetăm bufferul.
    if (currentTime - lastKeyTime > TYPING_TIMEOUT) {
        if (scanBuffer.length > 0) {
            scanBuffer = '';
        }
    }
    
    lastKeyTime = currentTime;

    // 2. Acumulăm caracterul
    scanBuffer += e.key;

    // 3. Resetăm timer-ul la fiecare caracter nou primit
    clearTimeout(scanTimeout);

    // 4. Setăm un nou timer. Dacă trec 50ms fără nicio tastă nouă, procesăm scanarea.
    scanTimeout = setTimeout(async () => {
        // Dacă bufferul are suficiente caractere, îl considerăm cod scanat
        if (scanBuffer.length > 1) { 
            if (e.preventDefault) e.preventDefault();
            
            // Salvăm codul și curățăm bufferul imediat pentru a fi gata de o nouă scanare
            const codeToProcess = scanBuffer;
            scanBuffer = ''; 
            
            await processHardwareScan(codeToProcess);
        }
    }, PROCESS_TIMEOUT);
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
