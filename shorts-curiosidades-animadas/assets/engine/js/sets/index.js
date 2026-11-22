// Registro de escenarios disponibles. Para añadir uno: crea sets/<nombre>.js con export function build(params) y regístralo aquí.
// build(params) debe devolver { group, anchors, update(t), bounds:{x,z,cx,cz,h} }.
import * as calle_victoriana from './calle_victoriana.js';
import * as habitacion from './habitacion.js';
import * as paisaje_nevado from './paisaje_nevado.js';
import * as bolera from './bolera.js';
import * as mercado from './mercado.js';

export const SETS = { calle_victoriana, habitacion, paisaje_nevado, bolera, mercado };
