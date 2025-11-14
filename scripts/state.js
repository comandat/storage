// --- Constante API ---
window.STORAGE_WEBHOOK_URL = "https://automatizare.comandat.ro/webhook/storage-update";
window.GET_STORAGE_WEBHOOK_URL = "https://automatizare.comandat.ro/webhook/get-storage";
window.GET_ORDERS_WEBHOOK_URL = "https://automatizare.comandat.ro/webhook/8ba5359d-8ecd-4576-b44c-934ac4b661e2";

// --- Starea Aplicației ---
window.qrScanner = null;
window.currentScanMode = null; // 'product', 'location', 'find', 'delete_product', 'delete_location'

// NOU: Stare pentru camere
window.availableCameras = [];
window.currentCameraIndex = 0;

// Stare "Adaugă Produs"
window.scannedProductList = []; // Listă de {sku, product, quantity}
window.scannedLocation = null;
window.currentScannedProduct = null; 

// Stare "Șterge Produs"
window.deleteProductList = []; // Listă de {sku, product, quantity}
window.deleteLocation = null;
window.currentScannedProductForDelete = null; // <-- MODIFICARE: Adăugat
