// --- Starea Aplicației ---
let html5QrCode;
let currentScanMode = null; // 'product', 'location', 'find', 'move_product', 'move_destination'
const WEBHOOK_URL = "https://automatizare.comandat.ro/webhook/39e78a55-36c9-4948-aa2d-d9301c996562-test";
const STORAGE_WEBHOOK_URL = "https://automatizare.comandat.ro/webhook/storage-update";
const GET_STORAGE_WEBHOOK_URL = "https://automatizare.comandat.ro/webhook/get-storage";
const GET_ORDERS_WEBHOOK_URL = "https://automatizare.comandat.ro/webhook/8ba5359d-8ecd-4576-b44c-934ac4b661e2"; // <-- NOU

// Stare "Adaugă Produs" (modificat)
let scannedProductList = []; // Listă de {sku, product}
let scannedLocation = null;

// Stare "Mută Produs" (modificat)
let moveProductList = []; // Listă de {sku, product}
let moveSourceSelections = {}; // Format: { "SKU": { "loc": cantitate } }
let moveDestinationLocation = null;

// Stare Dashboard
let isOrderNotificationHidden = false;

// Date Mock (ȘTERS)
let liveOrders = []; // <-- NOU (înlocuiește mockOrders)

// Stare Picking
let pickingRoutes = [];
let currentRouteIndex = 0;
let currentStopIndex = 0;

// --- Inițializare ---
document.addEventListener("DOMContentLoaded", () => {
    html5QrCode = new Html5Qrcode("reader");
    // Am șters addDummyData()
    loadInitialStorage(); // Funcție nouă
    showPage('page-dashboard');

    document.getElementById('app-container').addEventListener('click', (e) => {
        const searchForm = document.getElementById('search-form');
        if (!searchForm.contains(e.target) && !document.getElementById('find-results').contains(e.target)) {
            toggleSearchFocus(false);
        }
    });
    
    // --- FIX ADĂUGAT: Event Listeners pentru Căutare ---
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', searchProducts);
        searchInput.addEventListener('focus', () => toggleSearchFocus(true));
    }
    // --- SFÂRȘIT FIX ---
    
    // Afișează pagina de picking corect (cu/fără footer)
    setupPickingPageFooter(false);
});

// --- Navigare SPA ---
function showPage(pageId) {
    // FIX 1: Corectat logica și sintaxa (paranteza lipsă)
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    }); // <-- AICI ERA EROAREA (lipsea ')' )
    
    const activePage = document.getElementById(pageId);
    if (activePage) {
        activePage.classList.add('active');
        document.getElementById('app-container').scrollTop = 0;
    }
    // --- SFÂRȘIT FIX 1 ---

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

// Funcția addDummyData a fost ȘTEARSĂ

/**
 * Funcție nouă: Încarcă stocul inițial de la webhook
 */
async function loadInitialStorage() {
    showLoading(true);
    try {
        // Presupunem GET. Dacă e nevoie de POST, schimbăm metoda.
        const response = await fetch(GET_STORAGE_WEBHOOK_URL, { method: 'GET' });
        if (!response.ok) {
            throw new Error(`Eroare HTTP: ${response.status}`);
        }
        const inventoryData = await response.json();
        
        // Salvăm direct datele primite, presupunând formatul: { "SKU1": { "loc1": 5 }, ... }
        saveToLocalStorage('inventoryLocations', inventoryData);
        console.log("Stoc încărcat de la webhook.", inventoryData);
        
        // Golește productDatabase-ul local pentru a forța re-sincronizarea numelor
        // sau am putea pre-încărca numele dacă vin în același call
        // Deocamdată, lăsăm cache-ul de produse să se construiască la cerere.
        // saveToLocalStorage('productDatabase', {}); // Opțional: forțează re-fetch de nume

    } catch (error) {
        console.error("Eroare la încărcarea stocului:", error);
        // showToast("Eroare la încărcarea stocului.", true); // <-- MODIFICARE: Am eliminat eroarea vizuală
        // Încarcă un stoc gol dacă eșuează
        saveToLocalStorage('inventoryLocations', {});
    } finally {
        showLoading(false);
        // Re-afișează pagina dashboard pentru a reflecta starea (notificări comenzi)
        // Modificat: Acum apelăm funcția care preia comenzile și actualizează notificările
        await fetchAndSetupOrders();
    }
}


// --- Logică Webhook ---

/**
 * Funcție nouă: Preluare comenzi de la API
 */
async function fetchAndSetupOrders() {
    // showLoading(true); // <-- MODIFICARE: Eliminat loading
    try {
        const response = await fetch(GET_ORDERS_WEBHOOK_URL);
        if (!response.ok) throw new Error(`Eroare HTTP: ${response.status}`);
        liveOrders = await response.json(); // Store in global
        
        // Handle potential empty response or non-array
        if (!Array.isArray(liveOrders)) {
            console.warn("Răspunsul de la API-ul de comenzi nu a fost un array.", liveOrders);
            liveOrders = [];
        }
        
    } catch (error) {
        console.error("Eroare la preluarea comenzilor:", error);
        showToast("Eroare la preluarea comenzilor.", true);
        liveOrders = [];
    } finally {
        // showLoading(false); // <-- MODIFICARE: Eliminat loading
        // Call this here, regardless of which page is active
        setupDashboardNotification(); 
    }
}

