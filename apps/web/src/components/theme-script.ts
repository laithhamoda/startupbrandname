export const THEME_STORAGE_KEY = 'sbn-theme';

/** Runs before first paint so a saved light/dark choice never flashes the wrong theme (D-052). */
export const themeScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;}}catch(e){}})();`;
