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
 * Preia detalii pentru mai multe SKU-uri într-un singur apel API.
 */
async function fetchProductDetailsBatch(skus) {
    const productDB = loadFromLocalStorage('productDatabase');
    const productsToReturn = {};
    const skuToAsinMap = new Map(); 
    const asinToSkuMap = new Map(); 

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

    if (asinsToFetchUnique.length === 0) {
        return productsToReturn;
    }

    showLoading(true);
    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ asins: asinsToFetchUnique }) 
        });

        if (!response.ok) {
            throw new Error(`Eroare HTTP: ${response.status}`);
        }

        const asinDataMap = await response.json();

        for (const [asin, productData] of Object.entries(asinDataMap)) {
            if (!productData.name_en || !productData.name_ro) {
                productData.name_en = productData.name_en || asin;
                productData.name_ro = productData.name_ro || asin;
            }

            const correspondingSkus = asinToSkuMap.get(asin) || [];
            for (const sku of correspondingSkus) {
                productDB[sku] = productData; 
                productsToReturn[sku] = productData; 
            }
        }

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

        saveToLocalStorage('productDatabase', productDB); 
        
    } catch (error) {
        console.error("Eroare webhook batch:", error);
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
 * Preia detaliile unui singur produs (folosind funcția de batch).
 */
async function getProductDetails(sku) {
    const productDB = loadFromLocalStorage('productDatabase');
    if (productDB[sku]) {
        return productDB[sku]; // Returnează din cache
    }
    
    const productMap = await fetchProductDetailsBatch([sku]);
    
    return productMap[sku] || { name_ro: sku, name_en: sku, error: true };
}