/**
 * Trimite actualizări de stoc către webhook-ul de stocare.
 */
async function sendStorageUpdate(sku, location, operation_type, value) {
    if (!sku || !location || !operation_type || value <= 0) {
        console.warn("Actualizare stoc anulată, date invalide:", { sku, location, operation_type, value });
        return;
    }
    
    const payload = {
        sku: sku,
        location: location,
        operation_type: operation_type, // "adunare" sau "scadere"
        value: value
    };

    try {
        const response = await fetch(STORAGE_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            throw new Error(`Eroare Webhook Stoc: ${response.status}`);
        }
        console.log("Actualizare stoc trimisă:", payload);
    } catch (error) {
        console.error("Eroare la trimiterea actualizării de stoc:", error);
        // Nu bloca utilizatorul, doar înregistrează eroarea
        // showToast("Eroare sincronizare stoc.", true);
    }
}

function extractAsinFromSku(sku) {
    const suffixes = ["CN", "FB", "B"];
    for (const suffix of suffixes) {
        if (sku.endsWith(suffix) && sku.length > suffix.length) {
            return sku.slice(0, -suffix.length);
        }
    }
    return sku;
}

/**
 * (NOU) Preia detalii pentru mai multe SKU-uri într-un singur apel API.
 * @param {string[]} skus - O listă de SKU-uri de preluat.
 * @returns {Object} Un obiect map { sku -> productDetails }
 */
async function fetchProductDetailsBatch(skus) {
    const productDB = loadFromLocalStorage('productDatabase');
    const productsToReturn = {};
    const skuToAsinMap = new Map(); // K: sku, V: asin
    const asinToSkuMap = new Map(); // K: asin, V: [sku1, sku2] (pentru mapare inversă)

    // Pasul 1: Verifică cache-ul și pregătește lista de preluare
    for (const sku of skus) {
        if (productDB[sku]) {
            productsToReturn[sku] = productDB[sku];
        } else {
            const asin = extractAsinFromSku(sku);
            skuToAsinMap.set(sku, asin);
            
            if (!asinToSkuMap.has(asin)) {
                asinToSkuMap.set(asin, []);
            }
            asinToSkuMap.get(asin).push(sku);
        }
    }

    const asinsToFetchUnique = Array.from(asinToSkuMap.keys());

    // Pasul 2: Dacă nu e nimic de preluat, returnează ce e din cache
    if (asinsToFetchUnique.length === 0) {
        return productsToReturn;
    }

    // Pasul 3: Preluare API
    showLoading(true);
    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ asins: asinsToFetchUnique }) // Trimite lista de ASIN-uri
        });

        if (!response.ok) {
            throw new Error(`Eroare HTTP: ${response.status}`);
        }

        // Presupunem că răspunsul este un obiect: { "ASIN1": { details }, "ASIN2": { details } }
        const asinDataMap = await response.json();

        // Pasul 4: Procesează răspunsul și actualizează cache-ul
        for (const [asin, productData] of Object.entries(asinDataMap)) {
            // Normalizează datele primite
            if (!productData.name_en || !productData.name_ro) {
                productData.name_en = productData.name_en || asin;
                productData.name_ro = productData.name_ro || asin;
            }

            // Găsește toate SKU-urile care corespund acestui ASIN
            const correspondingSkus = asinToSkuMap.get(asin) || [];
            for (const sku of correspondingSkus) {
                productDB[sku] = productData; // Salvează în cache
                productsToReturn[sku] = productData; // Adaugă la obiectul de returnat
            }
        }

        // Pasul 5: Gestionează ASIN-urile care nu au fost găsite de API
        for (const asin of asinsToFetchUnique) {
            if (!asinDataMap[asin]) {
                const correspondingSkus = asinToSkuMap.get(asin) || [];
                const errorProduct = { name_ro: correspondingSkus[0] || asin, name_en: correspondingSkus[0] || asin, error: true };
                for (const sku of correspondingSkus) {
                    productDB[sku] = errorProduct;
                    productsToReturn[sku] = errorProduct;
                }
            }
        }

        saveToLocalStorage('productDatabase', productDB); // Salvează tot cache-ul actualizat
        
    } catch (error) {
        console.error("Eroare webhook batch:", error);
        // În caz de eroare, completează SKU-urile rămase cu date de eroare
        for (const sku of skuToAsinMap.keys()) {
            if (!productsToReturn[sku]) {
                productsToReturn[sku] = { name_ro: sku, name_en: sku, error: true };
            }
        }
    } finally {
        showLoading(false);
    }
    
    return productsToReturn;
}


/**
 * (MODIFICAT) Preia detaliile unui singur produs.
 * Acum folosește funcția de batch pentru a menține un singur punct de intrare API.
 */
async function getProductDetails(sku) {
    const productDB = loadFromLocalStorage('productDatabase');
    if (productDB[sku]) {
        return productDB[sku]; // Returnează din cache
    }
    
    // Apeleză funcția de batch pentru un singur item
    const productMap = await fetchProductDetailsBatch([sku]);
    
    return productMap[sku] || { name_ro: sku, name_en: sku, error: true };
}

