# Quick Screenshot Capture - Chrome Extension

A simple yet powerful Chrome extension for capturing screenshots of web pages. Capture the full visible page or select a specific area with ease. Preview your capture, then copy it to your clipboard or save it as a PNG file.

## Features

* **Two Capture Modes:**
    * **Select Area:** Click and drag to select a specific portion of the page.
    * **Capture Full Page:** Instantly captures the entire visible area of the current tab.
* **Interactive Overlay:** A semi-transparent overlay appears when activated, providing clear options.
* **Draggable Preview Modal:** After capturing, a modal window shows a preview of the screenshot. This modal can be freely moved around the screen.
* **Copy to Clipboard:** Instantly copy the captured image to your clipboard.
* **Save as PNG:** Download the screenshot as a PNG file.
* **Keyboard Shortcut:** Activate the extension quickly using **Alt + S**.
* **Modern UI:** Clean and minimal design with SVG icons.
* **Client-Side Processing:** All screenshot processing is done within your browser.
* **Close with Esc or Click Outside:** Easily dismiss the extension's UI by pressing the `Esc` key or clicking outside the preview modal.

## How to Use

1.  **Activation:**
    * Click the **Quick Screenshot Capture extension icon** in your Chrome toolbar.
    * OR, press the keyboard shortcut **Alt + S**.
2.  **Choose Capture Mode:**
    * Once activated, a semi-transparent overlay will cover the page with two buttons:
        * **"Select Area":** Click this to enable area selection mode. Your cursor will change to a crosshair. Click and drag to draw a rectangle over the desired area.
        * **"Capture Full Page":** Click this to immediately capture the entire visible content of the page.
3.  **Preview and Actions:**
    * After the screenshot is taken (either selected area or full page), a preview modal will appear.
    * This modal displays the captured image and provides two buttons:
        * **"Copy":** Copies the image to your clipboard.
        * **"Save":** Downloads the image as a `selected_area.png` or `full_page_screenshot.png` file.
    * You can drag this preview modal to any position on your screen.
4.  **Closing the Extension:**
    * Press the **`Esc`** key at any point (overlay or preview modal).
    * If the preview modal is open, click anywhere outside of it.
    * Clicking "Copy" or "Save" will also automatically close the extension after a brief confirmation message (for "Copy").

## Installation (for Development/Testing)

1.  **Download the Source Code:**
    * Clone this repository or download the source files as a ZIP and extract them to a local folder.
2.  **Open Chrome Extensions Page:**
    * Open Google Chrome.
    * Navigate to `chrome://extensions`.
3.  **Enable Developer Mode:**
    * In the top right corner of the Extensions page, toggle the "Developer mode" switch to the **on** position.
4.  **Load Unpacked Extension:**
    * Click the "Load unpacked" button that appears.
    * In the file dialog, navigate to the directory where you saved/extracted the extension's source code (the folder containing `manifest.json`).
    * Select this folder.
5.  The **Quick Screenshot Capture** extension should now be installed and visible in your list of extensions and on your Chrome toolbar.

## File Structure


```
quick-screenshot-capture/
├── manifest.json        # Configures the extension, permissions, and commands
├── background.js        # Handles extension activation and capture requests
├── content.js           # Injects UI (overlay, buttons, selection, preview modal) into web pages
├── style.css            # Styles all UI elements injected by content.js
└── icons/
├── icon16.png       # Extension icon (16x16)
├── icon48.png       # Extension icon (48x48)
└── icon128.png      # Extension icon (128x128)
```

## Permissions Used

* `activeTab`: To interact with the currently active tab when the user invokes the extension. This is necessary for capturing the visible tab content and injecting scripts.
* `scripting`: To inject `content.js` and `style.css` into the web page to display the extension's UI.
* `clipboardWrite`: To allow the "Copy" functionality to write the captured image to the user's clipboard.
* `host_permissions: ["<all_urls>"]`: To allow the extension to function on any website, as users expect a screenshot tool to be universally available. The extension only activates on a page when explicitly triggered by the user.

---

Feel free to modify or add any other details you think are important!
