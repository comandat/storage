// --- Logică Scaner QR (cu nimiq/qr-scanner) ---
// Folosim din nou biblioteca originală
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
            
            // --- MODIFICARE ---
            // 1. Am DEZACTIVAT (comentat) "cutia" de scanare.
            // Acest lucru va forța scannerul să analizeze întregul
            // cadru video, permițând detectarea codurilor mici.
            // highlightScanRegion: true,
            
            // 2. Reactivăm conturul codului găsit (acesta rămâne util)
            highlightCodeOutline: true,
            
            // 3. Am ȘTERS funcția 'calculateScanRegion'
            // pentru a lăsa biblioteca să-și folosească
            // funcția implicită (cutia din centru).
            
            // 4. Necesara pentru a primi obiectul { data: "..." }
            returnDetailedScanResult: true 
        }
    );

    // --- MODIFICARE PENTRU BORDURA NEAGRĂ ---
    // Această setare este VITALĂ și o păstrăm.
    // Combinată cu scanarea regională (cutia), ar trebui
    // să funcționeze acum.
    qrScanner.setInversionMode('both');
    // --- SFÂRȘIT MODIFICARE ---

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

// Expun funcțiile necesare global
window.startScanner = startScanner;
window.stopScanner = stopScanner;
