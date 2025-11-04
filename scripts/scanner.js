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

    // AM ELIMINAT 'videoConstraints' pentru a rezolva eroarea de pornire.
    // Folosim cea mai simplă metodă de start, care este cea mai compatibilă.
    html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess) // Apel simplificat
        .catch(err => {
            // Acum, orice eroare este o eroare generală (probabil permisiuni)
            console.error("Eroare la pornirea camerei:", err);
            showToast("Eroare la pornirea camerei. Verifică permisiunile.", true); // Mesaj de eroare mai clar
            stopScanner();
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