// --- Logică Scaner QR ---
function startScanner(mode) {
    currentScanMode = mode;
    document.getElementById('scanner-modal').classList.add('active');
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess)
        .catch(err => {
            console.error("Eroare cameră:", err);
            showToast("Eroare la pornirea camerei.", true);
            stopScanner();
        });
}

function stopScanner() {
    try {
        html5QrCode.stop();
    } catch (err) { /* Ignoră */ }
    document.getElementById('scanner-modal').classList.remove('active');
}

function onScanSuccess(decodedText, decodedResult) {
    stopScanner();
    if (currentScanMode === 'product') {
        handleProductScan(decodedText);
    } else if (currentScanMode === 'location') {
        handleLocationScan(decodedText);
    } else if (currentScanMode === 'find') {
        handleFindScan(decodedText);
    } else if (currentScanMode === 'move_product') {
        handleMoveProductScan(decodedText);
    } else if (currentScanMode === 'move_destination') {
        handleMoveDestinationScan(decodedText);
    }
}

// --- Logică "Adaugă Produs" (Pagina 3) ---

function goToAddStep(step) {
    // Ascunde toți pașii
    document.getElementById('add-step-1-products').classList.add('hidden');
    document.getElementById('add-step-2-location').classList.add('hidden');
    document.getElementById('add-step-3-confirm').classList.add('hidden');

    if (step === 1) {
        document.getElementById('add-step-1-products').classList.remove('hidden');
        renderAddProductList(); // Re-randează lista
    } else if (step === 2) {
        // Calculează sumarul
        let productCounts = {};
        scannedProductList.forEach(item => {
            productCounts[item.sku] = (productCounts[item.sku] || 0) + 1;
        });
        let summary = `${scannedProductList.length} ${scannedProductList.length === 1 ? 'produs' : 'produse'} (${Object.keys(productCounts).length} SKU${Object.keys(productCounts).length === 1 ? '' : '-uri'} unice)`;
        document.getElementById('add-product-summary').textContent = summary;
        document.getElementById('add-step-2-location').classList.remove('hidden');
    } else if (step === 3) {
        document.getElementById('add-step-3-confirm').classList.remove('hidden');
    }
}

async function handleProductScan(sku) {
    // Mod: Adaugă produs la listă
    // showLoading(true); // getProductDetails se ocupă de loading
    const product = await getProductDetails(sku); // Acum folosește funcția de batch
    // showLoading(false);
    scannedProductList.push({ sku, product });
    renderAddProductList();
    
    // Nu mai reporni scanner-ul automat
    showToast(`Adăugat: ${product.name_ro || sku}`);
}

/**
 * Randează lista de produse scanate pentru adăugare
 */
function renderAddProductList() {
    const listContainer = document.getElementById('add-product-list');
    const continueBtn = document.getElementById('add-to-location-btn');
    
    if (scannedProductList.length === 0) {
        listContainer.innerHTML = `<p class="text-subtext-light dark:text-subtext-dark text-center p-4">Niciun produs scanat.</p>`;
        continueBtn.classList.add('hidden');
    } else {
        listContainer.innerHTML = scannedProductList.map((item, index) => {
            return `
                <div class="product-list-item">
                    <div class="flex-1 truncate pr-2">
                        <p class="text-text-light dark:text-text-dark font-semibold truncate">${item.product.name_ro || item.sku}</p>
                        <p class="text-xs text-subtext-light dark:text-subtext-dark font-mono">${item.sku}</p>
                    </div>
                    <button onclick="removeProductFromAddList(${index})" class="w-10 h-10 flex-shrink-0 bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 rounded-full flex items-center justify-center">
                        <span class="material-icons-outlined">delete</span>
                    </button>
                </div>
            `;
        }).join('');
        continueBtn.classList.remove('hidden');
    }
}

/**
 * Șterge un produs din lista de adăugare
 */
function removeProductFromAddList(index) {
    const removed = scannedProductList.splice(index, 1);
    showToast(`Șters: ${removed[0].product.name_ro || removed[0].sku}`);
    renderAddProductList();
}


function handleLocationScan(locationKey) {
    scannedLocation = locationKey;
    
    // Construiește sumarul pentru confirmare
    let productCounts = {};
    scannedProductList.forEach(item => {
        productCounts[item.sku] = (productCounts[item.sku] || 0) + 1;
    });

    let confirmListHtml = '';
    for (const sku in productCounts) {
        const product = scannedProductList.find(p => p.sku === sku).product;
        confirmListHtml += `<li><span class="font-bold">${productCounts[sku]} x</span> ${product.name_ro || sku}</li>`;
    }
    
    document.getElementById('add-confirm-list').innerHTML = confirmListHtml;
    document.getElementById('add-confirm-location').innerHTML = formatLocation(locationKey, true); // Formatare mare
    goToAddStep(3); // Mergi la pasul 3 (Confirmare)
}

// Funcția updateQuantity ESTE ȘTEARSĂ (nu mai e necesară)

