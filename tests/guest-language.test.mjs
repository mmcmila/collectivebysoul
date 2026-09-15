import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {resolveGuestLanguage} from "../lib/guest/language.ts";
import {english} from "../lib/guest/translations.ts";
test("browser language and explicit preference",()=>{
 assert.equal(resolveGuestLanguage(undefined,"en-US,en;q=0.9,tr;q=0.8"),"en");
 assert.equal(resolveGuestLanguage(undefined,"tr-TR,tr;q=0.9,en;q=0.8"),"tr");
 assert.equal(resolveGuestLanguage(undefined,"tr;q=0.2,en-GB;q=0.9"),"en");
 assert.equal(resolveGuestLanguage("tr","en-US"),"tr");
 assert.equal(resolveGuestLanguage("en","tr-TR"),"en");
 assert.equal(resolveGuestLanguage("invalid","en-GB"),"en");
 assert.equal(resolveGuestLanguage(undefined,"de-DE,en;q=0.8"),"tr");
 assert.equal(resolveGuestLanguage(undefined,""),"tr");
 assert.equal(resolveGuestLanguage(undefined,"en;q=0,tr;q=1"),"tr");
});
test("all server validation messages have English translations",()=>{
 for(const file of ["app/misafir/actions.ts","lib/guest/reservations.ts"]){
  const source=readFileSync(file,"utf8");
  const errors=[...source.matchAll(/(?:error:\s*|throw new \w*Error\(\s*)"([^"]+)"/g)].map(x=>x[1]);
  assert.ok(errors.length>0);
  for(const error of errors)assert.ok(english[error],error);
 }
});
