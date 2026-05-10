"use strict";
(() => {
    function sendImageError(error) {
        chrome.runtime.sendMessage({
            action: 'IMAGE_ERROR',
            error,
        });
    }
    function extractAndSendImage() {
        const match = window.location.pathname.match(/\/listing\/(\d+)/);
        const listingId = match ? match[1] : null;
        if (!listingId) {
            sendImageError('Not a listing page or listing ID was not found.');
            return;
        }
        const imgElement = document.querySelector('img[src*="etsystatic"]');
        if (imgElement === null || imgElement === void 0 ? void 0 : imgElement.src) {
            chrome.runtime.sendMessage({
                action: 'IMAGE_FOUND',
                imageUrl: imgElement.src,
                listingId,
            });
            return;
        }
        sendImageError('Image matching etsystatic was not found on the page.');
    }
    let attempts = 0;
    const intervalId = window.setInterval(() => {
        attempts += 1;
        const imgElement = document.querySelector('img[src*="etsystatic"]');
        if (imgElement === null || imgElement === void 0 ? void 0 : imgElement.src) {
            window.clearInterval(intervalId);
            extractAndSendImage();
        }
        else if (attempts >= 10) {
            window.clearInterval(intervalId);
            sendImageError('Timeout waiting for listing image.');
        }
    }, 1000);
})();
