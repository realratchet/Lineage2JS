declare const PRELOAD_SECTORS: string[];
declare const CHARACTER_CREATION_RACES: number[];
declare const LOGIN_EXIT_URL: string;
declare const CLIENT_DOWNLOAD_URL: string;
declare const ENABLE_CLOAKS: boolean;

export const preloadSectors = PRELOAD_SECTORS;
export const characterCreationRaces = CHARACTER_CREATION_RACES;
export const allCharacterCreationRacesEnabled = characterCreationRaces.length === 5;
export const loginExitUrl = LOGIN_EXIT_URL;
export const clientDownloadUrl = CLIENT_DOWNLOAD_URL;
export const enableCloaks = ENABLE_CLOAKS;
