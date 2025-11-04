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

    // --- MODIFICARE: Selectare cameră ---
    let preferredCamId = null;
    const targetCameraLabelFragment = "superangurlar"; // Căutăm acest cuvânt în etichetă

    try {
        // 1. Listăm toate camerele video (true = cere și etichetele)
        const cameras = await QrScanner.listCameras(true);
        console.log("Toate camerele detectate:", cameras);

        // 2. Căutăm camera specifică "superangulară"
        const specificCamera = cameras.find(cam => 
            cam.label.toLowerCase().includes(targetCameraLabelFragment)
        );

        if (specificCamera) {
            // 3. Am găsit-o! O folosim pe aceasta.
            preferredCamId = specificCamera.id;
            console.log(`Găsit camera țintă (${specificCamera.label}). Se folosește ID: ${preferredCamId}`);
        } else {
            // 4. Nu am găsit camera "superangulară". Folosim logica anterioară (fallback).
            console.log(`Camera "${targetCameraLabelFragment}" nu a fost găsită. Se încearcă logica de fallback (camere spate).`);
            
            // 5. Filtrăm doar camerele de pe spate
            const rearCameras = cameras.filter(cam => 
                /rear|back|environment/i.test(cam.label)
            );

            console.log("Camere spate disponibile (fallback):", rearCameras);

            if (rearCameras.length > 1) {
                // 6. Am găsit mai multe camere pe spate. O alegem pe ULTIMA.
                preferredCamId = rearCameras[rearCameras.length - 1].id;
                console.log(`Fallback: Camere multiple detectate. Se folosește camera secundară: ${preferredCamId}`);
            } else if (rearCameras.length === 1) {
                // 7. Doar o cameră pe spate, o folosim pe aceea.
                preferredCamId = rearCameras[0].id;
                console.log(`Fallback: O singură cameră spate detectată: ${preferredCamId}`);
            } else {
                // 8. Fallback final dacă nu găsim nimic
                console.log("Fallback: Nicio cameră spate nu a fost găsită după etichetă. Se folosește 'environment'.");
                preferredCamId = 'environment';
            }
        }
    } catch (e) {
        console.error("Eroare la listarea camerelor, se folosește 'environment'.", e);
        preferredCamId = 'environment'; // Fallback general
    }
    // --- SFÂRȘIT MODIFICARE ---


    // Inițializează scannerul
    qrScanner = new QrScanner(
        videoElem,
        onScanSuccessAdapter,
        {
            onDecodeError: onScanError,
            
            // Am lăsat 'highlightScanRegion' comentat (din pasul anterior)
            // pentru a scana tot ecranul
            // highlightScanRegion: true, 
            
            highlightCodeOutline: true,
            
            returnDetailedScanResult: true,
            
            // --- MODIFICARE: Folosim ID-ul camerei selectate ---
            preferredCamera: preferredCamId
        }
    );

    // --- MODIFICARE PENTRU BORDURA NEAGRĂ ---
    // Această setare este VITALĂ și o păstrăm.
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