async function saveMultiAdd() {
    if (scannedProductList.length === 0 || !scannedLocation) {
        showToast("Date invalide. Încearcă din nou.", true);
        return;
    }

    showLoading(true);
    const inventory = loadFromLocalStorage('inventoryLocations');
    
    // Calculează cantitățile de adăugat
    let productCounts = {};
    scannedProductList.forEach(item => {
        productCounts[item.sku] = (productCounts[item.sku] || 0) + 1;
    });
    
    const storagePromises = [];

    for (const sku in productCounts) {
        const quantityToAdd = productCounts[sku];
        if (!inventory[sku]) inventory[sku] = {};
        
        const currentQuantity = inventory[sku][scannedLocation] || 0;
        inventory[sku][scannedLocation] = currentQuantity + quantityToAdd;
        
        // Adaugă la coada de webhook-uri
        storagePromises.push(
            sendStorageUpdate(sku, scannedLocation, "adunare", quantityToAdd)
        );
    }
    
    // Așteaptă finalizarea tuturor trimiterilor
    try {
        // Salvează stocul local IMEDIAT
        saveToLocalStorage('inventoryLocations', inventory);
        // Apoi trimite actualizările
        await Promise.all(storagePromises);
        showToast(`Adăugate ${scannedProductList.length} produse la ${scannedLocation}`);
        showPage('page-dashboard');
    } catch (error) {
        console.error("Eroare la salvarea adăugării multiple:", error);
        showToast("Eroare la sincronizarea stocului.", true);
    } finally {
        showLoading(false);
    }
}

function resetAddFlow(navigateToDashboard = false) {
    scannedProductList = []; // Modificat
    scannedLocation = null;
    // Ascunde pașii 2 și 3, arată pasul 1
    document.getElementById('add-step-1-products').classList.remove('hidden');
    document.getElementById('add-step-2-location').classList.add('hidden');
    document.getElementById('add-step-3-confirm').classList.add('hidden');
    renderAddProductList(); // Golește lista UI
    if (navigateToDashboard) {
        showPage('page-dashboard');
    }
}

// --- Logică Pagină Comandă / Picking (Pagina 4) ---

function setupDashboardNotification() {
    const notifFooter = document.getElementById('notification-footer');
    const bubble = document.getElementById('floating-order-bubble');
    const count = liveOrders.length; // <-- Modificat
    
    if (count > 0) {
        const text = `${count} ${count === 1 ? 'comandă' : 'comenzi'} așteaptă pregătirea.`;
        // Actualizează textul pe ambele
        document.getElementById('order-notification-text-footer').textContent = text;
        document.getElementById('floating-order-count').textContent = count;
        
        if (isOrderNotificationHidden) {
            notifFooter.style.display = 'none';
            bubble.classList.add('visible');
        } else {
            notifFooter.style.display = 'block';
            bubble.classList.remove('visible');
        }
    } else {
        notifFooter.style.display = 'none';
        bubble.classList.remove('visible');
    }
}

function hideOrderNotification(event) {
    event.stopPropagation();
    isOrderNotificationHidden = true;
    setupDashboardNotification(); // Re-apelează funcția care gestionează vizibilitatea
}

async function startPickingProcess() {
    document.getElementById('picking-content').style.display = 'block';
    document.getElementById('picking-complete').style.display = 'none';
    document.getElementById('floating-order-bubble').classList.remove('visible');
    setupPickingPageFooter(true);

    // Folosește liveOrders (care ar trebui să fie deja preluat)
    if (liveOrders.length === 0) { // <-- Modificat
        // O șansă de a reîncărca dacă lista e goală
        // Dar deocamdată, doar închidem.
        console.log("Nicio comandă de pregătit.");
        finishPicking();
        return;
    }
    const consolidatedItems = consolidateOrders(liveOrders); // <-- Modificat
    const pickingList = await createPickingList(consolidatedItems); // <-- Funcție modificată
    pickingRoutes = groupPickingListByAisle(pickingList);
    currentRouteIndex = 0;
    currentStopIndex = 0;
    if (pickingRoutes.length > 0) {
        await renderCurrentPickingStop();
    } else {
        finishPicking();
    }
}

function consolidateOrders(orders) { // <-- Modificat
    const consolidated = new Map();
    for (const order of orders) { // <-- Modificat
        for (const item of order.products) { // <-- Modificat (de la 'items' la 'products')
            const sku = item.sku;
            if (consolidated.has(sku)) {
                consolidated.get(sku).totalQuantity += item.quantity;
            } else {
                consolidated.set(sku, { sku: sku, totalQuantity: item.quantity });
            }
        }
    }
    return Array.from(consolidated.values());
}

/**
 * (MODIFICAT) Creează lista de picking folosind preluarea batch.
 */
async function createPickingList(consolidatedItems) {
    let list = [];
    const inventory = loadFromLocalStorage('inventoryLocations');
    
    // Pasul 1: Extrage toate SKU-urile necesare
    const skusToFetch = consolidatedItems.map(item => item.sku);

    // Pasul 2: Prelucrează TOATE detaliile produselor într-un singur apel
    const productMap = await fetchProductDetailsBatch(skusToFetch);

    // Pasul 3: Construiește lista de picking (fără 'await' în buclă)
    for (const item of consolidatedItems) {
        const locations = inventory[item.sku];
        let locationKey = "N/A";
        if (locations && Object.keys(locations).length > 0) {
            locationKey = Object.keys(locations)[0]; // Ia prima locație
        }
        
        // Preia produsul din map-ul pre-încărcat
        const product = productMap[item.sku] || { name_ro: item.sku, name_en: item.sku, error: true };
        
        list.push({
            sku: item.sku,
            quantityToPick: item.totalQuantity,
            locationKey: locationKey,
            product: product
        });
    }
    return list;
}

