import type { GuestPlan } from "./types";
export type AdminGuest = {id:string;name:string;category:"paid"|"team"|"guest";active:boolean;isDemo:boolean;createdAt:string;updatedAt:string|null;plan:GuestPlan|null};
export type AdminWorkshop = {id:string;capacity:number|null;booked:number;enabled:boolean;guests:{id:string;name:string}[]};
export type AdminData = {guests:AdminGuest[];workshops:AdminWorkshop[];fetchedAt:string};
