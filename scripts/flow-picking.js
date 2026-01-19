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

// --- Inițializare Proces Picking (PER COMANDĂ) ---

async function startPickingProcess() {
    // Reset UI
    document.getElementById('picking-complete').classList.add('hidden');
    document.getElementById('picking-error-overlay').classList.add('hidden');
    document.getElementById('floating-order-bubble').classList.remove('visible');
    
    // Inițializează
    window.processedOrderIds = new Set(); 

    if (liveOrders.length === 0) {
        finishPicking();
        return;
    }

    // 1. Grupează și pregătește lista: Array de COMENZI, fiecare având un Array de produse (stops)
    // pickingRoutes va fi acum: [ {orderData: {...}, stops: [...]}, {orderData: {...}, stops: [...]} ]
    pickingRoutes = await createOrderBasedPickingList(liveOrders);
    
    currentRouteIndex = 0; // Indexul comenzii curente
    currentStopIndex = 0;  // Indexul produsului curent din comandă

    if (pickingRoutes.length > 0) {
        await renderCurrentPickingStop();
    } else {
        finishPicking();
    }
}

// --- Funcții Helper pentru Listă ---

async function createOrderBasedPickingList(orders) {
    const orderList = [];
    const inventory = loadFromLocalStorage('inventoryLocations');
    
    // Colectăm toate SKU-urile pentru a le lua detaliile o singură dată
    const allSkus = new Set();
    orders.forEach(o => {
        if(Array.isArray(o.products)) o.products.forEach(p => allSkus.add(p.sku));
    });
    const productMap = await fetchProductDetailsBatch(Array.from(allSkus));

    for (const order of orders) {
        // Consolidăm produsele din ACEASTĂ comandă (ex: 2 linii cu același SKU -> 1 linie cu cantitate cumulată)
        const consolidatedMap = new Map();
        if (!Array.isArray(order.products)) continue;

        for (const item of order.products) {
            if (consolidatedMap.has(item.sku)) {
                consolidatedMap.get(item.sku).quantityToPick += item.quantity;
            } else {
                consolidatedMap.set(item.sku, {
                    sku: item.sku,
                    quantityToPick: item.quantity,
                    // Găsim o locație (strategie simplă: prima găsită)
                    locationKey: inventory[item.sku] ? Object.keys(inventory[item.sku])[0] || "N/A" : "N/A",
                    product: productMap[item.sku]
                });
            }
        }

        const stops = Array.from(consolidatedMap.values());
        
        // Opțional: Sortăm produsele din comandă după locație pentru a optimiza drumul în depozit PENTRU ACEASTĂ COMANDĂ
        stops.sort((a, b) => {
            if (a.locationKey === "N/A") return 1;
            if (b.locationKey === "N/A") return -1;
            return a.locationKey.localeCompare(b.locationKey);
        });

        if (stops.length > 0) {
            orderList.push({
                orderData: order, // Păstrăm referința la obiectul comandă original
                stops: stops
            });
        }
    }
    return orderList;
}


// --- Randare UI ---

async function renderCurrentPickingStop() {
    if (currentRouteIndex >= pickingRoutes.length) {
        finishPicking();
        return;
    }
    
    const currentOrder = pickingRoutes[currentRouteIndex];
    if (!currentOrder || currentOrder.stops.length === 0) {
        // Skip empty order
        currentRouteIndex++;
        currentStopIndex = 0;
        renderCurrentPickingStop();
        return;
    }

    const stop = currentOrder.stops[currentStopIndex];
    
    // 1. Locație
    const locParts = stop.locationKey.split(',');
    document.getElementById('loc-row').textContent = locParts[0] || '-';
    document.getElementById('loc-desc').textContent = locParts[1] || '-';
    document.getElementById('loc-shelf').textContent = locParts[2] || '-';
    document.getElementById('loc-box').textContent = locParts[3] || '-';

    // 2. Produs
    const displayDiv = document.getElementById('picking-sku-display');
    const sku = stop.sku;
    if (sku.length > 5) {
        const mainPart = sku.substring(0, sku.length - 5);
        const highlightPart = sku.substring(sku.length - 5);
        displayDiv.innerHTML = `${mainPart}<span class="text-highlight drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]">${highlightPart}</span>`;
    } else {
        displayDiv.textContent = sku;
    }

    // 3. Cantitate
    const qty = stop.quantityToPick;
    document.getElementById('picking-qty-display').textContent = `${qty} unitat${qty !== 1 ? 'e' : 'i'}`;

    // 4. Progres (Relativ la COMANDA CURENTĂ)
    const totalStopsInOrder = currentOrder.stops.length;
    const currentStopNumber = currentStopIndex + 1;
    const percentage = Math.round((currentStopNumber / totalStopsInOrder) * 100);

    document.getElementById('picking-progress-bar').style.width = `${percentage}%`;
    // Afișăm explicit că e per comandă
    document.getElementById('picking-progress-text').innerHTML = `Produs <span class="text-white">${currentStopNumber}</span> din ${totalStopsInOrder}`;
    document.getElementById('picking-progress-percent').textContent = `${percentage}%`;
}

// --- Logică Scanare ---

function startPickingScan() {
    startScanner('picking');
}

