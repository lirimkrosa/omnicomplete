import { getSuggestions } from './src/core/suggestion-engine.js';
import { loadAllSpecs } from './src/autocomplete/spec-loader.js';

const specs = loadAllSpecs();
console.log("Empty:", getSuggestions('docker ps ', { specs }).map(s => s.text));
console.log("With Star:", getSuggestions('docker ps ✨', { specs }).map(s => s.text));
