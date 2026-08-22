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
