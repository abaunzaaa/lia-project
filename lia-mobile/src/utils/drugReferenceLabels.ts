/** Texto visible: nunca `undefined`, `null` ni cadenas vacías. */
export function presentText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function presentList(items: readonly string[] | null | undefined): string[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => item.trim()).filter((item) => item.length > 0);
}

/** RxNorm marca presentaciones como `[Advil]`; en pantalla se muestra sin corchetes. */
function stripDrugNameBrackets(value: string): string {
  return value.replace(/\[([^[\]]+)\]/g, '$1').replace(/\s+/g, ' ').trim();
}

function titleCaseDrugWord(part: string): string {
  const letters = part.replace(/[^A-Za-zÁÉÍÓÚÑÜáéíóúñü]/g, '');
  if (!letters) return part;
  const allLower = letters === letters.toLowerCase();
  const allUpper = letters === letters.toUpperCase();
  if (!allLower && !allUpper) return part;
  return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
}

/** Nombre de medicamento para la UI: sin corchetes y con capitalización legible. */
export function presentDrugName(value: string | null | undefined): string | null {
  const text = presentText(value);
  if (!text) return null;
  const cleaned = stripDrugNameBrackets(text);
  if (!cleaned) return text;
  return cleaned.split(/\s+/).map(titleCaseDrugWord).join(' ');
}

export type DrugFormKey =
  | 'tableta'
  | 'capsula'
  | 'jarabe'
  | 'inyeccion'
  | 'gotas'
  | 'crema'
  | 'otro';

function normalizeFormText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const FORM_RULES: { key: DrugFormKey; label: string; pattern: RegExp }[] = [
  { key: 'inyeccion', label: 'Inyección', pattern: /\b(inyeccion|injection|injectable|jeringa|ampolla|vial)\b/ },
  { key: 'capsula', label: 'Cápsula', pattern: /\b(capsula|capsule|caplet)\b/ },
  { key: 'jarabe', label: 'Jarabe', pattern: /\b(jarabe|syrup|suspension|solucion|solution|elixir)\b/ },
  { key: 'gotas', label: 'Gotas', pattern: /\b(gotas|drops?|ophthalmic)\b/ },
  { key: 'crema', label: 'Crema', pattern: /\b(crema|cream|unguento|ointment|gel)\b/ },
  { key: 'tableta', label: 'Tableta', pattern: /\b(tableta|tablet|chewable|comprimido)\b/ },
];

/** Forma farmacéutica visible: cápsula, jarabe, inyección, etc. */
export function detectDrugForm(
  name: string | null | undefined,
  tty?: string | null
): { key: DrugFormKey; label: string } {
  const text = normalizeFormText(`${name ?? ''} ${tty ?? ''}`);
  for (const rule of FORM_RULES) {
    if (rule.pattern.test(text)) return { key: rule.key, label: rule.label };
  }

  const ttyLabel = friendlyTtyLabel(tty);
  if (ttyLabel === 'Marca') return { key: 'otro', label: 'Marca' };
  if (ttyLabel === 'Ingrediente') return { key: 'tableta', label: 'Ingrediente' };
  if (ttyLabel === 'Forma farmacéutica') return { key: 'otro', label: 'Forma' };
  return { key: 'otro', label: ttyLabel || 'Medicamento' };
}

/**
 * Etiquetas humanas para TTY de RxNorm (sin exponer códigos técnicos).
 */
export function friendlyTtyLabel(tty: string | null | undefined): string | null {
  if (!tty) return null;
  switch (tty.toUpperCase()) {
    case 'IN':
    case 'PIN':
      return 'Ingrediente';
    case 'MIN':
    case 'GPCK':
    case 'BPCK':
      return 'Combinación';
    case 'BN':
      return 'Marca';
    case 'SCD':
    case 'SBD':
    case 'SCDC':
    case 'SBDC':
      return 'Presentación';
    case 'DF':
    case 'DFG':
      return 'Forma farmacéutica';
    default:
      return null;
  }
}

export function friendlySourceLabel(name: string | null | undefined): string | null {
  if (!name) return null;
  switch (name) {
    case 'openFDA':
      return 'Fuente: openFDA';
    case 'DailyMed':
      return 'Fuente: DailyMed';
    case 'RxNorm':
      return 'Fuente: RxNorm';
    default:
      return `Fuente: ${name}`;
  }
}
