// content.js

(() => {
    // Ensure the script runs only once or can clean up previous instances
    if (window.screenshotExtensionActive) {
        const existingOverlay = document.getElementById('qs-overlay');
        if (existingOverlay) existingOverlay.remove();
        const existingPopup = document.getElementById('qs-capture-popup');
        if (existingPopup) existingPopup.remove();
        document.removeEventListener('keydown', handleGlobalEscKey);
        document.removeEventListener('click', handleClickOutsidePopupGlobal);
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
    let activePopup = null;

    // --- Main Overlay and Initial Buttons ---
    function handleGlobalEscKey(e) {
        if (e.key === 'Escape') {
            // Remove overlay and popup if present
            const existingOverlay = document.getElementById('qs-overlay');
            if (existingOverlay) existingOverlay.remove();
            const existingPopup = document.getElementById('qs-capture-popup');
            if (existingPopup) existingPopup.remove();
            // Remove event listeners
            document.removeEventListener('keydown', handleGlobalEscKey);
            document.removeEventListener('click', handleClickOutsidePopupGlobal);
            window.screenshotExtensionActive = false;
        }
    }

    function createOverlay() {
        if (document.getElementById('qs-overlay')) return;

        overlay = document.createElement('div');
        overlay.id = 'qs-overlay';
        overlay.style.display = 'flex';

        mainButtonsContainer = document.createElement('div');
        mainButtonsContainer.id = 'qs-main-buttons-container';

        const selectAreaButton = createButton("Select Area", ICONS.selectArea, handleSelectAreaClick);
        const captureFullPageButton = createButton("Capture Full Page", ICONS.captureFullPage, handleCaptureFullPageClick);
        // Add Record Screen button
        const recordScreenButton = createButton("Record Screen", ICONS.recordScreen || '<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="#e74c3c"/></svg>', handleRecordScreenClick);

        mainButtonsContainer.appendChild(selectAreaButton);
        mainButtonsContainer.appendChild(captureFullPageButton);
        mainButtonsContainer.appendChild(recordScreenButton);
        overlay.appendChild(mainButtonsContainer);
        document.body.appendChild(overlay);

        // Add ESC key listener when overlay is shown
        document.addEventListener('keydown', handleGlobalEscKey);
    }

    function createButton(text, svgIcon, onClick) {
        const button = document.createElement('button');
        button.className = 'qs-button';
        button.innerHTML = `${svgIcon}<span>${text}</span>`;
        button.addEventListener('click', onClick);
        return button;
    }

    // --- Draggable Logic ---
    function makeDraggable(popupElement) {
        let offsetX, offsetY, isDragging = false;

        popupElement.addEventListener('mousedown', (e) => {
            if (e.target.closest('.qs-button')) {
                return;
            }

            isDragging = true;
            const rect = popupElement.getBoundingClientRect();
            if (getComputedStyle(popupElement).transform !== 'none') {
                popupElement.style.transform = 'none';
                popupElement.style.left = `${rect.left}px`;
                popupElement.style.top = `${rect.top}px`;
            }

            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;

            popupElement.style.cursor = 'grabbing';
            popupElement.style.userSelect = 'none';

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp, { once: true });
        });

        function onMouseMove(e) {
            if (!isDragging) return;
            popupElement.style.left = `${e.clientX - offsetX}px`;
            popupElement.style.top = `${e.clientY - offsetY}px`;
        }

        function onMouseUp() {
            isDragging = false;
            popupElement.style.cursor = 'grab';
            popupElement.style.userSelect = 'auto';
            document.removeEventListener('mousemove', onMouseMove);
        }
    }

    // --- Area Selection Logic ---
    function handleSelectAreaClick() {
        if (mainButtonsContainer) mainButtonsContainer.style.display = 'none';
        if (overlay) {
            overlay.style.cursor = 'crosshair';
            overlay.addEventListener('mousedown', handleMouseDown);
            overlay.style.pointerEvents = 'auto';
        }
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
        if (overlay) overlay.appendChild(selectionBox);

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

        if (selectionBox) {
            selectionBox.style.left = newX + 'px';
            selectionBox.style.top = newY + 'px';
            selectionBox.style.width = width + 'px';
            selectionBox.style.height = height + 'px';
        }
    }

    function handleMouseUp(event) {
        if (!isSelecting) return;
        isSelecting = false;
        if (overlay) overlay.style.cursor = 'default';
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        if (overlay) overlay.removeEventListener('mousedown', handleMouseDown);

        const x = Math.min(event.clientX, startX);
        const y = Math.min(event.clientY, startY);
        const width = Math.abs(event.clientX - startX);
        const height = Math.abs(event.clientY - startY);

        // Remove selection box immediately as it's part of the overlay visual
        if (selectionBox) {
            selectionBox.remove();
            selectionBox = null;
        }

        if (width > 5 && height > 5) {
            const cropRect = {
                x: x + window.scrollX,
                y: y + window.scrollY,
                width: width,
                height: height
            };

            // Hide the main overlay
            if (overlay) {
                overlay.style.display = 'none';
            }

            // Add a small delay to ensure DOM update (overlay hidden) before capturing
            setTimeout(() => {
                chrome.runtime.sendMessage({
                    action: "captureVisibleTab",
                    cropRect: cropRect,
                    devicePixelRatio: currentDevicePixelRatio
                });
            }, 100); // 100ms delay, can be adjusted

        } else {
            // If selection was too small, and overlay was hidden, we might need to restore it or cleanup
            if (mainButtonsContainer && overlay && overlay.style.display !== 'none') {
                mainButtonsContainer.style.display = 'flex'; // Restore buttons if overlay still visible
            } else {
                // If overlay was hidden or selection was too small, cleanup to reset state
                cleanup();
            }
        }
    }

    // --- Full Page Capture Logic ---
    function handleCaptureFullPageClick() {
        if (overlay) {
            overlay.style.display = 'none';
        }

        // Add a small delay for full page capture as well, for consistency and safety
        setTimeout(() => {
            chrome.runtime.sendMessage({
                action: "captureVisibleTab",
                devicePixelRatio: currentDevicePixelRatio
            });
        }, 100); // 100ms delay
    }

    // --- Screen Recording Logic ---
    let mediaRecorder = null;
    let recordedChunks = [];
    let isRecording = false;

    async function handleRecordScreenClick() {
        if (isRecording) {
            // Stop recording
            mediaRecorder.stop();
            isRecording = false;
            return;
        }
        try {
            // Hide overlay and main buttons while recording
            if (mainButtonsContainer) mainButtonsContainer.style.display = 'none';
            if (overlay) overlay.style.display = 'none';
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            recordedChunks = [];
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) recordedChunks.push(e.data);
            };
            mediaRecorder.onstop = () => {
                const blob = new Blob(recordedChunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                // Auto download
                const a = document.createElement('a');
                a.href = url;
                a.download = 'screen-recording.webm';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                }, 100);
                // Auto close extension UI after download
                cleanup();
            };
            mediaRecorder.start();
            isRecording = true;
        } catch (err) {
            alert('Screen recording failed: ' + err.message);
        }
    }

    // --- Video Preview Popup ---
    function showVideoPreviewPopup(videoUrl, videoBlob) {
        if (activePopup) activePopup.remove();
        activePopup = document.createElement('div');
        activePopup.id = 'qs-capture-popup';
        activePopup.style.zIndex = 2147483647;
        activePopup.style.position = 'fixed';
        activePopup.style.top = '50%';
        activePopup.style.left = '50%';
        activePopup.style.transform = 'translate(-50%, -50%)';
        activePopup.style.background = '#fff';
        activePopup.style.padding = '20px';
        activePopup.style.borderRadius = '8px';
        activePopup.style.boxShadow = '0 2px 16px rgba(0,0,0,0.2)';
        activePopup.style.display = 'flex';
        activePopup.style.flexDirection = 'column';
        activePopup.style.alignItems = 'center';
        activePopup.style.width = '60vw';
        activePopup.style.maxWidth = '900px';
        activePopup.style.height = 'auto';

        const video = document.createElement('video');
        video.src = videoUrl;
        video.controls = true;
        video.style.width = '100%';
        video.style.height = 'auto';
        video.style.maxHeight = '70vh';
        video.style.marginBottom = '16px';
        activePopup.appendChild(video);

        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '12px';

        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'qs-button';
        downloadBtn.textContent = 'Download';
        downloadBtn.onclick = () => {
            const a = document.createElement('a');
            a.href = videoUrl;
            a.download = 'screen-recording.webm';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(videoUrl);
            }, 100);
            cleanup();
        };
        actions.appendChild(downloadBtn);

        activePopup.appendChild(actions);
        document.body.appendChild(activePopup);
        setTimeout(() => {
            document.addEventListener('click', handleClickOutsidePopupGlobal, { capture: true });
        }, 0);
    }

    // --- Process Captured Image (received from background.js) ---
    function processCapturedImage(dataUrl, cropRect, devicePixelRatio) {
        const img = new Image();
        img.onload = () => {
            let finalDataUrl = dataUrl;
            let originalWidth, originalHeight;

            if (cropRect && cropRect.width > 0 && cropRect.height > 0) {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const dpr = devicePixelRatio || currentDevicePixelRatio;

                // These are the real pixel dimensions of the final cropped image
                originalWidth = cropRect.width * dpr;
                originalHeight = cropRect.height * dpr;

                canvas.width = originalWidth;
                canvas.height = originalHeight;

                ctx.drawImage(
                    img,
                    cropRect.x * dpr,
                    cropRect.y * dpr,
                    cropRect.width * dpr,
                    cropRect.height * dpr,
                    0, 0,
                    canvas.width, canvas.height
                );
                finalDataUrl = canvas.toDataURL('image/png');
                showCapturePopup(finalDataUrl, 'selected_area.png', canvas.width, canvas.height);
            } else {
                // For full page, the image is already at the correct size
                originalWidth = img.width;
                originalHeight = img.height;
                showCapturePopup(finalDataUrl, 'full_page_screenshot.png', originalWidth, originalHeight);
            }
        };
        img.onerror = () => {
            console.error("Quick Screenshot: Failed to load captured image for processing.");
            const userFriendlyError = document.createElement('div');
            userFriendlyError.textContent = "Error: Failed to load captured image.";
            userFriendlyError.style.cssText = "position:fixed; top:10px; left:10px; background:red; color:white; padding:10px; z-index: 2147483647;";
            document.body.appendChild(userFriendlyError);
            setTimeout(() => userFriendlyError.remove(), 3000);
            cleanup();
        }
        img.src = dataUrl;
    }

    // --- Capture Popup (Preview/Copy/Save) ---
    function showCapturePopup(imageDataUrl, filename, originalWidth, originalHeight) {
        if (overlay && overlay.style.display !== 'none') {
            overlay.style.display = 'none';
        }

        if(activePopup) activePopup.remove();

        activePopup = document.createElement('div');
        activePopup.id = 'qs-capture-popup';
        // Center popup in the current visible viewport (not the page)
        activePopup.style.position = 'fixed';
        activePopup.style.top = '50%';
        activePopup.style.left = '50%';
        activePopup.style.transform = 'translate(-50%, -50%)';
        activePopup.style.zIndex = '2147483647';
        activePopup.style.boxShadow = '0 2px 16px rgba(0,0,0,0.25)';
        activePopup.style.background = '#fff';
        activePopup.style.borderRadius = '8px';
        activePopup.style.padding = '20px 24px 16px 24px';
        activePopup.style.display = 'flex';
        activePopup.style.flexDirection = 'column';
        activePopup.style.alignItems = 'center';
        activePopup.style.userSelect = 'none';
        activePopup.style.cursor = 'default';
        // Remove any drag event listeners if present
        activePopup.ondragstart = () => false;

        const previewImage = document.createElement('img');
        previewImage.id = 'qs-preview-image';
        previewImage.src = imageDataUrl;
        previewImage.ondragstart = () => false;

        // --- SIZING LOGIC ---
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (originalWidth > viewportWidth * 0.8 || originalHeight > viewportHeight * 0.8) {
            // If image is large, constrain it to 70% of the viewport
            previewImage.style.maxWidth = '70vw';
            previewImage.style.maxHeight = '70vh';
        } else {
            // If image is smaller, show it at its actual size
            previewImage.style.width = `${originalWidth}px`;
            previewImage.style.height = `${originalHeight}px`;
            previewImage.style.maxWidth = 'none'; // Override CSS to prevent unwanted scaling
            previewImage.style.maxHeight = 'none'; // Override CSS to prevent unwanted scaling
        }
        activePopup.appendChild(previewImage);

        // --- DRAWING TOOLBAR & CANVAS ---
        // Toolbar container
        const toolbar = document.createElement('div');
        toolbar.style.display = 'flex';
        toolbar.style.gap = '10px';
        toolbar.style.margin = '10px 0';
        toolbar.style.alignItems = 'center';

        // Tool selection styled as action buttons with SVG icons
        const tools = [
            { name: 'Free', icon: '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M3 17c2-2 5-6 7-6s3 2 5 2 2-2 2-2" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>' },
            { name: 'Rectangle', icon: '<svg width="20" height="20" viewBox="0 0 20 20"><rect x="3" y="3" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"/></svg>' },
            { name: 'Circle', icon: '<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="2" fill="none"/></svg>' },
            { name: 'Arrow', icon: '<svg width="20" height="20" viewBox="0 0 20 20"><line x1="4" y1="16" x2="16" y2="4" stroke="currentColor" stroke-width="2"/><polyline points="10,4 16,4 16,10" fill="none" stroke="currentColor" stroke-width="2"/></svg>' }
        ];
        let currentTool = 'Free';
        const toolButtonGroup = document.createElement('div');
        toolButtonGroup.style.display = 'flex';
        toolButtonGroup.style.gap = '6px';
        tools.forEach(tool => {
            const btn = document.createElement('button');
            btn.innerHTML = tool.icon;
            btn.title = tool.name;
            btn.className = 'qs-button';
            btn.style.display = 'flex';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.width = '32px';
            btn.style.height = '32px';
            btn.style.minWidth = '32px';
            btn.style.minHeight = '32px';
            btn.style.maxWidth = '32px';
            btn.style.maxHeight = '32px';
            btn.style.padding = '0';
            btn.style.fontSize = '18px';
            btn.style.background = '';
            btn.style.border = '';
            btn.style.margin = '0';
            btn.onclick = () => {
                currentTool = tool.name;
                Array.from(toolButtonGroup.children).forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            };
            if (tool.name === 'Free') btn.classList.add('active');
            toolButtonGroup.appendChild(btn);
        });
        toolbar.appendChild(toolButtonGroup);

        // Undo/Redo buttons
        const undoBtn = document.createElement('button');
        undoBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M9 4H5V0L0 5l5 5V6h4a5 5 0 1 1 0 10h-1v2h1a7 7 0 1 0 0-14z" fill="currentColor"/></svg>';
        undoBtn.title = 'Undo';
        undoBtn.className = 'qs-button';
        undoBtn.style.width = '28px';
        undoBtn.style.height = '28px';
        undoBtn.style.minWidth = '28px';
        undoBtn.style.minHeight = '28px';
        undoBtn.style.maxWidth = '28px';
        undoBtn.style.maxHeight = '28px';
        undoBtn.style.padding = '0';
        undoBtn.style.display = 'flex';
        undoBtn.style.alignItems = 'center';
        undoBtn.style.justifyContent = 'center';

        const redoBtn = document.createElement('button');
        redoBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M11 4h4V0l5 5-5 5V6h-4a5 5 0 1 0 0 10h1v2h-1a7 7 0 1 1 0-14z" fill="currentColor"/></svg>';
        redoBtn.title = 'Redo';
        redoBtn.className = 'qs-button';
        redoBtn.style.width = '28px';
        redoBtn.style.height = '28px';
        redoBtn.style.minWidth = '28px';
        redoBtn.style.minHeight = '28px';
        redoBtn.style.maxWidth = '28px';
        redoBtn.style.maxHeight = '28px';
        redoBtn.style.padding = '0';
        redoBtn.style.display = 'flex';
        redoBtn.style.alignItems = 'center';
        redoBtn.style.justifyContent = 'center';

        // Move Undo/Redo buttons after tool buttons
        toolbar.appendChild(undoBtn);
        toolbar.appendChild(redoBtn);

        // Color picker
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = '#ff0000';
        colorInput.title = 'Stroke Color';
        toolbar.appendChild(colorInput);

        // Thickness selector
        const thicknessInput = document.createElement('input');
        thicknessInput.type = 'range';
        thicknessInput.min = 1;
        thicknessInput.max = 15;
        thicknessInput.value = 3;
        thicknessInput.title = 'Stroke Thickness';
        toolbar.appendChild(thicknessInput);

        activePopup.appendChild(toolbar);

        // Drawing canvas
        const drawCanvas = document.createElement('canvas');
        drawCanvas.width = originalWidth;
        drawCanvas.height = originalHeight;
        drawCanvas.style.position = 'absolute';
        drawCanvas.style.left = previewImage.style.left || '0';
        drawCanvas.style.top = previewImage.style.top || '0';
        drawCanvas.style.pointerEvents = 'auto';
        drawCanvas.style.zIndex = '2147483648';
        drawCanvas.style.borderRadius = '8px';
        drawCanvas.style.maxWidth = previewImage.style.maxWidth || '70vw';
        drawCanvas.style.maxHeight = previewImage.style.maxHeight || '70vh';
        drawCanvas.style.width = previewImage.style.width || '';
        drawCanvas.style.height = previewImage.style.height || '';
        drawCanvas.style.background = 'transparent';
        drawCanvas.style.cursor = 'crosshair';
        drawCanvas.style.userSelect = 'none';
        drawCanvas.style.display = 'block';
        drawCanvas.width = originalWidth;
        drawCanvas.height = originalHeight;
        // Do NOT set activePopup.style.position = 'relative' here, keep it fixed for viewport centering
        previewImage.style.position = 'relative';
        activePopup.appendChild(drawCanvas);

        // Drawing logic
        let drawing = false, startX = 0, startY = 0, lastX = 0, lastY = 0;
        let tempCanvas = document.createElement('canvas');
        tempCanvas.width = drawCanvas.width;
        tempCanvas.height = drawCanvas.height;
        let tempCtx = tempCanvas.getContext('2d');
        const ctx = drawCanvas.getContext('2d');
        let color = colorInput.value;
        let thickness = parseInt(thicknessInput.value);

        // --- Undo/Redo logic ---
        let undoStack = [];
        let redoStack = [];
        function pushUndo() {
            // Save both tempCanvas and drawCanvas as a merged image
            const merged = document.createElement('canvas');
            merged.width = drawCanvas.width;
            merged.height = drawCanvas.height;
            const mctx = merged.getContext('2d');
            mctx.drawImage(tempCanvas, 0, 0);
            mctx.drawImage(drawCanvas, 0, 0);
            const dataUrl = merged.toDataURL();
            // Only push if not the same as the last state
            if (undoStack.length === 0 || undoStack[undoStack.length - 1] !== dataUrl) {
                undoStack.push(dataUrl);
                if (undoStack.length > 50) undoStack.shift();
            }
            redoStack = [];
        }
        function restoreFromDataUrl(dataUrl) {
            const img = new Image();
            img.onload = function() {
                tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
                tempCtx.drawImage(img, 0, 0);
                ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
                ctx.drawImage(tempCanvas, 0, 0);
            };
            img.src = dataUrl;
        }
        function doUndo() {
            if (undoStack.length <= 1) return;
            redoStack.push(undoStack.pop());
            restoreFromDataUrl(undoStack[undoStack.length - 1]);
        }
        function doRedo() {
            if (redoStack.length === 0) return;
            const dataUrl = redoStack.pop();
            undoStack.push(dataUrl);
            restoreFromDataUrl(dataUrl);
        }
        undoBtn.onclick = doUndo;
        redoBtn.onclick = doRedo;

        // Save initial blank state for undo
        function saveInitialBlankState() {
            const blank = document.createElement('canvas');
            blank.width = drawCanvas.width;
            blank.height = drawCanvas.height;
            undoStack = [blank.toDataURL()];
            redoStack = [];
        }
        saveInitialBlankState();

        colorInput.oninput = () => color = colorInput.value;
        thicknessInput.oninput = () => thickness = parseInt(thicknessInput.value);

        function drawArrow(ctx, x1, y1, x2, y2, color, thickness) {
            const headlen = 15 + thickness * 1.5;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const angle = Math.atan2(dy, dx);
            ctx.strokeStyle = color;
            ctx.lineWidth = thickness;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x2, y2);
            ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
            ctx.lineTo(x2, y2);
            ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
            ctx.stroke();
        }

        function redrawTemp() {
            ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
            ctx.drawImage(tempCanvas, 0, 0);
        }

        drawCanvas.onmousedown = e => {
            drawing = true;
            const rect = drawCanvas.getBoundingClientRect();
            startX = lastX = (e.clientX - rect.left) * (drawCanvas.width / rect.width);
            startY = lastY = (e.clientY - rect.top) * (drawCanvas.height / rect.height);
            if (currentTool === 'Free') {
                ctx.strokeStyle = color;
                ctx.lineWidth = thickness;
                ctx.beginPath();
                ctx.moveTo(startX, startY);
            }
        };
        drawCanvas.onmousemove = e => {
            if (!drawing) return;
            const rect = drawCanvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) * (drawCanvas.width / rect.width);
            const y = (e.clientY - rect.top) * (drawCanvas.height / rect.height);
            redrawTemp();
            if (currentTool === 'Free') {
                ctx.lineTo(x, y);
                ctx.strokeStyle = color;
                ctx.lineWidth = thickness;
                ctx.stroke();
                lastX = x; lastY = y;
            } else if (currentTool === 'Rectangle') {
                ctx.strokeStyle = color;
                ctx.lineWidth = thickness;
                ctx.strokeRect(startX, startY, x - startX, y - startY);
            } else if (currentTool === 'Circle') {
                ctx.strokeStyle = color;
                ctx.lineWidth = thickness;
                ctx.beginPath();
                const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
                ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
                ctx.stroke();
            } else if (currentTool === 'Arrow') {
                drawArrow(ctx, startX, startY, x, y, color, thickness);
            }
        };
        drawCanvas.onmouseup = e => {
            if (!drawing) return;
            drawing = false;
            const rect = drawCanvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) * (drawCanvas.width / rect.width);
            const y = (e.clientY - rect.top) * (drawCanvas.height / rect.height);
            if (currentTool === 'Free') {
                ctx.lineTo(x, y);
                ctx.stroke();
                ctx.closePath();
                tempCtx.drawImage(drawCanvas, 0, 0);
            } else if (currentTool === 'Rectangle') {
                tempCtx.strokeStyle = color;
                tempCtx.lineWidth = thickness;
                tempCtx.strokeRect(startX, startY, x - startX, y - startY);
                redrawTemp();
            } else if (currentTool === 'Circle') {
                tempCtx.strokeStyle = color;
                tempCtx.lineWidth = thickness;
                tempCtx.beginPath();
                const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
                tempCtx.arc(startX, startY, radius, 0, 2 * Math.PI);
                tempCtx.stroke();
                redrawTemp();
            } else if (currentTool === 'Arrow') {
                drawArrow(tempCtx, startX, startY, x, y, color, thickness);
                redrawTemp();
            }
            // After drawing, push to undo stack
            pushUndo();
        };
        drawCanvas.onmouseleave = () => { drawing = false; };

        // Touch support
        drawCanvas.ontouchstart = e => {
            if (e.touches.length !== 1) return;
            const rect = drawCanvas.getBoundingClientRect();
            const touch = e.touches[0];
            startX = lastX = (touch.clientX - rect.left) * (drawCanvas.width / rect.width);
            startY = lastY = (touch.clientY - rect.top) * (drawCanvas.height / rect.height);
            drawing = true;
            if (currentTool === 'Free') {
                ctx.strokeStyle = color;
                ctx.lineWidth = thickness;
                ctx.beginPath();
                ctx.moveTo(startX, startY);
            }
        };
        drawCanvas.ontouchmove = e => {
            if (!drawing || e.touches.length !== 1) return;
            const rect = drawCanvas.getBoundingClientRect();
            const touch = e.touches[0];
            const x = (touch.clientX - rect.left) * (drawCanvas.width / rect.width);
            const y = (touch.clientY - rect.top) * (drawCanvas.height / rect.height);
            redrawTemp();
            if (currentTool === 'Free') {
                ctx.lineTo(x, y);
                ctx.strokeStyle = color;
                ctx.lineWidth = thickness;
                ctx.stroke();
                lastX = x; lastY = y;
            } else if (currentTool === 'Rectangle') {
                ctx.strokeStyle = color;
                ctx.lineWidth = thickness;
                ctx.strokeRect(startX, startY, x - startX, y - startY);
            } else if (currentTool === 'Circle') {
                ctx.strokeStyle = color;
                ctx.lineWidth = thickness;
                ctx.beginPath();
                const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
                ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
                ctx.stroke();
            } else if (currentTool === 'Arrow') {
                drawArrow(ctx, startX, startY, x, y, color, thickness);
            }
            e.preventDefault();
        };
        drawCanvas.ontouchend = e => {
            if (!drawing) return;
            drawing = false;
            if (currentTool === 'Free') {
                ctx.closePath();
                tempCtx.drawImage(drawCanvas, 0, 0);
            } else if (currentTool === 'Rectangle' || currentTool === 'Circle' || currentTool === 'Arrow') {
                tempCtx.drawImage(drawCanvas, 0, 0);
            }
            // After drawing, push to undo stack
            pushUndo();
        };
        drawCanvas.ontouchcancel = () => { drawing = false; };

        // --- DIMENSIONS DISPLAY ---
        const dimensionsDisplay = document.createElement('div');
        dimensionsDisplay.id = 'qs-dimensions-display';
        dimensionsDisplay.textContent = `${originalWidth} x ${originalHeight}px`;
        activePopup.appendChild(dimensionsDisplay);

        const actionsContainer = document.createElement('div');
        actionsContainer.id = 'qs-popup-actions';

        // Helper to merge preview image and drawing canvas
        function getMergedImageDataUrl() {
            const merged = document.createElement('canvas');
            merged.width = originalWidth;
            merged.height = originalHeight;
            const mctx = merged.getContext('2d');
            // Draw the base image
            mctx.drawImage(previewImage, 0, 0, originalWidth, originalHeight);
            // Draw the drawing canvas
            mctx.drawImage(drawCanvas, 0, 0);
            return merged.toDataURL('image/png');
        }

        const copyButton = createButton("Copy", ICONS.copy, () => {
            const mergedDataUrl = getMergedImageDataUrl();
            copyImageToClipboard(mergedDataUrl, activePopup);
        });
        const saveButton = createButton("Save", ICONS.save, () => {
            const mergedDataUrl = getMergedImageDataUrl();
            saveImage(mergedDataUrl, filename);
        });

        actionsContainer.appendChild(copyButton);
        actionsContainer.appendChild(saveButton);
        activePopup.appendChild(actionsContainer);

        const message = document.createElement('p');
        message.id = 'qs-popup-message';
        activePopup.appendChild(message);

        document.body.appendChild(activePopup);

        setTimeout(() => {
            document.addEventListener('click', handleClickOutsidePopupGlobal, { capture: true });
        }, 0);
    }

    function handleClickOutsidePopupGlobal(event) {
        if (activePopup && !activePopup.contains(event.target)) {
            cleanup();
        }
    }

    async function copyImageToClipboard(imageDataUrl, popupElement) {
        const messageEl = popupElement.querySelector('#qs-popup-message');
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
        if (activePopup) activePopup.remove();

        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);

        document.removeEventListener('keydown', handleGlobalEscKey);
        document.removeEventListener('click', handleClickOutsidePopupGlobal, { capture: true });

        selectionBox = null;
        overlay = null;
        mainButtonsContainer = null;
        activePopup = null;
        isSelecting = false;
        window.screenshotExtensionActive = false;
    }

    // --- Message Listener (from background.js) ---
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "showOverlay") {
            cleanup();
            window.screenshotExtensionActive = true;

            currentDevicePixelRatio = window.devicePixelRatio || 1;
            createOverlay();
            sendResponse({ status: "Overlay shown" });
        } else if (request.action === "processCapturedImage") {
            if (request.dataUrl) {
                processCapturedImage(request.dataUrl, request.cropRect, request.devicePixelRatio);
                sendResponse({ status: "Image processing started" });
            } else {
                console.error("Quick Screenshot: No dataUrl received for processing.");
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

