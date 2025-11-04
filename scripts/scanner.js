// --- Logică Scaner QR (cu nimiq/qr-scanner) ---
import QrScanner from './qr-scanner.min.js';

/**
 * Funcție adaptor pentru a trimite rezultatul scanării
 * în formatul așteptat de funcția ta existentă onScanSuccess.
 */
function onScanSuccessAdapter(result) {
    // result este un obiect: { data: "...", cornerPoints: [...] }
    onScanSuccess(result.data, result);
}

/**
 * Funcție adaptor pentru erori.
 */
function onScanError(error) {
    // Putem ignora "No QR code found"
    if (error === QrScanner.NO_QR_CODE_FOUND) {
        return;
    }
    console.error("Eroare QrScanner:", error);
    showToast(`Eroare scanare: ${error}`, true);
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

    // Inițializează scannerul
    qrScanner = new QrScanner(
        videoElem,
        onScanSuccessAdapter,
        {
            onDecodeError: onScanError,
            
            // --- Optimizări pentru viteză ---
            
            // 1. Nu randa elemente grafice peste video
            highlightScanRegion: false,
            highlightCodeOutline: false,
            
            // 2. Spune-i să scaneze tot cadrul video (nu doar o regiune)
            // Asta replică optimizarea ta de a scoate 'qrbox'
            calculateScanRegion: (video) => {
                return {
                    x: 0,
                    y: 0,
                    width: video.videoWidth,
                    height: video.videoHeight
                };
            },
            
            // 3. Necesara pentru a primi obiectul { data: "..." }
            returnDetailedScanResult: true 
        }
    );

    try {
        await qrScanner.start();
    } catch (err) {
        console.error("Eroare la pornirea QrScanner (nimiq):", err);
        showToast("Eroare la pornirea camerei. Verifică permisiunile.", true);
        stopScanner();
    }
}

function stopScanner() {
    if (qrScanner) {
        qrScanner.destroy(); // Folosim destroy() pentru a curăța complet
        qrScanner = null;
    }
    document.getElementById('scanner-modal').classList.remove('active');
}

/**
 * Această funcție este cea originală din proiectul tău.
 * Rămâne neschimbată, deoarece adaptorul (onScanSuccessAdapter)
 * îi trimite datele în formatul corect.
 */
function onScanSuccess(decodedText, decodedResult) {
    stopScanner();
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
