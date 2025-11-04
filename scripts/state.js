// --- Constante API ---
window.STORAGE_WEBHOOK_URL = "https://automatizare.comandat.ro/webhook/storage-update";
window.GET_STORAGE_WEBHOOK_URL = "https://automatizare.comandat.ro/webhook/get-storage";
window.GET_ORDERS_WEBHOOK_URL = "https://automatizare.comandat.ro/webhook/8ba5359d-8ecd-4576-b44c-934ac4b661e2";

// --- Starea Aplicației ---
window.qrScanner = null;
window.currentScanMode = null; // 'product', 'location', 'find', 'move_product', 'move_destination'

// Stare "Adaugă Produs"
window.scannedProductList = []; // Listă de {sku, product, quantity}
window.scannedLocation = null;
window.currentScannedProduct = null; // NOU: {sku, product} - produsul scanat curent

// Stare "Mută Produs"
window.moveProductList = []; // Listă de {sku, product}
window.moveSourceSelections = {}; // Format: { "SKU": { "loc": cantitate } }
window.moveDestinationLocation = null;

// Stare Dashboard
window.isOrderNotificationHidden = false;

// Stare Comenzi
window.liveOrders = []; // <-- NOU (înlocuiește mockOrders)

// Stare Picking
window.pickingRoutes = [];
window.currentRouteIndex = 0;
window.currentStopIndex = 0;
