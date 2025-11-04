// --- Logică Scaner QR ---
function startScanner(mode) {
    currentScanMode = mode;
    document.getElementById('scanner-modal').classList.add('active');
    
    // Configurație optimizată pentru viteză
    const config = { 
        fps: 20, // 20 este un echilibru bun
        // OPTIMIZARE: Am ELIMINAT 'qrbox'.
        // Fără 'qrbox', scanerul va analiza ÎNTREGUL ecran,
        // permițând scanarea codurilor mici sau aflate la distanță.
        experimentalFeatures: {
            useBarCodeDetectorIfSupported: true 
        },
        rememberLastUsedCamera: true,
        formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE
        ]
    };

    // OPTIMIZARE: Adăugăm constrângeri video pentru a cere focus continuu ȘI O REZOLUȚIE OPTIMĂ
    const videoConstraints = {
        facingMode: "environment",
        focusMode: "continuous", // Cere camerei să facă autofocus continuu
        width: { ideal: 1280 },  // Cere o lățime de 720p
        height: { ideal: 720 }   // Cere o înălțime de 720p
    };
    
    html5QrCode.start(videoConstraints, config, onScanSuccess) // Trimitem noile constrângeri
        .catch(err => {
            console.error("Eroare cameră:", err);
            // Fallback: Încearcă fără videoConstraints dacă a eșuat (unele browsere nu suportă)
            if (err.name === "OverconstrainedError" || err.name === "ConstraintNotSatisfiedError") {
                console.warn("Focus/Rezoluția 720p nu este suportată, se încearcă fără...");
                html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess)
                    .catch(fallbackErr => {
                        console.error("Eroare cameră (fallback):", fallbackErr);
                        showToast("Eroare la pornirea camerei.", true);
                        stopScanner();
                    });
            } else {
                showToast("Eroare la pornirea camerei.", true);
                stopScanner();
            }
        });
}

function stopScanner() {
    try {
        html5QrCode.stop();
    } catch (err) { /* Ignoră */ }
    document.getElementById('scanner-modal').classList.remove('active');
}

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


