// background.js

// Function to activate the extension (inject scripts and show UI)
async function activateExtension(tab) {
    if (!tab || !tab.id) {
        console.error("Quick Screenshot: Invalid tab object.", tab);
        // Try to get the active tab if not provided
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs.length > 0) {
            tab = tabs[0];
        } else {
            console.error("Quick Screenshot: Could not determine active tab.");
            return;
        }
    }

    // Prevent injection on chrome:// pages or other restricted URLs
    if (tab.url && (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("https://chrome.google.com/webstore"))) {
        console.warn("Quick Screenshot: Cannot inject script on this page:", tab.url);
        // Optionally, notify the user (e.g., by briefly changing the extension icon or showing a system notification)
        // For now, just log and exit.
        return;
    }

    try {
        // Inject CSS file
        await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ["style.css"]
        });

        // Inject content script
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"]
        });

        // Send a message to the content script to show the overlay
        chrome.tabs.sendMessage(tab.id, { action: "showOverlay" });

    } catch (err) {
        console.error("Quick Screenshot: Failed to inject scripts or send message:", err, "Tab URL:", tab.url);
        // This can happen on pages where content scripts are not allowed,
        // like the Chrome Web Store, browser's internal pages, or if the tab was closed.
    }
}

// Listener for the extension icon click
chrome.action.onClicked.addListener((tab) => {
    activateExtension(tab);
});

// Listener for the keyboard shortcut command
chrome.commands.onCommand.addListener((command, tab) => {
    if (command === "activate_screenshot_mode") {
        activateExtension(tab);
    }
});

// Listener for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "captureVisibleTab") {
        // Ensure sender.tab is valid, especially if message comes from a frame
        const tabToCapture = sender.tab;
        if (!tabToCapture || !tabToCapture.id) {
            console.error("Quick Screenshot: Invalid tab for captureVisibleTab request.");
            sendResponse({ error: "Invalid tab" });
            return true; // Indicates asynchronous response
        }

        chrome.tabs.captureVisibleTab(
            tabToCapture.windowId, // Use windowId from sender.tab for accuracy
            { format: "png" },
            (dataUrl) => {
                if (chrome.runtime.lastError) {
                    console.error("Quick Screenshot: Error capturing tab:", chrome.runtime.lastError.message);
                    sendResponse({ error: chrome.runtime.lastError.message });
                    return;
                }
                if (dataUrl) {
                    // Send the captured image data URL and crop rectangle (if any) back to the content script
                    chrome.tabs.sendMessage(tabToCapture.id, {
                        action: "processCapturedImage",
                        dataUrl: dataUrl,
                        cropRect: request.cropRect, // Pass along cropRect if it was part of the request
                        devicePixelRatio: request.devicePixelRatio // Pass along devicePixelRatio
                    });
                    sendResponse({ success: true }); // Acknowledge message processed
                } else {
                    sendResponse({ error: "Failed to capture tab, no data URL returned." });
                }
            }
        );
        return true; // Indicates that the response will be sent asynchronously
    }
    return false; // For synchronous messages, or if this listener doesn't handle the message
});
