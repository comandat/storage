// --- Logică Scaner QR (cu zxing-js/library) ---

// Nu mai importăm QrScanner. Vom folosi obiectul global 'ZXing'
// încărcat din CDN în index.html

// Variabilă globală în modul pentru a ține minte instanța scannerului
let zxingCodeReader = null;

/**
 * Funcție de succes a scanării (cea originală)
 */
function onScanSuccess(decodedText, decodedResult) {
    stopScanner();
    
    // Afișează un feedback scurt (vibrație) dacă e posibil
    if (navigator.vibrate) {
        navigator.vibrate(100);
    }

    // Pasează rezultatul către funcția relevantă
    if (currentScanMode === 'product') {
        handleProductScan(decodedText);
    } else if (currentScanMode === 'location') {
        handleLocationScan(decodedText);
    } else if (currentScanMode === 'find') {
        handleFindScan(decodedText);
    } else if (currentScanMode === 'move_product') {
        handleMoveProductScan(decodedText);
    } else if (currentScanMode === 'move_destination') {
        handleMoveDestinationScan(decodedText);
    }
}

/**
 * Funcție de eroare a scanării
 */
function onScanError(error) {
    // Ignorăm erorile de "Not Found", sunt normale în timpul scanării
    if (error instanceof ZXing.NotFoundException) {
        return;
    }
    console.error("Eroare ZXing:", error);
    showToast(`Eroare scanare: ${error.message}`, true);
}

async function startScanner(mode) {
    currentScanMode = mode;
    document.getElementById('scanner-modal').classList.add('active');

    const videoElem = document.getElementById('qr-video');
    if (!videoElem) {
        console.error("Elementul <video id='qr-video'> nu a fost găsit.");
        stopScanner();
        return;
    }

    // Inițializăm cititorul ZXing. 
    // Acesta include capabilități de inversare și robustețe.
    zxingCodeReader = new ZXing.BrowserMultiFormatReader();

    try {
        // Începe decodarea de la camera
        // 'undefined' lasă ZXing să aleagă camera (default e cea 'environment'/spate)
        zxingCodeReader.decodeFromVideoDevice(undefined, 'qr-video', (result, err) => {
            if (result) {
                // Avem un rezultat!
                onScanSuccess(result.getText(), result);
            }
            if (err) {
                // Avem o eroare
                onScanError(err);
            }
        });
    } catch (err) {
        console.error("Eroare la pornirea camerei cu ZXing:", err);
        showToast("Eroare la pornirea camerei. Verifică permisiunile.", true);
        stopScanner();
    }
}

function stopScanner() {
    if (zxingCodeReader) {
        zxingCodeReader.reset(); // Oprește camera și eliberează resursele
        zxingCodeReader = null;
    }
    document.getElementById('scanner-modal').classList.remove('active');
}

// Expun funcțiile necesare global
window.startScanner = startScanner;
window.stopScanner = stopScanner;
