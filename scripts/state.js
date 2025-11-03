// --- Constante API ---
const WEBHOOK_URL = "https://automatizare.comandat.ro/webhook/39e78a55-36c9-4948-aa2d-d9301c996562-test";
const STORAGE_WEBHOOK_URL = "https://automatizare.comandat.ro/webhook/storage-update";
const GET_STORAGE_WEBHOOK_URL = "https://automatizare.comandat.ro/webhook/get-storage";
const GET_ORDERS_WEBHOOK_URL = "https://automatizare.comandat.ro/webhook/8ba5359d-8ecd-4576-b44c-934ac4b661e2";

// --- Starea Aplicației ---
let html5QrCode;
let currentScanMode = null; // 'product', 'location', 'find', 'move_product', 'move_destination'

// Stare "Adaugă Produs"
let scannedProductList = []; // Listă de {sku, product}
let scannedLocation = null;

// Stare "Mută Produs"
let moveProductList = []; // Listă de {sku, product}
let moveSourceSelections = {}; // Format: { "SKU": { "loc": cantitate } }
let moveDestinationLocation = null;

// Stare Dashboard
let isOrderNotificationHidden = false;

// Stare Comenzi
let liveOrders = []; // <-- NOU (înlocuiește mockOrders)

// Stare Picking
let pickingRoutes = [];
let currentRouteIndex = 0;
let currentStopIndex = 0;
