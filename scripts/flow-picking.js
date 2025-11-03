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

function finishPicking() {
    document.getElementById('picking-content').style.display = 'none';
    document.getElementById('picking-complete').style.display = 'block';
    setupPickingPageFooter(false);
    liveOrders = []; 
    isOrderNotificationHidden = false;
    setupDashboardNotification();
}
