import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
const scrypt=promisify(scryptCallback);
export async function hashAdminPassword(password:string){
 const salt=randomBytes(16).toString("hex");const key=await scrypt(password,salt,64) as Buffer;
 return `scrypt:${salt}:${key.toString("hex")}`;
}
export async function verifyAdminPassword(password:string,stored:string){
 if(stored.startsWith("scrypt:")){
  const [,salt,encoded]=stored.split(":");
  if(!/^[a-f0-9]{32}$/.test(salt??"")||!/^[a-f0-9]{128}$/.test(encoded??""))return false;
  const key=await scrypt(password,salt,64) as Buffer;return timingSafeEqual(key,Buffer.from(encoded,"hex"));
 }
 // Existing random organiser codes remain valid until the owner chooses a password.
 const key=createHash("sha256").update(password.toUpperCase().replace(/[\s-]/g,"")).digest("hex");
 return /^[a-f0-9]{64}$/.test(stored)&&timingSafeEqual(Buffer.from(key,"hex"),Buffer.from(stored,"hex"));
}
