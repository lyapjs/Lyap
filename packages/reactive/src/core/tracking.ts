import type { Observer } from "./node.js";

export let currentObserver: Observer[] = [];

export function setCurrentObserver(arr: Observer[]) {
    currentObserver = arr;
}