function getAisle(row) { /* ... (fără modificări) ... */
    row = parseInt(row, 10);
    if (row === 1 || row === 2) return "1-2";
    if (row === 3 || row === 4) return "3-4";
    if (row === 5 || row === 6) return "5-6";
    if (row === 7 || row === 8) return "7-8";
    return "Altele";
}
function groupPickingListByAisle(pickingList) { /* ... (fără modificări) ... */
    const sortedList = pickingList.sort((a, b) => {
        if (a.locationKey === "N/A") return 1;
        if (b.locationKey === "N/A") return -1;
        return a.locationKey.localeCompare(b.locationKey);
    });
    const groups = new Map();
    for (const stop of sortedList) {
        const row = stop.locationKey.split(',')[0];
        const aisle = getAisle(row);
        if (!groups.has(aisle)) {
            groups.set(aisle, { aisle: aisle, stops: [] });
        }
        groups.get(aisle).stops.push(stop);
    }
    return Array.from(groups.values()).sort((a, b) => a.aisle.localeCompare(b.aisle));
}

async function renderCurrentPickingStop() {
    if (currentRouteIndex >= pickingRoutes.length) {
        finishPicking();
        return;
    }
    const route = pickingRoutes[currentRouteIndex];
    const stop = route.stops[currentStopIndex];

    // Am eliminat picking-route-header
    
    const locationEl = document.getElementById('stop-location');
    // Formatare mare (parametrul true)
    locationEl.innerHTML = stop.locationKey === "N/A" 
        ? `<span class="text-red-500 font-bold">LOCAȚIE LIPSA</span>`
        : formatLocation(stop.locationKey, true);

    document.getElementById('stop-quantity').textContent = stop.quantityToPick;
    
    const displayDiv = document.getElementById('stop-product-display');
    const product = stop.product;
    displayDiv.dataset.sku = stop.sku;
    displayDiv.dataset.nameRo = product.name_ro || stop.sku;
    displayDiv.dataset.nameEn = product.name_en || stop.sku;
    displayDiv.dataset.state = "sku";
    displayDiv.textContent = stop.sku;
    displayDiv.classList.add('font-mono');
}

function toggleProductDisplay() { /* ... (fără modificări) ... */
    const displayDiv = document.getElementById('stop-product-display');
    const state = displayDiv.dataset.state;
    if (state === "sku") {
        displayDiv.textContent = displayDiv.dataset.nameRo;
        displayDiv.dataset.state = "ro";
        displayDiv.classList.remove('font-mono');
    } else if (state === "ro") {
        displayDiv.textContent = displayDiv.dataset.nameEn;
        displayDiv.dataset.state = "en";
        displayDiv.classList.remove('font-mono');
    } else {
        displayDiv.textContent = displayDiv.dataset.sku;
        displayDiv.dataset.state = "sku";
        displayDiv.classList.add('font-mono');
    }
}

async function advancePickingStop() {
    if (currentRouteIndex >= pickingRoutes.length) return;
    
    const route = pickingRoutes[currentRouteIndex];
    const stop = route.stops[currentStopIndex];

    // Actualizează stocul local
    const inventory = loadFromLocalStorage('inventoryLocations');
    if (stop.locationKey !== "N/A" && inventory[stop.sku] && inventory[stop.sku][stop.locationKey]) {
         inventory[stop.sku][stop.locationKey] -= stop.quantityToPick;
         if (inventory[stop.sku][stop.locationKey] <= 0) {
             delete inventory[stop.sku][stop.locationKey];
         }
         saveToLocalStorage('inventoryLocations', inventory);
         
         // Trimite actualizarea la webhook DOAR dacă stocul local a fost actualizat
         await sendStorageUpdate(stop.sku, stop.locationKey, "scadere", stop.quantityToPick);
    } else if (stop.locationKey === "N/A") {
        console.warn(`Nu s-a putut scădea stocul pentru ${stop.sku} - locație N/A`);
    }

    // Avansează la următoarea oprire
    currentStopIndex++;
    if (currentStopIndex >= route.stops.length) {
        currentRouteIndex++;
        currentStopIndex = 0;
    }
    renderCurrentPickingStop();
}

function finishPicking() {
    document.getElementById('picking-content').style.display = 'none';
    document.getElementById('picking-complete').style.display = 'block';
    setupPickingPageFooter(false); // Ascunde butonul fix
    liveOrders = []; // <-- Modificat (golește lista live)
    isOrderNotificationHidden = false;
    setupDashboardNotification();
}


// --- Logică "Găsește Produs" (Integrată pe Dashboard) ---

function toggleSearchFocus(isFocused) {
    const form = document.getElementById('search-form');
    const results = document.getElementById('find-results');
    const scanButton = document.getElementById('scan-find-button');
    const input = document.getElementById('search-input');
    
    // Cardurile de ascuns
    const addProductCard = document.querySelector('a[href="#"][onclick="showPage(\'page-add-product\')"]');
    const moveProductCard = document.querySelector('a[href="#"][onclick="showPage(\'page-move-product\')"]');

    if (isFocused) {
        form.classList.add('focused');
        results.classList.remove('hidden');
        scanButton.style.maxHeight = '0';
        scanButton.style.paddingTop = '0';
        scanButton.style.paddingBottom = '0';
        scanButton.style.opacity = '0';
        scanButton.style.visibility = 'hidden';
        addProductCard.style.display = 'none';
        moveProductCard.style.display = 'none';
    } else {
        if (input.value.length > 0) return; // Nu închide dacă există text

        form.classList.remove('focused');
        results.classList.add('hidden');
        results.innerHTML = '';
        scanButton.style.maxHeight = '100px';
        scanButton.style.paddingTop = '1.25rem'; // py-5
        scanButton.style.paddingBottom = '1.25rem'; // py-5
        scanButton.style.opacity = '1';
        scanButton.style.visibility = 'visible';
        addProductCard.style.display = 'block';
        moveProductCard.style.display = 'block';
        input.value = '';
    }
}

