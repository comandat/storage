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
    document.getElementById('picking-item-success-overlay').classList.add('hidden');
    document.getElementById('floating-order-bubble').classList.remove('visible');
    
    // Inițializează
    window.processedOrderIds = new Set(); 

    if (liveOrders.length === 0) {
        finishPicking();
        return;
    }

    // SORTARE: De la prima intrată (Cea mai veche) la ultima (Cea mai nouă)
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
    // Încărcăm o copie a stocului pentru a face "rezervări" virtuale în timp ce calculăm rutele
    // Astfel, dacă Comanda 1 ia tot stocul din Locația A, Comanda 2 nu va fi trimisă tot acolo.
    const inventory = loadFromLocalStorage('inventoryLocations') || {};
    
    // Colectăm SKU-uri pentru detalii
    const allSkus = new Set();
    orders.forEach(o => {
        if(Array.isArray(o.products)) o.products.forEach(p => allSkus.add(p.sku));
    });
    const productMap = await fetchProductDetailsBatch(Array.from(allSkus));

    for (const order of orders) {
        if (!Array.isArray(order.products)) continue;
        
        let orderStops = [];
        
        // 1. Consolidăm cererea per SKU în cadrul comenzii
        const demandMap = new Map();
        for (const item of order.products) {
            const current = demandMap.get(item.sku) || 0;
            demandMap.set(item.sku, current + item.quantity);
        }

        // 2. Alocăm stoc pentru fiecare SKU
        for (const [sku, qtyNeeded] of demandMap.entries()) {
            let qtyRemaining = qtyNeeded;
            const productInfo = productMap[sku];
            
            const skuLocations = inventory[sku] || {};
            // Sortăm locațiile pentru a fi ordonați (ex: 1,2,3... apoi A,B,C)
            const sortedLocKeys = Object.keys(skuLocations).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

            // Iterăm locațiile și luăm cât putem
            for (const locKey of sortedLocKeys) {
                if (qtyRemaining <= 0) break;
                
                const available = skuLocations[locKey];
                if (available <= 0) continue;

                const toTake = Math.min(available, qtyRemaining);
                
                orderStops.push({
                    sku: sku,
                    quantityToPick: toTake,
                    locationKey: locKey,
                    product: productInfo
                });

                // Actualizăm starea locală/virtuală
                qtyRemaining -= toTake;
                skuLocations[locKey] -= toTake;
            }

            // Dacă nu am găsit suficient stoc
            if (qtyRemaining > 0) {
                orderStops.push({
                    sku: sku,
                    quantityToPick: qtyRemaining,
                    locationKey: "LIPSĂ STOC", 
                    product: productInfo
                });
            }
        }

        // 3. Sortăm pașii comenzii pentru un traseu optim (Locația 1 -> Locația 9)
        orderStops.sort((a, b) => {
            if (a.locationKey === "LIPSĂ STOC") return 1;
            if (b.locationKey === "LIPSĂ STOC") return -1;
            return a.locationKey.localeCompare(b.locationKey, undefined, { numeric: true });
        });

        if (orderStops.length > 0) {
            orderList.push({
                orderData: order,
                stops: orderStops
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

    // -- Indicator Multi-Produs --
    const indicator = document.getElementById('multi-product-indicator');
    if (currentOrder.stops.length > 1) {
        indicator.classList.remove('hidden');
    } else {
        indicator.classList.add('hidden');
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
    
    // Text: "Comanda 1 din 5"
    document.getElementById('picking-progress-text').innerHTML = `Comanda <span class="text-white">${currentOrderNumber}</span> din ${totalOrders}`;
    
    // Bara: Progresul global
    const stepsInCurrentOrder = currentOrder.stops.length;
    const currentStep = currentStopIndex; 
    
    const fraction = stepsInCurrentOrder > 0 ? (currentStep / stepsInCurrentOrder) : 0;
    const globalProgress = ((currentRouteIndex + fraction) / totalOrders) * 100;
    
    document.getElementById('picking-progress-bar').style.width = `${Math.round(globalProgress)}%`;
    document.getElementById('picking-progress-percent').textContent = `${Math.round(globalProgress)}%`;
}

// --- Logică Scanare ---

window.errorLottieAnim = null;

function initErrorAnimation() {
    const container = document.getElementById('lottie-error-container');
    if (!container) return;
    
    try {
        window.errorLottieAnim = lottie.loadAnimation({
            container: container,
            renderer: 'svg',
            loop: false,
            autoplay: false,
            path: 'assets/error.json'
        });
    } catch (e) {
        console.warn("Lottie load failed", e);
    }
}

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
    
    if (!window.errorLottieAnim) {
        initErrorAnimation();
    }
    if (window.errorLottieAnim) {
        window.errorLottieAnim.goToAndPlay(0, true);
    }
    
    setTimeout(() => {
        overlay.classList.add('hidden');
    }, 3000);
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
            currentRouteIndex++;
            currentStopIndex = 0;
        } else {
            currentStopIndex--; 
        }
    } else {
        // --- COMANDA CONTINUĂ (Mai sunt produse) ---
        // Afișăm overlay-ul verde intermediar pentru 4 secunde
        await showItemSuccessOverlay();
    }
    
    renderCurrentPickingStop();
}

function showItemSuccessOverlay() {
    return new Promise((resolve) => {
        const overlay = document.getElementById('picking-item-success-overlay');
        overlay.classList.remove('hidden');
        
        setTimeout(() => {
            overlay.classList.add('hidden');
            resolve();
        }, 4000); // 4 secunde
    });
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
        void ring.offsetWidth;
        ring.style.strokeDashoffset = '754';
        ring.style.transitionDuration = '5s';

        const timer = setInterval(() => {
            secondsLeft--;
            countSpan.textContent = secondsLeft;
            
            if (secondsLeft <= 0) {
                clearInterval(timer);
                overlay.classList.add('hidden');
                resolve(); 
            }
        }, 1000);
    });
}

function skipPickingStop() {
    if (currentRouteIndex >= pickingRoutes.length) return;
    
    if (pickingRoutes.length <= 1) {
        showToast("Este singura comandă rămasă.", true);
        return;
    }
    
    const skippedOrder = pickingRoutes.splice(currentRouteIndex, 1)[0];
    pickingRoutes.push(skippedOrder);
    
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