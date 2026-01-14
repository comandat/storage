// --- Constante API ---
window.STORAGE_WEBHOOK_URL = "https://automatizare.comandat.ro/webhook/storage-update";
window.GET_STORAGE_WEBHOOK_URL = "https://automatizare.comandat.ro/webhook/get-storage";
window.GET_ORDERS_WEBHOOK_URL = "https://automatizare.comandat.ro/webhook/8ba5359d-8ecd-4576-b44c-934ac4b661e2";
window.REFRESH_TOKEN_WEBHOOK = "https://automatizare.comandat.ro/webhook/refresh-easysales-print-access";

// --- Starea Aplicației ---
window.qrScanner = null;
// MODIFICAT: Scan modes
window.currentScanMode = null; // 'product', 'location', 'find', 'delete_product', 'delete_location'

// NOU: Stare pentru camere
window.availableCameras = [];
window.currentCameraIndex = 0;

// Stare "Adaugă Produs"
window.scannedProductList = []; // Listă de {sku, product, quantity}
window.scannedLocation = null;
window.currentScannedProduct = null; // NOU: {sku, product} - produsul scanat curent

// START MODIFICARE: Stare "Mută Produs" înlocuită cu Stare "Șterge Produs"
// START MODIFICARE: Stare "Mută Produs" înlocuită cu Stare "Șterge Produs"
window.deleteProductList = []; // Listă de {sku, product}
window.deleteLocation = null;
window.currentScannedProductForDelete = null; // <-- ADaugă ACEASTĂ LINIE
// FINAL MODIFICARE
// FINAL MODIFICARE

// Stare Dashboard
window.isOrderNotificationHidden = false;

// Stare Comenzi
window.liveOrders = []; // <-- NOU (înlocuiește mockOrders)

// Stare Picking
window.pickingRoutes = [];
window.currentRouteIndex = 0;
window.currentStopIndex = 0;
