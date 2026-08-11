import type { Observer } from "./Node.js";

export let currentObserver: Observer[] = [];

export function setCurrentObserver(arr: Observer[]) {
    currentObserver = arr;
}