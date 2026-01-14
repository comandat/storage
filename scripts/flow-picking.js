// --- Logică Pagină Comandă / Picking (Pagina 4) ---

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

async function startPickingProcess() {
    document.getElementById('picking-content').style.display = 'block';
    document.getElementById('picking-complete').style.display = 'none';
    document.getElementById('floating-order-bubble').classList.remove('visible');
    setupPickingPageFooter(true);

    if (liveOrders.length === 0) {
        console.log("Nicio comandă de pregătit.");
        finishPicking();
        return;
    }
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

function consolidateOrders(orders) { 
    const consolidated = new Map();
    for (const order of orders) { 
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
    
    const skusToFetch = consolidatedItems.map(item => item.sku);
    const productMap = await fetchProductDetailsBatch(skusToFetch); // Acum e rapidă și locală

    for (const item of consolidatedItems) {
        const locations = inventory[item.sku];
        let locationKey = "N/A";
        if (locations && Object.keys(locations).length > 0) {
            locationKey = Object.keys(locations)[0];
        }
        
        const product = productMap[item.sku]; // Va fi placeholder-ul cu { name_ro: sku }
        
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

async function renderCurrentPickingStop() {
    if (currentRouteIndex >= pickingRoutes.length) {
        finishPicking();
        return;
    }
    const route = pickingRoutes[currentRouteIndex];
    
    // --- Adăugat verificare pentru rute goale ---
    if (!route || route.stops.length === 0) {
        // Dacă ruta e goală, o ștergem și încercăm să randăm din nou
        if (route) {
            pickingRoutes.splice(currentRouteIndex, 1);
        }
        // Nu incrementăm indexul, deoarece următoarea rută va lua locul acesteia
        currentStopIndex = 0;
        renderCurrentPickingStop(); // Încearcă din nou cu următoarea rută
        return;
    }
    // --- Sfârșit verificare ---

    const stop = route.stops[currentStopIndex];
    
    const locationEl = document.getElementById('stop-location');
    locationEl.innerHTML = stop.locationKey === "N/A" 
        ? `<span class="text-red-500 font-bold">LOCAȚIE LIPSA</span>`
        : formatLocation(stop.locationKey, true);

    document.getElementById('stop-quantity').textContent = stop.quantityToPick;
    
    const displayDiv = document.getElementById('stop-product-display');
    const product = stop.product;
    
    // Afișează direct SKU-ul
    displayDiv.dataset.sku = stop.sku;
    displayDiv.dataset.nameRo = product.name_ro; // Va fi SKU-ul
    displayDiv.dataset.nameEn = product.name_en; // Va fi SKU-ul
    displayDiv.dataset.state = "sku";
    displayDiv.textContent = stop.sku; // Afișează SKU
    displayDiv.classList.add('font-mono');
}

// Funcția toggleProductDisplay a fost ȘTEARSĂ

async function advancePickingStop() {
    if (currentRouteIndex >= pickingRoutes.length) return;
    
    const route = pickingRoutes[currentRouteIndex];
    const stop = route.stops[currentStopIndex];

    const inventory = loadFromLocalStorage('inventoryLocations');
    if (stop.locationKey !== "N/A" && inventory[stop.sku] && inventory[stop.sku][stop.locationKey]) {
         inventory[stop.sku][stop.locationKey] -= stop.quantityToPick;
         if (inventory[stop.sku][stop.locationKey] <= 0) {
             delete inventory[stop.sku][stop.locationKey];
         }
         saveToLocalStorage('inventoryLocations', inventory);
         
         await sendStorageUpdate(stop.sku, stop.locationKey, "scadere", stop.quantityToPick);
    } else if (stop.locationKey === "N/A") {
        console.warn(`Nu s-a putut scădea stocul pentru ${stop.sku} - locație N/A`);
    }

    currentStopIndex++;
    if (currentStopIndex >= route.stops.length) {
        currentRouteIndex++;
        currentStopIndex = 0;
    }
    renderCurrentPickingStop();
}

// --- NOUA FUNCȚIE ADĂUGATĂ ---
async function skipPickingStop() {
    if (currentRouteIndex >= pickingRoutes.length) {
        finishPicking();
        return;
    }

    const route = pickingRoutes[currentRouteIndex];
    if (route.stops.length === 0) {
        // Rută goală, curățăm și mergem mai departe
        pickingRoutes.splice(currentRouteIndex, 1);
        currentStopIndex = 0;
        renderCurrentPickingStop();
        return;
    }

    // 1. Ia stop-ul curent și îl elimină din lista curentă
    const stopToSkip = route.stops.splice(currentStopIndex, 1)[0];

    // 2. Adaugă stop-ul la finalul ultimei rute
    if (pickingRoutes.length > 0) {
         // Adaugă la ultima rută existentă
        pickingRoutes[pickingRoutes.length - 1].stops.push(stopToSkip);
    }

    // 3. Verifică dacă ruta curentă a devenit goală
    if (route.stops.length === 0) {
        pickingRoutes.splice(currentRouteIndex, 1);
        currentStopIndex = 0;
        // nu incrementăm currentRouteIndex, deoarece următoarea rută va lua locul acesteia
    } 
    // 4. Verifică dacă eram la capătul listei în ruta curentă
    else if (currentStopIndex >= route.stops.length) {
        // Eram la ultimul item, trecem la următoarea rută
        currentRouteIndex++;
        currentStopIndex = 0;
    }
    // 5. Dacă eram la mijlocul listei, currentStopIndex e acum pe următorul item,
    // deci nu facem nimic la indecși.

    // 6. Re-randează
    renderCurrentPickingStop();
}
// --- SFÂRȘIT FUNCȚIE NOUĂ ---

function finishPicking() {
    document.getElementById('picking-content').style.display = 'none';
    document.getElementById('picking-complete').style.display = 'block';
    setupPickingPageFooter(false);
    liveOrders = []; 
    isOrderNotificationHidden = false;
    setupDashboardNotification();
}

async function triggerAwbPrint() {
    // 1. Identificăm produsul curent de pe ecran
    if (currentRouteIndex >= pickingRoutes.length) return;
    
    const route = pickingRoutes[currentRouteIndex];
    if (!route || route.stops.length === 0) return;
    
    const stop = route.stops[currentStopIndex];
    const currentSku = stop.sku;

    // 2. Căutăm acest SKU în lista de comenzi active (liveOrders)
    // liveOrders conține obiecte de tipul: { order_id: 12345, products: [...] }
    
    let foundOrder = null;

    // Iterăm prin comenzi pentru a găsi una care conține acest produs
    for (const order of liveOrders) {
        if (order.products && Array.isArray(order.products)) {
            const hasProduct = order.products.some(p => p.sku === currentSku);
            if (hasProduct) {
                foundOrder = order;
                break; // Am găsit prima comandă care conține produsul, ne oprim.
            }
        }
    }

    // 3. Dacă am găsit comanda, trimitem cererea de printare
    if (foundOrder) {
        // Folosim order_id (din n8n transform) sau id (dacă e structura raw)
        const orderIdToSend = foundOrder.order_id || foundOrder.id;
        
        if (confirm(`Printezi AWB pentru comanda #${orderIdToSend}?`)) {
            await window.sendPrintAwbRequest(orderIdToSend);
        }
    } else {
        showToast("Nu s-a găsit nicio comandă activă pentru acest produs.", true);
    }
}

// ExpuN funcțiile necesare global
window.setupDashboardNotification = setupDashboardNotification;
window.hideOrderNotification = hideOrderNotification;
window.startPickingProcess = startPickingProcess;
window.advancePickingStop = advancePickingStop;
window.skipPickingStop = skipPickingStop; // <-- Am adăugat exportul aici
window.triggerAwbPrint = triggerAwbPrint;