function handleFindScan(sku) {
    document.getElementById('search-input').value = sku;
    toggleSearchFocus(true);
    searchProducts();
}

/**
 * (MODIFICAT) Caută produse, preluând toate detaliile lipsă într-un singur batch.
 */
async function searchProducts() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const resultsContainer = document.getElementById('find-results');
    resultsContainer.innerHTML = '';
    toggleSearchFocus(true);
    
    if (searchTerm.length < 1) {
        resultsContainer.innerHTML = `<p class="text-subtext-light dark:text-subtext-dark text-center p-4">Începe să tastezi pentru a căuta...</p>`;
        return;
    }

    const inventory = loadFromLocalStorage('inventoryLocations');
    let productDB = loadFromLocalStorage('productDatabase');
    let foundItems = [];
    
    // Pasul 1: Identifică toate SKU-urile din inventar
    const skusInInventory = Object.keys(inventory);
    
    // Pasul 2: Identifică ce detalii de produs lipsesc din cache
    const skusToFetch = skusInInventory.filter(sku => !productDB[sku]);

    // Pasul 3: Prelucrează toate detaliile lipsă într-un singur apel batch
    if (skusToFetch.length > 0) {
        // fetchProductDetailsBatch afișează 'showLoading'
        const productMap = await fetchProductDetailsBatch(skusToFetch);
        // Actualizează copia noastră locală a productDB
        productDB = { ...productDB, ...productMap };
    }

    // Pasul 4: Acum că productDB este complet, filtrează inventarul
    for (const sku of skusInInventory) {
        let match = false;
        const product = productDB[sku] || { name_ro: sku, name_en: sku, error: true };
        
        // Verifică potrivire pe SKU, Nume RO, Nume EN
        if (sku.toLowerCase().includes(searchTerm)) match = true;
        if (product.name_ro && product.name_ro.toLowerCase().includes(searchTerm)) match = true;
        if (product.name_en && product.name_en.toLowerCase().includes(searchTerm)) match = true;
        
        if (match) {
            foundItems.push({
                sku: sku,
                product: product,
                locations: inventory[sku]
            });
        }
    }
    
    renderSearchResults(foundItems);
}

function renderSearchResults(items) { /* ... (fără modificări) ... */
    const resultsContainer = document.getElementById('find-results');
    if (items.length === 0) {
        resultsContainer.innerHTML = `<p class="text-subtext-light dark:text-subtext-dark text-center p-4">Niciun produs găsit.</p>`;
        return;
    }
    resultsContainer.innerHTML = items.map(item => {
        const locationsHtml = Object.keys(item.locations).map(locKey => `
            <li class="flex justify-between items-center text-sm">
                <span>${formatLocation(locKey)}</span>
                <span class="font-bold text-primary text-base">Cant: ${item.locations[locKey]}</span>
            </li>
        `).join('');
        return `
            <div class="bg-card-light dark:bg-card-dark rounded-2xl p-5 shadow-lg animate-slide-in">
                <h3 class="text-lg font-bold text-text-light dark:text-text-dark">${item.product.name_ro || item.sku}</h3>
                ${(item.product.name_en && item.product.name_en !== item.product.name_ro) ? `<p class="text-sm text-subtext-light dark:text-subtext-dark">${item.product.name_en}</p>` : ''}
                <p class="text-xs text-primary font-mono mb-4">${item.sku}</p>
                <h4 class="text-sm font-semibold text-subtext-light dark:text-subtext-dark mb-2 border-t border-gray-200 dark:border-gray-700 pt-3">Locații:</h4>
                <ul class="space-y-2 text-text-light dark:text-text-dark">${locationsHtml}</ul>
            </div>
        `;
    }).join('');
}

// --- Logică "Mută Produs" (Pagina 5) ---

function resetMoveFlow(navigateToDashboard = false) {
    moveProductList = []; // Modificat
    moveSourceSelections = {};
    moveDestinationLocation = null;
    
    document.getElementById('move-step-1-products').classList.remove('hidden');
    document.getElementById('move-step-2-source').classList.add('hidden');
    document.getElementById('move-step-3-destination').classList.add('hidden');
    document.getElementById('move-step-4-confirm').classList.add('hidden');
    
    document.getElementById('move-product-list').innerHTML = ''; // Golește lista UI
    document.getElementById('move-source-list').innerHTML = '';

    if (navigateToDashboard) {
        showPage('page-dashboard');
    }
}

