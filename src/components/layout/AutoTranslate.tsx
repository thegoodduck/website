'use client';

import Script from 'next/script';

// Auto-translates the whole site (including dynamic content) to French.
export function AutoTranslate() {
  return (
    <>
      <div id="google_translate_element" className="hidden" />
      <Script id="gt-init" strategy="afterInteractive">{`
        document.cookie = 'googtrans=/en/fr; path=/';
        window.googleTranslateElementInit = function () {
          new google.translate.TranslateElement({ pageLanguage: 'en', includedLanguages: 'fr', autoDisplay: false }, 'google_translate_element');
        };
      `}</Script>
      <Script src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit" strategy="afterInteractive" />
    </>
  );
}
