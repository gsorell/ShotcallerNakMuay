export const isInAppBrowser = (): boolean => {
  const userAgent = navigator.userAgent;
  
  const inAppBrowserPatterns = [
    /FB_IAB/, /FBAN|FBAV/, /Instagram/, /Twitter/, /Line/, /KAKAOTALK/, /wv/
  ];
  
  return inAppBrowserPatterns.some(pattern => pattern.test(userAgent));
};

export const displayInAppBrowserWarning = (): void => {
  if (isInAppBrowser()) {
    console.warn('In-app browser detected. Some features may not work properly.');
  }
};