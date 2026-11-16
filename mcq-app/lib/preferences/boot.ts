import { LEGACY_CONTRAST_THEME, PREFERENCE_COOKIE, PREFERENCE_MAX_AGE, PREFERENCE_STORAGE_KEY, UI_SIZES } from "./preferences";

/**
 * Runs in the document head before paint.
 * Staff pages take the cookie, then localStorage.
 * /session keeps the default theme and size, and follows the saved language.
 * A saved `contrast` theme is rewritten to Dark so the old palette never paints.
 */
export function preferenceBootScript(): string {
  const sizes = UI_SIZES.map((size) => `"${size}"`).join(",");
  const cookieKey = PREFERENCE_COOKIE;
  const storageKey = PREFERENCE_STORAGE_KEY;
  const legacy = LEGACY_CONTRAST_THEME;
  return String.raw`(function(){try{var path=location.pathname||"";var root=document.documentElement;var raw="";var parts=(document.cookie||"").split(";");for(var i=0;i<parts.length;i++){var part=parts[i].replace(/^\s+/,"");if(part.indexOf("${cookieKey}=")===0){raw=decodeURIComponent(part.slice(${cookieKey.length + 1}));break;}}if(!raw){try{raw=localStorage.getItem("${storageKey}")||"";}catch(e){raw="";}}if(path==="/session"||path.indexOf("/session/")===0){root.setAttribute("data-theme","normal");root.setAttribute("data-shell","exam");root.style.fontSize="100%";var examLocale="en";var examBits=raw.split(".");if(examBits.length===3&&(examBits[0]==="en"||examBits[0]==="zh-Hant"))examLocale=examBits[0];root.setAttribute("data-locale",examLocale);root.lang=examLocale==="zh-Hant"?"zh-Hant":"en";return;}root.setAttribute("data-shell","staff");var bits=raw.split(".");if(bits.length!==3)return;var locale=bits[0];var theme=bits[1];var size=bits[2];if(locale!=="en"&&locale!=="zh-Hant")return;if(theme==="${legacy}")theme="dark";if(theme!=="normal"&&theme!=="dark"&&theme!=="light-contrast")return;if([${sizes}].indexOf(size)<0)return;if(bits[1]==="${legacy}"){var migrated=locale+".dark."+size;try{localStorage.setItem("${storageKey}",migrated);}catch(e){}var secure=location.protocol==="https:"?"; Secure":"";document.cookie="${cookieKey}="+encodeURIComponent(migrated)+"; Path=/; Max-Age=${PREFERENCE_MAX_AGE}; SameSite=Lax"+secure;}root.setAttribute("data-theme",theme);root.setAttribute("data-locale",locale);root.lang=locale==="zh-Hant"?"zh-Hant":"en";root.style.fontSize=size+"%";}catch(e){}})();`;
}
