// --- Logică Scaner QR ---
function startScanner(mode) {
    currentScanMode = mode;
    document.getElementById('scanner-modal').classList.add('active');
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess)
        .catch(err => {
            console.error("Eroare cameră:", err);
            showToast("Eroare la pornirea camerei.", true);
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
