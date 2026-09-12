import {simulate} from './expediente.simulation.js?v=20260912-10';
self.onmessage=({data})=>{try{self.postMessage({result:simulate(data)});}catch{self.postMessage({error:'No pudimos completar el cálculo. Tus datos siguen guardados; intenta recalcular.'});}};
