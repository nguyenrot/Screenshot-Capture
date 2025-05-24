// content.js

(() => {
    // Ensure the script runs only once or can clean up previous instances
    if (window.screenshotExtensionActive) {
        // If UI is already active, perhaps toggle it or re-initialize.
        // For now, let's remove existing UI and recreate for a clean state.
        const existingOverlay = document.getElementById('qs-overlay');
        if (existingOverlay) existingOverlay.remove();
        const existingPopup = document.getElementById('qs-capture-popup');
        if (existingPopup) existingPopup.remove();
        document.removeEventListener('keydown', handleGlobalEscKey);
    }
    window.screenshotExtensionActive = true;

    // --- SVG Icons ---
    const ICONS = {
        selectArea: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M17 15h2V7c0-1.1-.9-2-2-2H9v2h8v8zM7 17V1H5v4H1v2h4v10c0 1.1.9 2 2 2h10v4h2v-4h4v-2H7z"/></svg>`,
        captureFullPage: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M20 4h-3.17L15 2H9L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM12 12c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/></svg>`,
        copy: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`,
        save: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`
    };

    let overlay = null;
    let mainButtonsContainer = null;
    let selectionBox = null;
    let startX, startY, isSelecting = false;
    let currentDevicePixelRatio = window.devicePixelRatio || 1;

    // --- Main Overlay and Initial Buttons ---
    function createOverlay() {
        if (document.getElementById('qs-overlay')) return; // Already exists

        overlay = document.createElement('div');
        overlay.id = 'qs-overlay';

        mainButtonsContainer = document.createElement('div');
        mainButtonsContainer.id = 'qs-main-buttons-container';

        const selectAreaButton = createButton("Select Area", ICONS.selectArea, handleSelectAreaClick);
        const captureFullPageButton = createButton("Capture Full Page", ICONS.captureFullPage, handleCaptureFullPageClick);

        mainButtonsContainer.appendChild(selectAreaButton);
        mainButtonsContainer.appendChild(captureFullPageButton);
        overlay.appendChild(mainButtonsContainer);
        document.body.appendChild(overlay);

        document.addEventListener('keydown', handleGlobalEscKey);
    }

    function createButton(text, svgIcon, onClick) {
        const button = document.createElement('button');
        button.className = 'qs-button';
        button.innerHTML = `${svgIcon}<span>${text}</span>`;
        button.addEventListener('click', onClick);
        return button;
    }

    function handleGlobalEscKey(event) {
        if (event.key === 'Escape') {
            cleanup();
        }
    }

    // --- Area Selection Logic ---
    function handleSelectAreaClick() {
        if (mainButtonsContainer) mainButtonsContainer.style.display = 'none';
        overlay.style.cursor = 'crosshair';
        overlay.addEventListener('mousedown', handleMouseDown);
        overlay.style.pointerEvents = 'auto';
    }

    function handleMouseDown(event) {
        if (event.target !== overlay) return;

        isSelecting = true;
        startX = event.clientX;
        startY = event.clientY;

        selectionBox = document.createElement('div');
        selectionBox.id = 'qs-selection-box';
        selectionBox.style.left = startX + 'px';
        selectionBox.style.top = startY + 'px';
        overlay.appendChild(selectionBox);

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }

    function handleMouseMove(event) {
        if (!isSelecting) return;
        const currentX = event.clientX;
        const currentY = event.clientY;

        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);
        const newX = Math.min(currentX, startX);
        const newY = Math.min(currentY, startY);

        selectionBox.style.left = newX + 'px';
        selectionBox.style.top = newY + 'px';
        selectionBox.style.width = width + 'px';
        selectionBox.style.height = height + 'px';
    }

    function handleMouseUp(event) {
        if (!isSelecting) return;
        isSelecting = false;
        overlay.style.cursor = 'default';
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        overlay.removeEventListener('mousedown', handleMouseDown);


        const x = Math.min(event.clientX, startX);
        const y = Math.min(event.clientY, startY);
        const width = Math.abs(event.clientX - startX);
        const height = Math.abs(event.clientY - startY);

        if (selectionBox) selectionBox.remove();
        selectionBox = null;

        if (width > 5 && height > 5) {
            const cropRect = {
                x: x + window.scrollX,
                y: y + window.scrollY,
                width: width,
                height: height
            };
            chrome.runtime.sendMessage({
                action: "captureVisibleTab",
                cropRect: cropRect,
                devicePixelRatio: currentDevicePixelRatio
            });
        } else {
            if (mainButtonsContainer) mainButtonsContainer.style.display = 'flex';
        }
    }

    // --- Full Page Capture Logic ---
    function handleCaptureFullPageClick() {
        if (mainButtonsContainer) mainButtonsContainer.style.display = 'none';
        chrome.runtime.sendMessage({
             action: "captureVisibleTab",
             devicePixelRatio: currentDevicePixelRatio
        });
    }

    // --- Process Captured Image (received from background.js) ---
    function processCapturedImage(dataUrl, cropRect, devicePixelRatio) {
        const img = new Image();
        img.onload = () => {
            if (cropRect && cropRect.width > 0 && cropRect.height > 0) {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const dpr = devicePixelRatio || currentDevicePixelRatio;

                canvas.width = cropRect.width * dpr;
                canvas.height = cropRect.height * dpr;

                ctx.drawImage(
                    img,
                    cropRect.x * dpr,
                    cropRect.y * dpr,
                    cropRect.width * dpr,
                    cropRect.height * dpr,
                    0, 0,
                    canvas.width, canvas.height
                );
                const croppedDataUrl = canvas.toDataURL('image/png');
                showCapturePopup(croppedDataUrl, 'selected_area.png');
            } else {
                showCapturePopup(dataUrl, 'full_page_screenshot.png');
            }
        };
        img.onerror = () => {
            console.error("Quick Screenshot: Failed to load captured image for processing.");
            alert("Error: Could not load the captured image."); // Consider replacing alert with a custom modal
            cleanup();
        }
        img.src = dataUrl;
    }

    // --- Capture Popup (Preview/Copy/Save) ---
    function showCapturePopup(imageDataUrl, filename) {
        if (overlay) overlay.style.display = 'none';

        const popup = document.createElement('div');
        popup.id = 'qs-capture-popup';

        // Create image preview element
        const previewImage = document.createElement('img');
        previewImage.id = 'qs-preview-image';
        previewImage.src = imageDataUrl;
        popup.appendChild(previewImage); // Add preview image first

        // Create a container for action buttons
        const actionsContainer = document.createElement('div');
        actionsContainer.id = 'qs-popup-actions';

        const copyButton = createButton("Copy", ICONS.copy, () => copyImageToClipboard(imageDataUrl, popup));
        const saveButton = createButton("Save", ICONS.save, () => saveImage(imageDataUrl, filename));

        actionsContainer.appendChild(copyButton);
        actionsContainer.appendChild(saveButton);
        popup.appendChild(actionsContainer); // Add buttons container

        const message = document.createElement('p');
        message.id = 'qs-popup-message';
        popup.appendChild(message); // Add message element last

        document.body.appendChild(popup);
    }

    async function copyImageToClipboard(imageDataUrl, popup) {
        const messageEl = popup.querySelector('#qs-popup-message');
        try {
            const blob = await dataURLtoBlob(imageDataUrl);
            await navigator.clipboard.write([
                new ClipboardItem({ [blob.type]: blob })
            ]);
            if (messageEl) messageEl.textContent = 'Copied to clipboard!';
            setTimeout(cleanup, 1500);
        } catch (err) {
            console.error('Quick Screenshot: Failed to copy image to clipboard:', err);
            if (messageEl) messageEl.textContent = 'Copy failed. Try saving.';
        }
    }

    function dataURLtoBlob(dataurl) {
        return fetch(dataurl).then(res => res.blob());
    }

    function saveImage(imageDataUrl, filename) {
        const a = document.createElement('a');
        a.href = imageDataUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        cleanup();
    }

    // --- Cleanup ---
    function cleanup() {
        if (selectionBox) selectionBox.remove();
        if (overlay) overlay.remove();
        const existingPopup = document.getElementById('qs-capture-popup');
        if (existingPopup) existingPopup.remove();

        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('keydown', handleGlobalEscKey);
        if(overlay) overlay.removeEventListener('mousedown', handleMouseDown);


        selectionBox = null;
        overlay = null;
        mainButtonsContainer = null;
        isSelecting = false;
        window.screenshotExtensionActive = false;
    }

    // --- Message Listener (from background.js) ---
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "showOverlay") {
            const oldOverlay = document.getElementById('qs-overlay');
            if (oldOverlay) oldOverlay.remove();
            const oldPopup = document.getElementById('qs-capture-popup');
            if (oldPopup) oldPopup.remove();

            currentDevicePixelRatio = window.devicePixelRatio || 1;
            createOverlay();
            sendResponse({ status: "Overlay shown" });
        } else if (request.action === "processCapturedImage") {
            if (request.dataUrl) {
                processCapturedImage(request.dataUrl, request.cropRect, request.devicePixelRatio);
                sendResponse({ status: "Image processing started" });
            } else {
                console.error("Quick Screenshot: No dataUrl received for processing.");
                // Consider replacing alert with a custom modal for better UX
                const userFriendlyError = document.createElement('div');
                userFriendlyError.textContent = "Error: Failed to receive captured image data.";
                userFriendlyError.style.cssText = "position:fixed; top:10px; left:10px; background:red; color:white; padding:10px; z-index: 2147483647;";
                document.body.appendChild(userFriendlyError);
                setTimeout(() => userFriendlyError.remove(), 3000);
                cleanup();
                sendResponse({ error: "No dataUrl" });
            }
        }
        return true;
    });

})();
