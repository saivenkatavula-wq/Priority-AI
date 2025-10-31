import { STORAGE_KEY } from './constants.js';

const storageAvailable = typeof chrome !== 'undefined' && !!chrome.storage?.local;
const originKey = location.origin;

const defaultState = {
  hidden: false,
  left: undefined,
  top: undefined,
};

const readStorageMap = () =>
  new Promise((resolve) => {
    if (!storageAvailable) {
      resolve({});
      return;
    }
    try {
      chrome.storage.local.get(STORAGE_KEY, (items) => {
        if (chrome.runtime?.lastError) {
          resolve({});
          return;
        }
        resolve(items?.[STORAGE_KEY] || {});
      });
    } catch (_err) {
      resolve({});
    }
  });

const writeStorageMap = (map) =>
  new Promise((resolve) => {
    if (!storageAvailable) {
      resolve();
      return;
    }
    try {
      chrome.storage.local.set({ [STORAGE_KEY]: map }, () => resolve());
    } catch (_err) {
      resolve();
    }
  });

export const isStorageAvailable = () => storageAvailable;

export const getDefaultState = () => ({ ...defaultState });

export const loadLauncherState = async () => {
  const map = await readStorageMap();
  const entry = map[originKey] || {};
  return {
    hidden: !!entry.hidden,
    left: typeof entry.left === 'number' && Number.isFinite(entry.left) ? entry.left : undefined,
    top: typeof entry.top === 'number' && Number.isFinite(entry.top) ? entry.top : undefined,
  };
};

export const persistLauncherState = async (state) => {
  if (!storageAvailable || !state) {
    return;
  }
  const map = await readStorageMap();
  map[originKey] = {
    hidden: !!state.hidden,
    left:
      typeof state.left === 'number' && Number.isFinite(state.left) ? Math.floor(state.left) : undefined,
    top:
      typeof state.top === 'number' && Number.isFinite(state.top) ? Math.floor(state.top) : undefined,
  };
  await writeStorageMap(map);
};
