// --- Logică "Adaugă Produs" (Pagina 3) ---

function goToAddStep(step) {
    document.getElementById('add-step-1-products').classList.add('hidden');
    document.getElementById('add-step-2-location').classList.add('hidden');
    document.getElementById('add-step-3-confirm').classList.add('hidden');

    if (step === 1) {
        document.getElementById('add-step-1-products').classList.remove('hidden');
        renderAddProductList(); 
    } else if (step === 2) {
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
    const product = await getProductDetails(sku);
    scannedProductList.push({ sku, product });
    renderAddProductList();
    showToast(`Adăugat: ${product.name_ro || sku}`);
}

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

function removeProductFromAddList(index) {
    const removed = scannedProductList.splice(index, 1);
    showToast(`Șters: ${removed[0].product.name_ro || removed[0].sku}`);
    renderAddProductList();
}

function handleLocationScan(locationKey) {
    scannedLocation = locationKey;
    
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
    document.getElementById('add-confirm-location').innerHTML = formatLocation(locationKey, true);
    goToAddStep(3); 
}

async function saveMultiAdd() {
    if (scannedProductList.length === 0 || !scannedLocation) {
        showToast("Date invalide. Încearcă din nou.", true);
        return;
    }

    showLoading(true);
    const inventory = loadFromLocalStorage('inventoryLocations');
    
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
        
        storagePromises.push(
            sendStorageUpdate(sku, scannedLocation, "adunare", quantityToAdd)
        );
    }
    
    try {
        saveToLocalStorage('inventoryLocations', inventory);
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
    scannedProductList = []; 
    scannedLocation = null;
    document.getElementById('add-step-1-products').classList.remove('hidden');
    document.getElementById('add-step-2-location').classList.add('hidden');
    document.getElementById('add-step-3-confirm').classList.add('hidden');
    renderAddProductList(); 
    if (navigateToDashboard) {
        showPage('page-dashboard');
    }
}
