// --- Logică "Mută Produs" (Pagina 5) ---

function resetMoveFlow(navigateToDashboard = false) {
    moveProductList = []; 
    moveSourceSelections = {};
    moveDestinationLocation = null;
    
    document.getElementById('move-step-1-products').classList.remove('hidden');
    document.getElementById('move-step-2-source').classList.add('hidden');
    document.getElementById('move-step-3-destination').classList.add('hidden');
    document.getElementById('move-step-4-confirm').classList.add('hidden');
    
    document.getElementById('move-product-list').innerHTML = ''; 
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
        renderMoveProductList();
    } else if (step === 2) {
        renderMoveSourceList(); 
        document.getElementById('move-step-2-source').classList.remove('hidden');
    } else if (step === 3) {
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
            goToMoveStep(2); 
            return;
        }
        document.getElementById('move-summary-text').textContent = `Se vor muta ${totalToMove} buc. (${skuCount} SKU-uri)`;
        document.getElementById('move-step-3-destination').classList.remove('hidden');
    } else if (step === 4) {
         renderMoveConfirmPage(); 
         document.getElementById('move-step-4-confirm').classList.remove('hidden');
    }
}

async function handleMoveProductScan(sku) {
    if (moveProductList.find(p => p.sku === sku)) {
        showToast("Produsul este deja în listă.", true);
        return;
    }
    const product = await getProductDetails(sku);
    moveProductList.push({ sku, product });
    renderMoveProductList();
    showToast(`Adăugat: ${product.name_ro || sku}`);
}

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

function removeProductFromMoveList(index) {
    const removed = moveProductList.splice(index, 1);
    if (moveSourceSelections[removed[0].sku]) {
        delete moveSourceSelections[removed[0].sku];
    }
    showToast(`Șters: ${removed[0].product.name_ro || removed[0].sku}`);
    renderMoveProductList();
}

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
        inputElement.value = max; 
    }
    
    if (!moveSourceSelections[sku]) {
        moveSourceSelections[sku] = {};
    }
    moveSourceSelections[sku][locationKey] = value;
}

function handleMoveDestinationScan(locationKey) {
    moveDestinationLocation = locationKey;
    goToMoveStep(4);
}

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
    
    productHtml = Object.keys(skuTotals).map(sku => {
        const product = moveProductList.find(p => p.sku === sku).product;
        return `<li><span class="font-bold">${skuTotals[sku]} x</span> ${product.name_ro || sku}</li>`
    }).join('');

    document.getElementById('move-confirm-product').innerHTML = `<ul class="list-disc list-inside">${productHtml}</ul>`;
    document.getElementById('move-confirm-quantity').textContent = `${totalToMove} bucăți totale`;
    document.getElementById('move-confirm-sources').innerHTML = sourcesHtml;
    document.getElementById('move-confirm-destination').innerHTML = formatLocation(moveDestinationLocation, true);
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
    const additionPayloads = {}; 

    for (const sku in moveSourceSelections) {
        if (!inventory[sku]) inventory[sku] = {};
        let totalMovedForSku = 0;
        
        for (const locKey in moveSourceSelections[sku]) {
            const quantityToMove = moveSourceSelections[sku][locKey];
            if (quantityToMove > 0) {
                totalMoved += quantityToMove;
                totalMovedForSku += quantityToMove;
                
                const currentSourceQty = inventory[sku][locKey] || 0;
                inventory[sku][locKey] = currentSourceQty - quantityToMove;
                if (inventory[sku][locKey] <= 0) {
                    delete inventory[sku][locKey];
                }
                
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
    
    saveToLocalStorage('inventoryLocations', inventory);
    await Promise.all(subtractionPromises);

    const additionPromises = [];
    
    for (const sku in additionPayloads) {
        const quantityToAdd = additionPayloads[sku];
        const currentDestQty = inventory[sku][moveDestinationLocation] || 0;
        inventory[sku][moveDestinationLocation] = currentDestQty + quantityToAdd;

        additionPromises.push(
            sendStorageUpdate(sku, moveDestinationLocation, "adunare", quantityToAdd)
        );
    }

    await Promise.all(additionPromises);
    saveToLocalStorage('inventoryLocations', inventory);
    
    showLoading(false);
    showToast(`Mutat ${totalMoved} buc. la ${moveDestinationLocation}`);
    resetMoveFlow(true); 
}

// ExpuN funcțiile necesare global
window.resetMoveFlow = resetMoveFlow;
window.goToMoveStep = goToMoveStep;
window.handleMoveProductScan = handleMoveProductScan;
window.removeProductFromMoveList = removeProductFromMoveList;
window.updateMoveSelection = updateMoveSelection; // Aceasta a fost linia cu eroarea
window.handleMoveDestinationScan = handleMoveDestinationScan;
window.saveMoveProduct = saveMoveProduct;
