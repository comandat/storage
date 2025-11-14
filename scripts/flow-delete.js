// --- Logică "Șterge Produs" (Pagina 5) ---

function resetDeleteFlow(navigateToDashboard = false) {
    deleteProductList = []; 
    deleteLocation = null;
    
    document.getElementById('delete-step-1-products').classList.remove('hidden');
    document.getElementById('delete-step-2-location').classList.add('hidden');
    document.getElementById('delete-step-3-confirm').classList.add('hidden');
    
    document.getElementById('delete-product-list').innerHTML = ''; 

    if (navigateToDashboard) {
        showPage('page-dashboard');
    }
}

function goToDeleteStep(step) {
    document.getElementById('delete-step-1-products').classList.add('hidden');
    document.getElementById('delete-step-2-location').classList.add('hidden');
    document.getElementById('delete-step-3-confirm').classList.add('hidden');
    
    if (step === 1) {
        document.getElementById('delete-step-1-products').classList.remove('hidden');
        renderDeleteProductList();
    } else if (step === 2) {
        if (deleteProductList.length === 0) {
            showToast("Trebuie să scanezi cel puțin un produs.", true);
            goToDeleteStep(1); 
            return;
        }
        document.getElementById('delete-summary-text').textContent = `${deleteProductList.length} SKU-uri selectate`;
        document.getElementById('delete-step-2-location').classList.remove('hidden');
    } else if (step === 3) {
         renderDeleteConfirmPage(); 
         document.getElementById('delete-step-3-confirm').classList.remove('hidden');
    }
}

async function handleDeleteProductScan(sku) {
    if (deleteProductList.find(p => p.sku === sku)) {
        showToast("Produsul este deja în listă.", true);
        return;
    }
    const product = await getProductDetails(sku);
    deleteProductList.push({ sku, product });
    renderDeleteProductList();
    showToast(`Adăugat: ${product.name_ro || sku}`);
}

function renderDeleteProductList() {
    const listContainer = document.getElementById('delete-product-list');
    const continueBtn = document.getElementById('delete-to-location-btn');
    
    if (deleteProductList.length === 0) {
        listContainer.innerHTML = `<p class="text-subtext-light dark:text-subtext-dark text-center p-4">Niciun produs scanat.</p>`;
        continueBtn.classList.add('hidden');
    } else {
        listContainer.innerHTML = deleteProductList.map((item, index) => {
            return `
                <div class="product-list-item">
                    <div class="flex-1 truncate pr-2">
                        <p class="text-text-light dark:text-text-dark font-semibold truncate">${item.product.name_ro || item.sku}</p>
                        <p class="text-xs text-subtext-light dark:text-subtext-dark font-mono">${item.sku}</p>
                    </div>
                    <button onclick="removeProductFromDeleteList(${index})" class="w-10 h-10 flex-shrink-0 bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 rounded-full flex items-center justify-center">
                        <span class="material-icons-outlined">delete</span>
                    </button>
                </div>
            `;
        }).join('');
        continueBtn.classList.remove('hidden');
    }
}

function removeProductFromDeleteList(index) {
    const removed = deleteProductList.splice(index, 1);
    showToast(`Șters: ${removed[0].product.name_ro || removed[0].sku}`);
    renderDeleteProductList();
}


function handleDeleteLocationScan(locationKey) {
    deleteLocation = locationKey;
    goToDeleteStep(3);
}

function renderDeleteConfirmPage() {
    let productHtml = deleteProductList.map(item => {
        const product = item.product;
        return `<li>${product.name_ro || item.sku}</li>`
    }).join('');

    document.getElementById('delete-confirm-product').innerHTML = `<ul class="list-disc list-inside">${productHtml}</ul>`;
    document.getElementById('delete-confirm-location').innerHTML = formatLocation(deleteLocation, true);
}

async function saveDeleteProduct() {
    if (deleteProductList.length === 0 || !deleteLocation) {
        showToast("Date invalide. Încearcă din nou.", true);
        return;
    }

    showLoading(true);
    const inventory = loadFromLocalStorage('inventoryLocations');
    
    const deletionPromises = [];
    let totalProductsAffected = 0;

    for (const item of deleteProductList) {
        const sku = item.sku;
        
        // Verifică dacă SKU-ul există și are locația specificată
        if (inventory[sku] && inventory[sku][deleteLocation]) {
            const quantityToDelete = inventory[sku][deleteLocation]; // Luăm întreaga cantitate
            
            // Ștergem locația din obiectul SKU-ului
            delete inventory[sku][deleteLocation];
            totalProductsAffected++;
            
            // Dacă SKU-ul nu mai are nicio locație, îl ștergem complet
            if (Object.keys(inventory[sku]).length === 0) {
                delete inventory[sku];
            }
            
            // Trimitem comanda de scădere cu întreaga cantitate
            deletionPromises.push(
                sendStorageUpdate(sku, deleteLocation, "scadere", quantityToDelete)
            );
        }
    }
    
    if (totalProductsAffected === 0) {
        showToast("Produsele selectate nu au fost găsite în locația scanată.", true);
        showLoading(false);
        return;
    }
    
    saveToLocalStorage('inventoryLocations', inventory);
    await Promise.all(deletionPromises);
    
    showLoading(false);
    showToast(`Șterse ${totalProductsAffected} SKU-uri din ${deleteLocation}`);
    resetDeleteFlow(true); 
}

// Expun funcțiile necesare global
window.resetDeleteFlow = resetDeleteFlow;
window.goToDeleteStep = goToDeleteStep;
window.handleDeleteProductScan = handleDeleteProductScan;
window.removeProductFromDeleteList = removeProductFromDeleteList;
window.handleDeleteLocationScan = handleDeleteLocationScan;
window.saveDeleteProduct = saveDeleteProduct;
