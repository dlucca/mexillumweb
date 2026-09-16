// Step 3 questions. Everything is multiple choice: the client never types here.
// Deep questions for the four installations without a public diagnostic content
// file live at the bottom of this module.
import { sharedOptions } from './diagnostico.profile.js';

const unknown = { value: 'nolose', label: 'No lo sé' };
const opts = (items) => items.map(([value, label]) => ({ value, label }));
export const select = (key, label, items, extra = {}) => ({ key, label, type: 'select', options: [...opts(items), unknown], ...extra });
export const multi = (key, label, items, extra = {}) => ({ key, label, type: 'multi', options: [...opts(items), unknown], exclusive: ['nolose'], ...extra });

// One schedule answer feeds the three hourly-model inputs at once. Codes absent
// from these tables (including `nolose`) write nothing, which keeps
// `scheduleKnown` false and makes the simulation disclose its assumption.
export const SCHEDULE = {
  days: { lv: { weekendPct: 15 }, ls: { weekendPct: 55 }, todos: { weekendPct: 100 } },
  hours: {
    matutino: { loadShape: 1, operationStart: 7, operationEnd: 16 },
    extendido: { loadShape: 1, operationStart: 8, operationEnd: 20 },
    dos_turnos: { loadShape: 1, operationStart: 6, operationEnd: 22 },
    continuo: { loadShape: 0, operationStart: 8, operationEnd: 18 },
    // shape 2 is active OUTSIDE [start,end); the engine still requires start < end.
    nocturno: { loadShape: 2, operationStart: 6, operationEnd: 20 }
  },
  off: { apaga: { offHoursPct: 10 }, basico: { offHoursPct: 25 }, mitad: { offHoursPct: 50 }, poco: { offHoursPct: 75 }, igual: { offHoursPct: 100 } }
};
export function derivedSchedule(a = {}) {
  return { ...(SCHEDULE.days[a.days] || {}), ...(SCHEDULE.hours[a.hours] || {}), ...(SCHEDULE.off[a.off] || {}) };
}

const answered = (v) => Array.isArray(v) ? v.some((x) => x && x !== 'nolose' && x !== 'ninguno' && x !== 'ninguna') : !!v && v !== 'nolose';

export const COMMON = [
  multi('objective', '¿Qué quieres mejorar?', [['cost', 'Reducir el costo de energía'], ['continuity', 'Evitar interrupciones'], ['growth', 'Ampliar capacidad'], ['unknown', 'Quiero orientación']], { exclusive: ['unknown', 'nolose'] }),
  select('days', '¿Qué días opera la instalación?', [['lv', 'Lunes a viernes'], ['ls', 'Lunes a sábado'], ['todos', 'Los 7 días']]),
  select('hours', '¿Cuándo hay actividad?', [['matutino', 'Un turno de mañana, 7 a 16 h'], ['extendido', 'Horario extendido, 8 a 20 h'], ['dos_turnos', 'Dos turnos, 6 a 22 h'], ['continuo', '24 horas'], ['nocturno', 'Sobre todo de noche']]),
  select('off', '¿Cuánto baja el consumo fuera de ese horario?', [['apaga', 'Casi todo se apaga'], ['basico', 'Queda lo básico'], ['mitad', 'Baja a la mitad'], ['poco', 'Baja poco'], ['igual', 'Igual que en horario']]),
  multi('equipment', '¿Qué equipos tienen hoy?', [['solar', 'Paneles solares'], ['battery', 'Baterías'], ['generator', 'Planta de emergencia'], ['ups', 'UPS'], ['none', 'Ninguno']], { exclusive: ['none', 'nolose'] }),
  select('scope', '¿Este medidor abastece toda la instalación?', [['todo', 'Sí, toda la instalación'], ['parte', 'Solo una parte; hay otros medidores']]),
  multi('power', '¿Han tenido problemas de energía este año?', [['apagones', 'Apagones que detienen la operación'], ['micro', 'Microcortes o parpadeos'], ['voltaje', 'Variaciones de voltaje o equipos dañados'], ['ninguno', 'Ninguno']], { exclusive: ['ninguno', 'nolose'] })
];

export const CONDITIONAL = [
  select('powerFreq', '¿Cada cuándo ocurren?', [['semanal', 'Varias veces al mes'], ['mensual', 'Una vez al mes'], ['algunas', 'Algunas veces al año'], ['raro', 'Una o dos veces al año']], { when: (a) => answered(a.power) }),
  select('manualTariff', 'Tarifa o suministro', [['gdmth', 'GDMTH'], ['gdmto', 'GDMTO'], ['gdbt', 'GDBT'], ['pdbt', 'PDBT'], ['dist', 'DIST o DIT'], ['privado', 'Suministrador privado'], ['aislado', 'Sin conexión a la red']], { when: (a, req = []) => req.includes('manualTariff') }),
  { key: 'manualBill', label: '¿Cuánto paga de electricidad al mes?', type: 'select', options: sharedOptions.bill.map(({ codigo, label }) => ({ value: codigo, label })), when: (a, req = []) => req.includes('manualBill') },
  select('backupTime', '¿Cuánto debe aguantar sin red?', [['minutos', '15 minutos'], ['corto', '1 a 2 horas'], ['medio', '4 a 8 horas'], ['largo', 'Más de 8 horas']], { when: (a) => a.objective?.includes('continuity') }),
  select('growthSize', '¿Cuánta capacidad nueva viene en 12 meses?', [['poco', 'Menos de 10 %'], ['medio', '10 a 25 %'], ['alto', '25 a 50 %'], ['muyalto', 'Más de 50 %']], { when: (a) => a.objective?.includes('growth') }),
  select('solarSize', '¿De qué tamaño es el sistema solar?', [['chico', 'Menos de 50 kWp'], ['medio', '50 a 250 kWp'], ['grande', '250 a 1000 kWp'], ['muygrande', 'Más de 1000 kWp']], { when: (a) => a.equipment?.includes('solar') }),
  select('solarExport', '¿Qué pasa con los excedentes?', [['inyecta', 'Se inyectan a CFE'], ['consume', 'Se consumen en sitio']], { when: (a) => a.equipment?.includes('solar') })
];

export function operationQuestions(answers = {}, required = []) {
  return [...COMMON, ...CONDITIONAL.filter((q) => q.when(answers, required))];
}

// Labels, never internal codes: this is what the advisor reads in the email.
export function operationSummary(answers = {}, required = []) {
  const out = [];
  for (const q of operationQuestions(answers, required)) {
    const v = answers[q.key];
    const value = q.type === 'multi'
      ? (Array.isArray(v) ? v : []).map((code) => q.options.find((o) => o.value === code)?.label).filter(Boolean).join('; ')
      : q.options.find((o) => o.value === v)?.label || '';
    if (value) out.push({ label: q.label, value });
  }
  return out;
}