function goToMoveStep(step) {
    document.getElementById('move-step-1-products').classList.add('hidden');
    document.getElementById('move-step-2-source').classList.add('hidden');
    document.getElementById('move-step-3-destination').classList.add('hidden');
    document.getElementById('move-step-4-confirm').classList.add('hidden');
    
    if (step === 1) {
        document.getElementById('move-step-1-products').classList.remove('hidden');
        renderMoveProductList(); // Re-randează lista
    } else if (step === 2) {
        renderMoveSourceList(); // Funcție nouă care randează sursele
        document.getElementById('move-step-2-source').classList.remove('hidden');
    } else if (step === 3) {
        // Calculează totalul înainte de a merge la pasul 3
        let totalToMove = 0;
        let skuCount = 0;
        for (const sku in moveSourceSelections) {
            let hasSkuSelection = false;
            for (const loc in moveSourceSelections[sku]) {
                totalToMove += parseInt(moveSourceSelections[sku][loc], 10) || 0;
                hasSkuSelection = true;
            }
            if (hasSkuSelection) skuCount++;
        }
        
        if (totalToMove <= 0) {
            showToast("Trebuie să selectezi o cantitate de mutat.", true);
            goToMoveStep(2); // Rămâi la pasul 2
            return;
        }
        document.getElementById('move-summary-text').textContent = `Se vor muta ${totalToMove} buc. (${skuCount} SKU-uri)`;
        document.getElementById('move-step-3-destination').classList.remove('hidden');
    } else if (step === 4) {
         renderMoveConfirmPage(); // Funcție nouă care randează sumarul
         document.getElementById('move-step-4-confirm').classList.remove('hidden');
    }
}

async function handleMoveProductScan(sku) {
    // Adaugă la listă doar dacă nu există deja
    if (moveProductList.find(p => p.sku === sku)) {
        showToast("Produsul este deja în listă.", true);
        return;
    }
    // showLoading(true); // getProductDetails se ocupă de loading
    const product = await getProductDetails(sku); // Acum folosește funcția de batch
    // showLoading(false);
    moveProductList.push({ sku, product });
    renderMoveProductList();
    showToast(`Adăugat: ${product.name_ro || sku}`);
}

/**
 * Randează lista de produse scanate pentru mutare
 */
function renderMoveProductList() {
    const listContainer = document.getElementById('move-product-list');
    const continueBtn = document.getElementById('move-to-source-btn');
    
    if (moveProductList.length === 0) {
        listContainer.innerHTML = `<p class="text-subtext-light dark:text-subtext-dark text-center p-4">Niciun produs scanat.</p>`;
        continueBtn.classList.add('hidden');
    } else {
        listContainer.innerHTML = moveProductList.map((item, index) => {
            return `
                <div class="product-list-item">
                    <div class="flex-1 truncate pr-2">
                        <p class="text-text-light dark:text-text-dark font-semibold truncate">${item.product.name_ro || item.sku}</p>
                        <p class="text-xs text-subtext-light dark:text-subtext-dark font-mono">${item.sku}</p>
                    </div>
                    <button onclick="removeProductFromMoveList(${index})" class="w-10 h-10 flex-shrink-0 bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 rounded-full flex items-center justify-center">
                        <span class="material-icons-outlined">delete</span>
                    </button>
                </div>
            `;
        }).join('');
        continueBtn.classList.remove('hidden');
    }
}

/**
 * Șterge un produs din lista de mutare
 */
function removeProductFromMoveList(index) {
    const removed = moveProductList.splice(index, 1);
    // Șterge și selecțiile asociate
    if (moveSourceSelections[removed[0].sku]) {
        delete moveSourceSelections[removed[0].sku];
    }
    showToast(`Șters: ${removed[0].product.name_ro || removed[0].sku}`);
    renderMoveProductList();
}

/**
 * Randează UI-ul de selecție a surselor pentru TOATE produsele
 */
function renderMoveSourceList() {
    const inventory = loadFromLocalStorage('inventoryLocations');
    const sourceListContainer = document.getElementById('move-source-list');
    sourceListContainer.innerHTML = '';
    
    moveProductList.forEach(item => {
        const sku = item.sku;
        const product = item.product;
        const locations = inventory[sku];
        
        let locationsHtml = '';
        if (!locations || Object.keys(locations).length === 0) {
            locationsHtml = `<p class="text-subtext-light dark:text-subtext-dark text-sm px-4">Acest produs nu are nicio locație înregistrată.</p>`;
        } else {
            locationsHtml = Object.keys(locations).map(locKey => {
                const quantity = locations[locKey];
                // Pre-populează valoarea dacă există deja
                const currentValue = (moveSourceSelections[sku] && moveSourceSelections[sku][locKey]) ? moveSourceSelections[sku][locKey] : '0';
                return `
                    <div class="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg flex items-center justify-between">
                        <div>
                            <div class="font-semibold text-text-light dark:text-text-dark">${formatLocation(locKey)}</div>
                            <div class="text-sm text-subtext-light dark:text-subtext-dark">Disponibil: ${quantity}</div>
                        </div>
                        <input 
                            type="number" 
                            min="0" 
                            max="${quantity}" 
                            value="${currentValue}"
                            placeholder="0"
                            oninput="updateMoveSelection('${sku}', '${locKey}', this)"
                            class="w-20 p-2 text-right rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-text-dark"
                        />
                    </div>
                `;
            }).join('<div class="h-2"></div>');
        }
        
        // Cardul pentru SKU-ul curent
        sourceListContainer.innerHTML += `
            <div class="bg-card-light dark:bg-card-dark p-4 rounded-xl shadow">
                <p class="text-lg font-bold text-text-light dark:text-text-dark mb-3">${product.name_ro || sku}</p>
                <div class="space-y-2">
                    ${locationsHtml}
                </div>
            </div>
        `;
    });
}

