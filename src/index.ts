import { initMarbleSkins } from './marbleSkins';
import options from './options';
import { Roulette } from './roulette';
import { initSchoolNameInput } from './schoolName';
import { initSpeedControl } from './speedControl';

const roulette = new Roulette();

(window as any).roulette = roulette;
(window as any).options = options;

initMarbleSkins(roulette);
initSpeedControl(roulette);
initSchoolNameInput();
