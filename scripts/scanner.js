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

/**
 * Aplică zoom-ul curent pe track-ul video activ
 */
async function applyZoom() {
    try {
        if (qrScanner && qrScanner.$video && qrScanner.$video.srcObject) {
            const track = qrScanner.$video.srcObject.getVideoTracks()[0];
            const capabilities = track.getCapabilities();

            if ('zoom' in capabilities) {
                const targetZoom = 2; // Zoom 2x
                const maxZoom = capabilities.zoom.max;
                const minZoom = capabilities.zoom.min || 1;
                
                const zoomValue = Math.max(minZoom, Math.min(targetZoom, maxZoom));
                
                await track.applyConstraints({ advanced: [{ zoom: zoomValue }] });
                console.log(`Zoom aplicat: ${zoomValue} (Max: ${maxZoom}, Min: ${minZoom})`);
            } else {
                console.log("Camera nu suportă zoom (capabilities.zoom).");
            }
        }
    } catch (zoomErr) {
        console.warn("Eroare la aplicarea zoom-ului:", zoomErr);
    }
}

async function startScanner(mode) {
    currentScanMode = mode;
    document.getElementById('scanner-modal').classList.add('active');
    document.getElementById('switch-cam-button').style.display = 'none'; // Ascunde inițial
    
    const videoElem = document.getElementById('qr-video');
    if (!videoElem) {
        console.error("Elementul <video id='qr-video'> nu a fost găsit.");
        stopScanner();
        return;
    }

    // --- MODIFICARE: Listare, Logare și Selectare Cameră ---
    let preferredCamId = null;
    const targetCameraLabelFragment = "superangurlar";

    try {
        window.availableCameras = await QrScanner.listCameras(true);
        
        // --- LOGARE ÎN CONSOLĂ ---
        console.log("--- Camere Disponibile ---");
        window.availableCameras.forEach((cam, index) => {
            console.log(`[${index}]: ${cam.label} (ID: ${cam.id})`);
        });
        console.log("---------------------------");
        // --- SFÂRȘIT LOGARE ---

        if (window.availableCameras.length > 1) {
            document.getElementById('switch-cam-button').style.display = 'flex';
        }

        if (window.availableCameras.length > 0) {
            // 1. Căutăm camera "superangurlar"
            let specificCameraIndex = window.availableCameras.findIndex(cam => 
                cam.label.toLowerCase().includes(targetCameraLabelFragment)
            );

            if (specificCameraIndex !== -1) {
                // Am găsit-o
                window.currentCameraIndex = specificCameraIndex;
                console.log(`Găsit camera țintă "${targetCameraLabelFragment}". Se pornește cu index ${window.currentCameraIndex}.`);
            } else {
                // 2. Fallback: Căutăm ultima cameră de spate
                const rearCameras = window.availableCameras
                    .map((cam, index) => ({ ...cam, index })) // Păstrăm indexul original
                    .filter(cam => /rear|back|environment/i.test(cam.label));
                
                if (rearCameras.length > 0) {
                    // Folosim ultima cameră de spate din listă
                    window.currentCameraIndex = rearCameras[rearCameras.length - 1].index;
                    console.log(`Camera țintă nu a fost găsită. Fallback la ultima cameră spate (Index: ${window.currentCameraIndex}).`);
                } else {
                    // 3. Fallback: Folosim prima cameră
                    window.currentCameraIndex = 0;
                    console.log("Nicio cameră spate detectată. Fallback la prima cameră (Index: 0).");
                }
            }
            preferredCamId = window.availableCameras[window.currentCameraIndex].id;
        } else {
            console.warn("Nicio cameră nu a fost găsită. Se folosește 'environment' (default).");
            preferredCamId = 'environment';
        }
        
    } catch (e) {
        console.error("Eroare la listarea camerelor, se folosește 'environment'.", e);
        preferredCamId = 'environment'; // Fallback
    }
    // --- SFÂRȘIT MODIFICARE ---


    // Inițializează scannerul
    qrScanner = new QrScanner(
        videoElem,
        onScanSuccessAdapter,
        {
            onDecodeError: onScanError,
            // highlightScanRegion: true, // Comentat pentru scanare full-screen
            highlightCodeOutline: true,
            returnDetailedScanResult: true,
            preferredCamera: preferredCamId
        }
    );

    qrScanner.setInversionMode('both');

    try {
        await qrScanner.start();
        await applyZoom(); // Aplică zoom la pornire
    } catch (err) {
        console.error("Eroare la pornirea QrScanner (nimiq):", err);
        showToast("Eroare la pornirea camerei. Verifică permisiunile.", true);
        stopScanner();
    }
}

function stopScanner() {
    if (qrScanner) {
        qrScanner.destroy();
        qrScanner = null;
    }
    document.getElementById('scanner-modal').classList.remove('active');
    document.getElementById('switch-cam-button').style.display = 'none'; // Ascunde butonul
    
    // Resetează starea camerelor
    window.availableCameras = [];
    window.currentCameraIndex = 0;
}

/**
 * Funcție nouă pentru a schimba camera
 */
async function switchCamera() {
    if (!qrScanner || window.availableCameras.length <= 1) {
        return;
    }

    // Calculează următorul index
    window.currentCameraIndex = (window.currentCameraIndex + 1) % window.availableCameras.length;
    
    const newCam = window.availableCameras[window.currentCameraIndex];
    console.log(`Schimbare cameră la [${window.currentCameraIndex}]: ${newCam.label}`);
    showToast(`Cameră: ${newCam.label.split('(')[0]}`); // Afișează un toast scurt

    try {
        await qrScanner.setCamera(newCam.id);
        await applyZoom(); // Reaplică zoom pe noua cameră
    } catch (err) {
        console.error("Eroare la schimbarea camerei:", err);
        showToast("Eroare la schimbarea camerei.", true);
    }
}

/**
 * Funcția originală onScanSuccess (nemodificată)
 */
function onScanSuccess(decodedText, decodedResult) {
    stopScanner();
    
    if (navigator.vibrate) {
        navigator.vibrate(100);
    }
    
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
window.switchCamera = switchCamera; // Expune noua funcție