function updateMoveSelection(sku, locationKey, inputElement) {
    let value = parseInt(inputElement.value, 10);
    const max = parseInt(inputElement.max, 10);
    
    if (isNaN(value) || value < 0) {
        value = 0;
    }
    if (value > max) {
        value = max;
        inputElement.value = max; // Corectează inputul
    }
    
    if (!moveSourceSelections[sku]) {
        moveSourceSelections[sku] = {};
    }
    moveSourceSelections[sku][locationKey] = value;
}

function handleMoveDestinationScan(locationKey) {
    moveDestinationLocation = locationKey;
    goToMoveStep(4); // Mergi la confirmare
}

/**
 * Randează pagina de confirmare a mutării
 */
function renderMoveConfirmPage() {
    let totalToMove = 0;
    let sourcesHtml = '';
    let productHtml = '';
    
    let skuTotals = {};

    for (const sku in moveSourceSelections) {
        let skuHasSelection = false;
        let skuTotal = 0;
        for (const locKey in moveSourceSelections[sku]) {
            const quantity = moveSourceSelections[sku][locKey];
            if (quantity > 0) {
                totalToMove += quantity;
                skuTotal += quantity;
                skuHasSelection = true;
                sourcesHtml += `<li>${quantity} buc. (SKU ${sku}) din ${formatLocation(locKey)}</li>`;
            }
        }
        if (skuHasSelection) {
            skuTotals[sku] = skuTotal;
        }
    }
    
    // Construiește sumarul de produse
    productHtml = Object.keys(skuTotals).map(sku => {
        const product = moveProductList.find(p => p.sku === sku).product;
        return `<li><span class="font-bold">${skuTotals[sku]} x</span> ${product.name_ro || sku}</li>`
    }).join('');


    document.getElementById('move-confirm-product').innerHTML = `<ul class="list-disc list-inside">${productHtml}</ul>`;
    document.getElementById('move-confirm-quantity').textContent = `${totalToMove} bucăți totale`;
    document.getElementById('move-confirm-sources').innerHTML = sourcesHtml;
    document.getElementById('move-confirm-destination').innerHTML = formatLocation(moveDestinationLocation, true); // Formatare mare
}

async function saveMoveProduct() {
    if (moveProductList.length === 0 || !moveDestinationLocation) {
        showToast("Date invalide. Încearcă din nou.", true);
        return;
    }

    showLoading(true);
    const inventory = loadFromLocalStorage('inventoryLocations');
    
    let totalMoved = 0;
    const subtractionPromises = [];
    const additionPayloads = {}; // Format: { "SKU": cantitate }

    for (const sku in moveSourceSelections) {
        if (!inventory[sku]) inventory[sku] = {};
        let totalMovedForSku = 0;
        
        for (const locKey in moveSourceSelections[sku]) {
            const quantityToMove = moveSourceSelections[sku][locKey];
            if (quantityToMove > 0) {
                totalMoved += quantityToMove;
                totalMovedForSku += quantityToMove;
                
                // Actualizează stocul local (scădere)
                const currentSourceQty = inventory[sku][locKey] || 0;
                inventory[sku][locKey] = currentSourceQty - quantityToMove;
                if (inventory[sku][locKey] <= 0) {
                    delete inventory[sku][locKey];
                }
                
                // Adaugă la coada de webhook-uri
                subtractionPromises.push(
                    sendStorageUpdate(sku, locKey, "scadere", quantityToMove)
                );
            }
        }
        if (totalMovedForSku > 0) {
            additionPayloads[sku] = totalMovedForSku;
        }
    }
    
    if (totalMoved === 0) {
        showToast("Nicio cantitate de mutat.", true);
        showLoading(false);
        return;
    }
    
    // Salvează stocul local IMEDIAT (partea de scădere)
    saveToLocalStorage('inventoryLocations', inventory);
    
    // Așteaptă finalizarea tuturor scăderilor
    await Promise.all(subtractionPromises);

    const additionPromises = [];
    
    // Iterează prin totalurile de adăugat pe SKU
    for (const sku in additionPayloads) {
        const quantityToAdd = additionPayloads[sku];
        
        // Actualizează stocul local (adunare)
        const currentDestQty = inventory[sku][moveDestinationLocation] || 0;
        inventory[sku][moveDestinationLocation] = currentDestQty + quantityToAdd;

        // Trimite webhook-ul de adunare
        additionPromises.push(
            sendStorageUpdate(sku, moveDestinationLocation, "adunare", quantityToAdd)
        );
    }

    // Așteaptă finalizarea tuturor adăugirilor
    await Promise.all(additionPromises);
    
    // Salvează stocul final local (partea de adăugare)
    saveToLocalStorage('inventoryLocations', inventory);
    
    showLoading(false);
    showToast(`Mutat ${totalMoved} buc. la ${moveDestinationLocation}`);
    resetMoveFlow(true); // Întoarce la dashboard
}


// --- Funcții Utilitare ---

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
