(() => {
  "use strict";

  const productionHosts = new Set([
    "getroofsolarcalculator.online",
    "www.getroofsolarcalculator.online",
  ]);
  if (window.location.protocol !== "https:" || !productionHosts.has(window.location.hostname)) return;
  if (document.querySelector('script[src*="googletagmanager.com/gtm.js?id=GTM-5X5DFWMW"]')) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());

  const tagScript = document.createElement("script");
  tagScript.async = true;
  tagScript.src = "https://www.googletagmanager.com/gtm.js?id=GTM-5X5DFWMW";
  document.head.appendChild(tagScript);
})();
