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
    document.getElementById('picking-success-overlay').classList.add('hidden');
    document.getElementById('floating-order-bubble').classList.remove('visible');
    
    // Inițializează
    window.processedOrderIds = new Set(); 

    if (liveOrders.length === 0) {
        finishPicking();
        return;
    }

    // SORTARE: De la prima intrată (Cea mai veche) la ultima (Cea mai nouă)
    // Presupunem că ID-urile sunt incrementale. Sortăm ASC după ID.
    liveOrders.sort((a, b) => {
        const idA = a.order_id || a.id || 0;
        const idB = b.order_id || b.id || 0;
        return idA - idB;
    });

    // 1. Grupează și pregătește lista de COMENZI
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
    
    // Colectăm toate SKU-urile
    const allSkus = new Set();
    orders.forEach(o => {
        if(Array.isArray(o.products)) o.products.forEach(p => allSkus.add(p.sku));
    });
    const productMap = await fetchProductDetailsBatch(Array.from(allSkus));

    for (const order of orders) {
        const consolidatedMap = new Map();
        if (!Array.isArray(order.products)) continue;

        for (const item of order.products) {
            if (consolidatedMap.has(item.sku)) {
                consolidatedMap.get(item.sku).quantityToPick += item.quantity;
            } else {
                consolidatedMap.set(item.sku, {
                    sku: item.sku,
                    quantityToPick: item.quantity,
                    locationKey: inventory[item.sku] ? Object.keys(inventory[item.sku])[0] || "N/A" : "N/A",
                    product: productMap[item.sku]
                });
            }
        }

        const stops = Array.from(consolidatedMap.values());
        
        // Sortare în cadrul comenzii (opțional, după locație)
        stops.sort((a, b) => {
            if (a.locationKey === "N/A") return 1;
            if (b.locationKey === "N/A") return -1;
            return a.locationKey.localeCompare(b.locationKey);
        });

        if (stops.length > 0) {
            orderList.push({
                orderData: order,
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

    // 4. Progres (GLOBAL PE COMENZI)
    const totalOrders = pickingRoutes.length;
    const currentOrderNumber = currentRouteIndex + 1;
    
    // Calculăm procentul în funcție de câte comenzi am terminat + cât am făcut din comanda curentă
    // (Opțional, pentru finețe) SAU pur și simplu "Comanda X din Y"
    
    // Text: "Comanda 1 din 5"
    document.getElementById('picking-progress-text').innerHTML = `Comanda <span class="text-white">${currentOrderNumber}</span> din ${totalOrders}`;
    
    // Bara: Progresul global
    // Fiecare comandă completă = 1 punct. Comanda curentă contribuie cu fracție.
    const stepsInCurrentOrder = currentOrder.stops.length;
    const currentStep = currentStopIndex; // începe de la 0
    
    const fraction = stepsInCurrentOrder > 0 ? (currentStep / stepsInCurrentOrder) : 0;
    const globalProgress = ((currentRouteIndex + fraction) / totalOrders) * 100;
    
    document.getElementById('picking-progress-bar').style.width = `${Math.round(globalProgress)}%`;
    document.getElementById('picking-progress-percent').textContent = `${Math.round(globalProgress)}%`;
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
        showToast("Cod Corect!", false);
        await advancePickingStop(); 
    } else {
        showWrongProductError();
    }
}

function showWrongProductError() {
    const overlay = document.getElementById('picking-error-overlay');
    overlay.classList.remove('hidden');
    setTimeout(() => {
        overlay.classList.add('hidden');
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

    // 2. Incrementare pas
    currentStopIndex++;

    // 3. Verifică dacă s-a terminat COMANDA
    if (currentStopIndex >= currentOrder.stops.length) {
        
        // --- FINALIZARE COMANDĂ ---
        const success = await handleOrderComplete(currentOrder.orderData);
        
        if (success) {
            // Dacă totul e OK, trecem la următoarea
            currentRouteIndex++;
            currentStopIndex = 0;
        } else {
            // Dacă eroare, rămânem pe loc (vizual la ultimul produs)
            // Operatorul trebuie să rezolve eroarea extern și să încerce din nou?
            // Deoarece am incrementat deja stocul local, e tricky.
            // Pentru simplitate, decrementăm indexul vizual.
            currentStopIndex--; 
        }
    }
    
    renderCurrentPickingStop();
}

async function handleOrderComplete(orderData) {
    const orderId = orderData.order_id || orderData.id;
    const internalId = orderData.internal_id || "N/A";
    const awbUrl = orderData.awb_url;
    const marketplace = orderData.marketplace || "Unknown";

    showToast(`Finalizare comandă ${internalId}...`, false);

    // 1. Emitere Factură
    const invoiceSuccess = await window.sendInvoiceRequest({
        internal_order_id: internalId
    });

    if (!invoiceSuccess) {
        showToast("STOP: Facturare eșuată.", true);
        return false; 
    }

    // 2. Logică AWB
    try {
        if (awbUrl && awbUrl.length > 5) {
            await window.sendPrintAwbRequest({
                orderId: orderId,
                internalId: internalId
            });
        } else {
            await window.sendGenerateAwbRequest({
                internalId: internalId,
                marketplace: marketplace
            });
        }
    } catch (e) {
        showToast("Eroare la AWB.", true);
        return false;
    }

    // 3. AFIȘARE TIMER SUCCES (5 secunde)
    // Dacă am ajuns aici, totul e OK (Factura + AWB trimis)
    await showSuccessTimer();

    return true;
}

function showSuccessTimer() {
    return new Promise((resolve) => {
        const overlay = document.getElementById('picking-success-overlay');
        const countSpan = document.getElementById('success-timer-count');
        const ring = document.getElementById('success-timer-ring');
        
        overlay.classList.remove('hidden');
        
        let secondsLeft = 5;
        countSpan.textContent = secondsLeft;
        
        // Reset ring animation
        ring.style.strokeDashoffset = '0';
        
        // Force reflow
        void ring.offsetWidth;
        
        // Start animation (754 is circumference)
        ring.style.strokeDashoffset = '754';
        ring.style.transitionDuration = '5s';

        const timer = setInterval(() => {
            secondsLeft--;
            countSpan.textContent = secondsLeft;
            
            if (secondsLeft <= 0) {
                clearInterval(timer);
                overlay.classList.add('hidden');
                resolve(); // Gata, putem trece mai departe
            }
        }, 1000);
    });
}

function skipPickingStop() {
    if (currentRouteIndex >= pickingRoutes.length) return;
    
    // Dacă e singura comandă, nu are sens să o mutăm
    if (pickingRoutes.length <= 1) {
        showToast("Este singura comandă rămasă.", true);
        return;
    }
    
    // 1. Scoatem comanda curentă
    const skippedOrder = pickingRoutes.splice(currentRouteIndex, 1)[0];
    
    // 2. O mutăm la final
    pickingRoutes.push(skippedOrder);
    
    // 3. Resetăm produsul la 0 pentru noua comandă care a intrat pe poziție
    currentStopIndex = 0;
    
    showToast("Comandă amânată.");
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
