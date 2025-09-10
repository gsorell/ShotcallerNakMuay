function isFacebookApp(): boolean {
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
  return ua.indexOf("FBAN") > -1 || ua.indexOf("FBAV") > -1;
}

function isInstagramApp(): boolean {
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
  return ua.indexOf("Instagram") > -1;
}

/**
 * Detects if the app is running inside a Facebook or Instagram in-app browser.
 * If so, it prepends a warning banner to the body of the page.
 */
export function displayInAppBrowserWarning() {
  if (isFacebookApp() || isInstagramApp()) {
    const banner = document.createElement('div');
    banner.innerHTML = 'For full functionality, please <strong>open this page in your phone\'s main browser</strong> (e.g., Chrome or Safari).';
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      background-color: #ffc107;
      color: #212529;
      text-align: center;
      padding: 12px;
      font-family: sans-serif;
      font-size: 15px;
      z-index: 10000;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      line-height: 1.4;
    `;
    document.body.prepend(banner);

    // Add padding to the body to prevent the banner from overlapping your content
    document.body.style.paddingTop = `${banner.offsetHeight}px`;
  }
}