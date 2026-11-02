import { PREFERENCE_COOKIE, PREFERENCE_STORAGE_KEY, UI_SIZES } from "./preferences";

/**
 * Runs in the document head before paint.
 * Staff pages take the cookie, then localStorage.
 * /session keeps the default language, theme, and size.
 */
export function preferenceBootScript(): string {
  const sizes = UI_SIZES.map((size) => `"${size}"`).join(",");
  return `(function(){try{var path=location.pathname||"";var root=document.documentElement;if(path==="/session"||path.indexOf("/session/")===0){root.setAttribute("data-theme","normal");root.setAttribute("data-locale","en");root.setAttribute("data-shell","exam");root.lang="en";root.style.fontSize="100%";return;}root.setAttribute("data-shell","staff");var raw="";var parts=(document.cookie||"").split(";");for(var i=0;i<parts.length;i++){var part=parts[i].replace(/^\\s+/,"");if(part.indexOf("${PREFERENCE_COOKIE}=")===0){raw=decodeURIComponent(part.slice(${PREFERENCE_COOKIE.length + 1}));break;}}if(!raw){try{raw=localStorage.getItem("${PREFERENCE_STORAGE_KEY}")||"";}catch(e){raw="";}}var bits=raw.split(".");if(bits.length!==3)return;var locale=bits[0];var theme=bits[1];var size=bits[2];if(locale!=="en"&&locale!=="zh-Hant")return;if(theme!=="normal"&&theme!=="contrast")return;if([${sizes}].indexOf(size)<0)return;root.setAttribute("data-theme",theme);root.setAttribute("data-locale",locale);root.lang=locale==="zh-Hant"?"zh-Hant":"en";root.style.fontSize=size+"%";}catch(e){}})();`;
}
