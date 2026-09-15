"use client";
import {createContext,useContext,useEffect,useState,type ReactNode} from "react";
import {guestLanguageCookie,type GuestLanguage} from "@/lib/guest/language";
import {english} from "@/lib/guest/translations";
const LanguageContext=createContext<{language:GuestLanguage;changeLanguage:(language:GuestLanguage)=>void}|null>(null);
export function GuestLanguageProvider({initialLanguage,children}:{initialLanguage:GuestLanguage;children:ReactNode}){
 const [language,setLanguage]=useState(initialLanguage);
 useEffect(()=>{const previous=document.documentElement.lang;document.documentElement.lang=language;document.title=language==="en"?"Plan your day · Soul Collective":"Gününü planla · Soul Collective";return()=>{document.documentElement.lang=previous;};},[language]);
 function changeLanguage(value:GuestLanguage){
  document.cookie=guestLanguageCookie+"="+value+"; Path=/misafir; Max-Age=31536000; SameSite=Lax"+(location.protocol==="https:"?"; Secure":"");
  setLanguage(value);
 }
 return <LanguageContext.Provider value={{language,changeLanguage}}>{children}</LanguageContext.Provider>;
}
export function useGuestLanguage(){
 const context=useContext(LanguageContext);
 if(!context)throw new Error("GuestLanguageProvider is missing");
 return {...context,t:(text:string)=>context.language==="en"?(english[text]??text):text};
}
export function GuestLanguageSwitch(){
 const {language,changeLanguage}=useGuestLanguage();
 return <div className="gp-language" role="group" aria-label="Language / Dil">{(["tr","en"] as const).map(value=><button key={value} type="button" lang={value} aria-label={value==="tr"?"Türkçe":"English"} aria-pressed={language===value} onClick={()=>changeLanguage(value)}>{value.toUpperCase()}</button>)}</div>;
}
