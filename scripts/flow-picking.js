// scripts/flow-picking.js

// --- Notificări Dashboard ---

function setupDashboardNotification() {
    const notifFooter = document.getElementById('notification-footer');
    const bubble = document.getElementById('floating-order-bubble');
    const count = liveOrders.length;
    
    if (count > 0) {
        const text = `${count} ${count === 1 ? 'comandă' : 'comenzi'} așteaptă pregătirea.`;
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
    setupDashboardNotification();
}

// --- Inițializare Proces Picking ---

async function startPickingProcess() {
    // Ascunde overlay-ul de finalizare dacă era vizibil
    document.getElementById('picking-complete').classList.add('hidden');
    document.getElementById('floating-order-bubble').classList.remove('visible');
    
    // Inițializează seturile de urmărire pentru sesiunea curentă
    window.globalPickedItems = new Map(); // ține evidența cantităților ridicate per SKU
    window.processedOrderIds = new Set(); // ține evidența comenzilor deja procesate (printate)

    if (liveOrders.length === 0) {
        console.log("Nicio comandă de pregătit.");
        finishPicking();
        return;
    }

    // Preia datele și construiește rutele
    const consolidatedItems = consolidateOrders(liveOrders); 
    const pickingList = await createPickingList(consolidatedItems); 
    pickingRoutes = groupPickingListByAisle(pickingList);
    
    currentRouteIndex = 0;
    currentStopIndex = 0;

    if (pickingRoutes.length > 0) {
        await renderCurrentPickingStop();
    } else {
        finishPicking();
    }
}

// --- Funcții Helper pentru Listă ---

function consolidateOrders(orders) { 
    const consolidated = new Map();
    for (const order of orders) { 
        if (!Array.isArray(order.products)) continue;
        for (const item of order.products) { 
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

async function createPickingList(consolidatedItems) {
    let list = [];
    const inventory = loadFromLocalStorage('inventoryLocations');
    
    // Obține detalii (nume, etc) pentru afișare
    const skusToFetch = consolidatedItems.map(item => item.sku);
    const productMap = await fetchProductDetailsBatch(skusToFetch);

    for (const item of consolidatedItems) {
        const locations = inventory[item.sku];
        let locationKey = "N/A";
        
        // Strategie simplă: ia prima locație găsită
        if (locations && Object.keys(locations).length > 0) {
            locationKey = Object.keys(locations)[0]; 
        }
        
        const product = productMap[item.sku];
        
        list.push({
            sku: item.sku,
            quantityToPick: item.totalQuantity,
            locationKey: locationKey,
            product: product
        });
    }
    return list;
}

function getAisle(row) {
    row = parseInt(row, 10);
    if (isNaN(row)) return "Altele";
    if (row === 1 || row === 2) return "1-2";
    if (row === 3 || row === 4) return "3-4";
    if (row === 5 || row === 6) return "5-6";
    if (row === 7 || row === 8) return "7-8";
    return "Altele";
}

function groupPickingListByAisle(pickingList) {
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

// --- Randare UI (Design Nou) ---

async function renderCurrentPickingStop() {
    // Verifică dacă am terminat toate rutele
    if (currentRouteIndex >= pickingRoutes.length) {
        finishPicking();
        return;
    }
    
    const route = pickingRoutes[currentRouteIndex];
    
    // Gestionează rute goale (defensive programming)
    if (!route || route.stops.length === 0) {
        if (route) pickingRoutes.splice(currentRouteIndex, 1);
        currentStopIndex = 0;
        renderCurrentPickingStop();
        return;
    }

    const stop = route.stops[currentStopIndex];
    
    // 1. Actualizare Card Locație
    // Format așteptat cheie: "Rand,Desc,Polita,Cutie" (ex: "1,2,3,4")
    const locParts = stop.locationKey.split(',');
    
    document.getElementById('loc-row').textContent = locParts[0] || '-';
    document.getElementById('loc-desc').textContent = locParts[1] || '-';
    document.getElementById('loc-shelf').textContent = locParts[2] || '-';
    document.getElementById('loc-box').textContent = locParts[3] || '-';

    // 2. Actualizare Informații Produs
    const displayDiv = document.getElementById('picking-sku-display');
    const sku = stop.sku;
    
    // Highlight ultimele 5 caractere pentru vizibilitate sporită
    if (sku.length > 5) {
        const mainPart = sku.substring(0, sku.length - 5);
        const highlightPart = sku.substring(sku.length - 5);
        displayDiv.innerHTML = `${mainPart}<span class="text-highlight drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]">${highlightPart}</span>`;
    } else {
        displayDiv.textContent = sku;
    }

    // 3. Actualizare Cantitate
    document.getElementById('picking-qty-display').textContent = `${stop.quantityToPick} unitat${stop.quantityToPick !== 1 ? 'e' : 'i'}`; // mic fix gramatical (e/i e greu generic, lăsăm unitate/unități aproximativ)
    if (stop.quantityToPick > 1) {
         document.getElementById('picking-qty-display').textContent = `${stop.quantityToPick} unități`;
    } else {
         document.getElementById('picking-qty-display').textContent = `1 unitate`;
    }

    // 4. Actualizare Progress Bar
    let totalStops = 0;
    let currentGlobalIndex = 0;
    
    for (let i = 0; i < pickingRoutes.length; i++) {
        const r = pickingRoutes[i];
        if (i < currentRouteIndex) {
            currentGlobalIndex += r.stops.length;
        } else if (i === currentRouteIndex) {
            currentGlobalIndex += currentStopIndex;
        }
        totalStops += r.stops.length;
    }
    
    const displayIndex = currentGlobalIndex + 1;
    const percentage = totalStops > 0 ? Math.round((displayIndex / totalStops) * 100) : 0;

    document.getElementById('picking-progress-bar').style.width = `${percentage}%`;
    document.getElementById('picking-progress-text').innerHTML = `Produs <span class="text-white">${displayIndex}</span> din ${totalStops}`;
    document.getElementById('picking-progress-percent').textContent = `${percentage}%`;
}

// --- Logică Scanare și Validare ---

function startPickingScan() {
    startScanner('picking');
}

// Această funcție este apelată de scanner.js când `currentScanMode === 'picking'`
async function handlePickingScan(scannedCode) {
    if (currentRouteIndex >= pickingRoutes.length) return;
    
    const route = pickingRoutes[currentRouteIndex];
    const stop = route.stops[currentStopIndex];

    const expectedSku = stop.sku.toUpperCase();
    const scanned = scannedCode.trim().toUpperCase();

    // Verificare simplă (se poate extinde pentru a accepta și EAN dacă avem mapping)
    if (scanned === expectedSku) {
        showToast("Cod Corect!", false);
        // Validare cu succes -> declanșează logica de avansare și verificare comandă
        await advancePickingStop(true); 
    } else {
        // Logica pentru cod greșit
        // Încercăm să vedem dacă e un EAN care corespunde SKU-ului (dacă am avea harta)
        // Momentan, strict match pe SKU
        showToast(`Cod Greșit! Așteptat: ${expectedSku}`, true);
        
        // Putem redeschide scannerul automat după 2 secunde dacă dorim, 
        // dar e mai sigur să lăsăm utilizatorul să apese din nou.
    }
}

// --- Avansare și Procesare ---

async function advancePickingStop(isValidated = false) {
    if (currentRouteIndex >= pickingRoutes.length) return;
    
    const route = pickingRoutes[currentRouteIndex];
    const stop = route.stops[currentStopIndex];

    // 1. Scădere Stoc (Doar dacă locația e validă)
    const inventory = loadFromLocalStorage('inventoryLocations');
    if (stop.locationKey !== "N/A" && inventory[stop.sku] && inventory[stop.sku][stop.locationKey]) {
         inventory[stop.sku][stop.locationKey] -= stop.quantityToPick;
         
         // Șterge intrarea dacă stocul ajunge la 0
         if (inventory[stop.sku][stop.locationKey] <= 0) {
             delete inventory[stop.sku][stop.locationKey];
         }
         
         saveToLocalStorage('inventoryLocations', inventory);
         
         // Trimite update la server (background)
         await sendStorageUpdate(stop.sku, stop.locationKey, "scadere", stop.quantityToPick);
    }

    // 2. Logică Automată Comenzi (Doar dacă a fost validat prin scanare)
    if (isValidated) {
        // Verificăm dacă ridicarea acestui produs a completat vreo comandă
        await checkAndPrintOrderCompletion(stop.sku);
    }

    // 3. Trecerea la următorul stop
    currentStopIndex++;
    if (currentStopIndex >= route.stops.length) {
        currentRouteIndex++;
        currentStopIndex = 0;
    }
    
    // Randare nou stop
    renderCurrentPickingStop();
}

/**
 * Verifică dacă toate produsele dintr-o comandă au fost ridicate (sau nu mai sunt "pending").
 * Dacă da, declanșează automat fluxul de AWB.
 */
async function checkAndPrintOrderCompletion(justPickedSku) {
    // 1. Identificăm comenzile care conțin produsul tocmai scanat
    // și care NU au fost deja procesate în această sesiune.
    const relevantOrders = liveOrders.filter(order => 
        !window.processedOrderIds.has(order.order_id || order.id) &&
        Array.isArray(order.products) &&
        order.products.some(p => p.sku === justPickedSku)
    );

    for (const order of relevantOrders) {
        let isOrderComplete = true;

        // 2. Pentru fiecare produs din comandă, verificăm dacă MAI TREBUIE ridicat
        // (adică dacă mai există în lista de picking rămasă)
        for (const product of order.products) {
            const isPending = isSkuPending(product.sku);
            if (isPending) {
                isOrderComplete = false;
                break; // Dacă găsim un produs care încă trebuie ridicat, comanda nu e gata
            }
        }

        // 3. Dacă comanda e completă, acționăm
        if (isOrderComplete) {
            const orderId = order.order_id || order.id;
            const internalId = order.internal_id || "N/A";
            
            // Marchez comanda ca procesată ca să nu o procesez de 2 ori
            window.processedOrderIds.add(orderId);

            showToast(`Comandă completă: ${internalId}. Se verifică AWB...`);

            // Verificăm dacă are deja AWB
            const awbUrl = order.awb_url;
            const marketplace = order.marketplace || "Unknown";

            if (awbUrl && awbUrl.length > 5) {
                // CAZ 1: AWB Există -> Printare directă
                showToast(`AWB existent. Se printează...`);
                await window.sendPrintAwbRequest({
                    orderId: orderId,
                    internalId: internalId
                });
            } else {
                // CAZ 2: AWB Nu există -> Generare + Printare
                showToast(`Se generează AWB (${marketplace})...`);
                await window.sendGenerateAwbRequest({
                    internalId: internalId,
                    marketplace: marketplace
                });
            }
        }
    }
}

// Verifică dacă un SKU mai există în rutele de picking (de la poziția curentă încolo)
function isSkuPending(sku) {
    // Verificăm în restul rutei curente
    // Notă: currentStopIndex a fost deja incrementat logic înainte de a chema această funcție?
    // În implementarea advancePickingStop, checkAndPrintOrderCompletion e chemată ÎNAINTE de incrementare.
    // Deci produsul curent (tocmai scanat) este la currentStopIndex.
    // Dar noi vrem să vedem dacă MAI apare.
    
    // Verificăm în ruta curentă, începând cu următorul stop
    if (currentRouteIndex < pickingRoutes.length) {
        const currentRoute = pickingRoutes[currentRouteIndex];
        for (let i = currentStopIndex + 1; i < currentRoute.stops.length; i++) {
            if (currentRoute.stops[i].sku === sku) return true;
        }
    }

    // Verificăm în toate rutele viitoare
    for (let i = currentRouteIndex + 1; i < pickingRoutes.length; i++) {
        const route = pickingRoutes[i];
        for (const stop of route.stops) {
            if (stop.sku === sku) return true;
        }
    }

    return false;
}

async function skipPickingStop() {
    if (currentRouteIndex >= pickingRoutes.length) {
        finishPicking();
        return;
    }

    const route = pickingRoutes[currentRouteIndex];
    if (route.stops.length === 0) {
        pickingRoutes.splice(currentRouteIndex, 1);
        currentStopIndex = 0;
        renderCurrentPickingStop();
        return;
    }

    // Scoate stop-ul curent
    const stopToSkip = route.stops.splice(currentStopIndex, 1)[0];

    // Adaugă-l la sfârșitul ultimei rute (amânare)
    if (pickingRoutes.length > 0) {
        pickingRoutes[pickingRoutes.length - 1].stops.push(stopToSkip);
    } else {
        // Dacă nu mai sunt rute (asta e singura), îl punem înapoi într-o nouă rută
        // sau îl lăsăm aici la coadă? 
        // Simplu: îl punem înapoi în aceeași rută la final
        route.stops.push(stopToSkip);
        // Atenție la buclă infinită dacă e singurul produs
        if (route.stops.length === 1) {
             showToast("Este singurul produs rămas.", true);
             // Nu mai facem splice/push, doar randăm
             route.stops = [stopToSkip];
        }
    }

    // Ajustează indecșii
    if (route.stops.length === 0) {
        pickingRoutes.splice(currentRouteIndex, 1);
        currentStopIndex = 0;
    } else if (currentStopIndex >= route.stops.length) {
        currentRouteIndex++;
        currentStopIndex = 0;
    }
    
    // Reset pentru că am sărit
    renderCurrentPickingStop();
}

function finishPicking() {
    document.getElementById('picking-complete').classList.remove('hidden');
    // Curăță datele
    liveOrders = []; 
    isOrderNotificationHidden = false;
    setupDashboardNotification();
    
    // Poți adăuga un confetti aici :)
}

// Expun funcțiile necesare global (pentru onclick din HTML)
window.setupDashboardNotification = setupDashboardNotification;
window.hideOrderNotification = hideOrderNotification;
window.startPickingProcess = startPickingProcess;
window.advancePickingStop = advancePickingStop;
window.skipPickingStop = skipPickingStop;
window.startPickingScan = startPickingScan;
window.handlePickingScan = handlePickingScan;
