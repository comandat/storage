/**
 * Încarcă stocul inițial de la webhook
 */
async function loadInitialStorage() {
    showLoading(true);
    try {
        const response = await fetch(GET_STORAGE_WEBHOOK_URL, { method: 'GET' });
        if (!response.ok) {
            throw new Error(`Eroare HTTP: ${response.status}`);
        }
        
        const inventoryDataArray = await response.json(); 
        const inventoryLocationsObject = {};
        
        if (Array.isArray(inventoryDataArray)) {
            inventoryDataArray.forEach(item => {
                const { sku, location, quantity } = item;
                if (!sku || !location || quantity === undefined) {
                    console.warn("Item de stoc invalid, ignorat:", item);
                    return;
                }
                if (!inventoryLocationsObject[sku]) {
                    inventoryLocationsObject[sku] = {};
                }
                inventoryLocationsObject[sku][location] = quantity;
            });
        } else {
            console.warn("Răspunsul API de stoc nu a fost un array:", inventoryDataArray);
        }

        saveToLocalStorage('inventoryLocations', inventoryLocationsObject);
        console.log("Stoc încărcat de la webhook (format brut):", inventoryDataArray);
        console.log("Stoc transformat și salvat:", inventoryLocationsObject);

    } catch (error) {
        console.error("Eroare la încărcarea stocului:", error);
        saveToLocalStorage('inventoryLocations', {});
    } finally {
        showLoading(false);
        await fetchAndSetupOrders();
    }
}


/**
 * Preluare comenzi de la API
 */
async function fetchAndSetupOrders() {
    try {
        const response = await fetch(GET_ORDERS_WEBHOOK_URL);
        if (!response.ok) throw new Error(`Eroare HTTP: ${response.status}`);
        liveOrders = await response.json(); 
        
        if (!Array.isArray(liveOrders)) {
            console.warn("Răspunsul de la API-ul de comenzi nu a fost un array.", liveOrders);
            liveOrders = [];
        }
        
    } catch (error) {
        console.error("Eroare la preluarea comenzilor:", error);
        showToast("Eroare la preluarea comenzilor.", true);
        liveOrders = [];
    } finally {
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
    }
}

// Funcția extractAsinFromSku a fost ȘTEARSĂ

/**
 * Preia detalii pentru mai multe SKU-uri.
 * MODIFICAT: Nu mai apelează API-ul de produse, returnează SKU-ul ca nume.
 */
async function fetchProductDetailsBatch(skus) {
    const productDB = loadFromLocalStorage('productDatabase');
    const productsToReturn = {};

    for (const sku of skus) {
        if (productDB[sku]) {
            productsToReturn[sku] = productDB[sku];
        } else {
            // Creează un produs placeholder
            const placeholderProduct = { name_ro: sku, name_en: sku, error: true };
            productDB[sku] = placeholderProduct; // Salvează placeholder în cache
            productsToReturn[sku] = placeholderProduct;
        }
    }
    
    // Salvează noile placeholder-uri (dacă au fost)
    saveToLocalStorage('productDatabase', productDB); 
    
    // Returnează direct, fără apel API (fără showLoading)
    return productsToReturn;
}

/**
 * Preia detaliile unui singur produs (folosind funcția de batch).
 * MODIFICAT: Acum este o funcție locală rapidă.
 */
async function getProductDetails(sku) {
    const productDB = loadFromLocalStorage('productDatabase');
    if (productDB[sku]) {
        return productDB[sku]; // Returnează din cache
    }
    
    // Apeleză funcția de batch (care acum e locală și rapidă)
    const productMap = await fetchProductDetailsBatch([sku]);
    
    return productMap[sku];
}

async function sendPrintTokenUpdate(curlString) {
    if (!curlString || curlString.length < 10) {
        showToast("Text invalid.", true);
        return;
    }

    showLoading(true);
    try {
        // Trimitem un JSON simplu { curl: "..." } așa cum am configurat în n8n
        const response = await fetch(REFRESH_TOKEN_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ curl: curlString })
        });

        if (response.ok) {
            showToast("Token actualizat cu succes!");
            return true;
        } else {
            throw new Error(`Eroare server: ${response.status}`);
        }
    } catch (error) {
        console.error("Eroare actualizare token:", error);
        showToast("Eroare la actualizare.", true);
        return false;
    } finally {
        showLoading(false);
    }
}

async function sendPrintAwbRequest(payload) {
    // Payload trebuie să fie un obiect: { orderId: 123, internalId: "..." }
    if (!payload) {
        showToast("Date lipsă pentru printare.", true);
        return;
    }

    showLoading(true);
    try {
        const response = await fetch(window.PRINT_AWB_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload) // Trimite tot obiectul exact cum vine
        });

        if (response.ok) {
            // Afișăm internal_id în mesajul de succes pentru confirmare vizuală
            const displayId = payload.internalId || payload.orderId;
            showToast(`Printare trimisă: ${displayId}`);
        } else {
            throw new Error(`Eroare server: ${response.status}`);
        }
    } catch (error) {
        console.error("Eroare printare AWB:", error);
        showToast("Eroare la trimiterea comenzii de printare.", true);
    } finally {
        showLoading(false);
    }
}

async function sendGenerateAwbRequest(payload) {
    // Payload așteptat: { internalId: "...", marketplace: "..." }
    if (!payload || !payload.internalId) {
        showToast("Date lipsă pentru generare AWB.", true);
        return;
    }

    showLoading(true);
    try {
        const response = await fetch(window.GENERATE_AWB_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showToast(`Se generează AWB pentru ${payload.internalId}...`);
            // Dacă generarea reușește, webhook-ul din n8n va declanșa automat și printarea
        } else {
            throw new Error(`Eroare server: ${response.status}`);
        }
    } catch (error) {
        console.error("Eroare generare AWB:", error);
        showToast("Eroare la generarea AWB.", true);
    } finally {
        showLoading(false);
    }
}


// ExpuN funcțiile necesare global
window.loadInitialStorage = loadInitialStorage;
window.fetchAndSetupOrders = fetchAndSetupOrders;
window.sendStorageUpdate = sendStorageUpdate;
window.fetchProductDetailsBatch = fetchProductDetailsBatch;
window.getProductDetails = getProductDetails;
window.sendPrintTokenUpdate = sendPrintTokenUpdate;
window.sendPrintAwbRequest = sendPrintAwbRequest;
window.sendGenerateAwbRequest = sendGenerateAwbRequest;
