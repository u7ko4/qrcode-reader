A powerful QR-code (Quick Response code) and barcode scanner supports scanning from the camera or local image files and keeps the history of the last 100 scans. It supports almost all known formats, including text, link, ISBN,  coupon, and contact.

#### Privacy:
This extension does not rely on any external services to perform detection. There is no server-side interaction whatsoever.

#### Features:

  * Read multiple QR-codes on a single image
  * Right-click an image on any page to render the decoded result right below it; http urls are clickable and open in a new tab
  * Supports multiple protocols
  * Saves the history of scanned items
  * Drop local image files to the user interface
  * Uses both native method and ZBar library to maximize the detection power.

### Tampermonkey

The inline reader is also available as a userscript for users who prefer not to install the extension:

  * Install: [qrcode-reader.user.js](https://raw.githubusercontent.com/joue-quroi/qrcode-reader/master/qrcode-reader.user.js)
  * Hover over an image and click the QR button in its bottom-right corner to render the result right below it; http urls are clickable and open in a new tab
  * Uses the browser's native `BarcodeDetector` where available and [jsQR](https://github.com/cozmo/jsQR) elsewhere, so it keeps working on pages with a strict Content-Security-Policy

### YouTube Preview
[![Preview](https://img.youtube.com/vi/OaRhgRGDm1A/0.jpg)](https://www.youtube.com/watch?v=OaRhgRGDm1A)

### Links

  * Homepage: https://webextension.org/listing/qrcode-reader.html
  * Chrome: https://chromewebstore.google.com/detail/qr-code-reader/jhigigpkpbeofhknomiadocogenlpcde
  * Firefox: https://addons.mozilla.org/en-GB/firefox/addon/qr-code-reader/
  * Microsoft Edge: https://microsoftedge.microsoft.com/addons/detail/eogfpdlalmeogkfbpfcpcpbjfeajikfo
  * PWA: https://webbrowsertools.com/qrcode-reader/
