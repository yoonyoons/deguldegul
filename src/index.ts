import { initMarbleSkins } from './marbleSkins';
import options from './options';
import { Roulette } from './roulette';

const roulette = new Roulette();

(window as any).roulette = roulette;
(window as any).options = options;

initMarbleSkins(roulette);