async function handlePickingScan(scannedCode) {
    if (currentRouteIndex >= pickingRoutes.length) return;
    
    const currentOrder = pickingRoutes[currentRouteIndex];
    const stop = currentOrder.stops[currentStopIndex];

    const expectedSku = stop.sku.toUpperCase();
    const scanned = scannedCode.trim().toUpperCase();

    if (scanned === expectedSku) {
        // stopScanner(); // Oprit automat de scanner.js
        showToast("Cod Corect!", false);
        await advancePickingStop(); 
    } else {
        // EROARE VIZUALĂ MARE
        showWrongProductError();
    }
}

function showWrongProductError() {
    // Oprire scanner temporar (dacă nu e oprit deja)
    if(window.html5QrcodeScanner) {
        // Nu-l oprim complet ca să nu reinițializăm camera greu, 
        // dar vizual acoperim totul.
        // Sau putem opri scanarea logică.
    }

    const overlay = document.getElementById('picking-error-overlay');
    overlay.classList.remove('hidden');

    // Ascunde după 2 secunde
    setTimeout(() => {
        overlay.classList.add('hidden');
        // Dacă scannerul a fost oprit, îl repornim? 
        // De regulă în scanner.js, onScanSuccess nu oprește camera decât dacă noi cerem.
        // Aici NU am cerut stopScanner(), deci camera merge în spate.
        // Utilizatorul poate scana din nou imediat ce dispare overlay-ul.
    }, 2000);
}

// --- Avansare și Finalizare Comandă ---

async function advancePickingStop() {
    const currentOrder = pickingRoutes[currentRouteIndex];
    const stop = currentOrder.stops[currentStopIndex];

    // 1. Scădere Stoc
    const inventory = loadFromLocalStorage('inventoryLocations');
    if (stop.locationKey !== "N/A" && inventory[stop.sku] && inventory[stop.sku][stop.locationKey]) {
         inventory[stop.sku][stop.locationKey] -= stop.quantityToPick;
         if (inventory[stop.sku][stop.locationKey] <= 0) {
             delete inventory[stop.sku][stop.locationKey];
         }
         saveToLocalStorage('inventoryLocations', inventory);
         await sendStorageUpdate(stop.sku, stop.locationKey, "scadere", stop.quantityToPick);
    }

    // 2. Incrementare
    currentStopIndex++;

    // 3. Verifică dacă s-a terminat COMANDA CURENTĂ
    if (currentStopIndex >= currentOrder.stops.length) {
        // Comanda e gata! Încercăm facturarea și AWB-ul
        const success = await handleOrderComplete(currentOrder.orderData);
        
        if (success) {
            // Totul OK -> Trecem la următoarea comandă
            currentRouteIndex++;
            currentStopIndex = 0;
        } else {
            // EROARE -> Rămânem aici
            // Decrementăm indexul pentru a nu fi "out of bounds" la render, 
            // și pentru a permite operatorului să vadă ultimul produs și să știe că s-a blocat aici.
            // Ideal ar fi un buton "Retry", dar momentan blocăm avansarea.
            currentStopIndex--; 
        }
    }
    
    // 4. Randează următorul pas (sau finish)
    renderCurrentPickingStop();
}

async function handleOrderComplete(orderData) {
    const orderId = orderData.order_id || orderData.id;
    const internalId = orderData.internal_id || "N/A";
    const awbUrl = orderData.awb_url;
    const marketplace = orderData.marketplace || "Unknown";

    showToast(`Comandă finalizată: ${internalId}. Se emite factura...`, false);

    // 1. Emitere Factură
    const invoiceSuccess = await window.sendInvoiceRequest({
        internal_order_id: internalId
    });

    if (!invoiceSuccess) {
        showToast("STOP: Factura nu a putut fi generată.", true);
        return false; // Oprește fluxul
    }

    // 2. Logică AWB (Doar dacă factura e OK)
    if (awbUrl && awbUrl.length > 5) {
        showToast(`Se printează AWB...`);
        await window.sendPrintAwbRequest({
            orderId: orderId,
            internalId: internalId
        });
    } else {
        showToast(`Se generează și printează AWB...`);
        await window.sendGenerateAwbRequest({
            internalId: internalId,
            marketplace: marketplace
        });
    }

    return true;
}

function skipPickingStop() {
    if (currentRouteIndex >= pickingRoutes.length) return;
    const currentOrder = pickingRoutes[currentRouteIndex];
    
    // Mutăm stop-ul curent la finalul listei acestei comenzi
    const stop = currentOrder.stops.splice(currentStopIndex, 1)[0];
    currentOrder.stops.push(stop);
    
    // Deoarece l-am scos de la indexul curent și l-am pus la coadă,
    // practic indexul curent acum pointează către "următorul" element vechi.
    // Nu incrementăm currentStopIndex, dar trebuie să verificăm limitele.
    
    // Refresh UI
    showToast("Produs amânat (la finalul comenzii).");
    renderCurrentPickingStop();
}

function finishPicking() {
    document.getElementById('picking-complete').classList.remove('hidden');
    liveOrders = []; 
    isOrderNotificationHidden = false;
    setupDashboardNotification();
}

// Expun funcțiile
window.setupDashboardNotification = setupDashboardNotification;
window.hideOrderNotification = hideOrderNotification;
window.startPickingProcess = startPickingProcess;
window.advancePickingStop = advancePickingStop;
window.skipPickingStop = skipPickingStop;
window.startPickingScan = startPickingScan;
window.handlePickingScan = handlePickingScan;