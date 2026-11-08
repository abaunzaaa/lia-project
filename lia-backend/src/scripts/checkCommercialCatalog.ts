import { answerFromVerifiedFields, explainKnownMedicationContext, questionAspect } from '../services/drugChatService';
import {
  describeCommercialProduct,
  lookupCommercialCatalog,
  purposeFromCatalogTitle,
} from '../services/commercialCatalogService';

function check(label: string, ok: boolean): void {
  if (!ok) process.exitCode = 1;
  console.log(`${label} ${ok ? 'OK' : 'FAIL'}`);
}

const sprainer = purposeFromCatalogTitle(
  'Sprainer',
  'Sprainer Solución Espumosa Para Limpieza De Párpados Y Pestañas Frasco X 80Ml'
);
const sevedolBox = purposeFromCatalogTitle('Sevedol', 'Sevedol Tabletas Caja X 12');
const sevedolUse = purposeFromCatalogTitle(
  'Sevedol',
  'Sevedol. Para tratar los dolores de cabeza. Encuéntralo aquí'
);
const naloxone = purposeFromCatalogTitle('Nalixone', 'Naloxona 0.4 mg/ml solución inyectable');
const liquid = explainKnownMedicationContext({ name: 'Sprainer', presentation: 'liquid' });

check('sprainer-title', Boolean(sprainer && /limpieza de p[aá]rpados/i.test(sprainer.purpose) && sprainer.form === 'solución espumosa'));
check('sevedol-box-rejected', sevedolBox === null);
check('sevedol-use', Boolean(sevedolUse && /dolores de cabeza/i.test(sevedolUse.purpose)));
check('nalixone-not-naloxone', naloxone === null);
check('liquid-not-an-answer', liquid === null);
if (sprainer) console.log(describeCommercialProduct(sprainer));

const facts = {
  purpose: sprainer?.purpose || 'la limpieza de párpados y pestañas',
  form: 'solución espumosa' as string | null,
  instructions: [] as string[],
  precautions: [] as string[],
  adverse: [] as string[],
};
const purposeAnswer = answerFromVerifiedFields({ name: 'Sprainer', message: '¿Para qué sirve?', facts });
const useAnswer = answerFromVerifiedFields({ name: 'Sprainer', message: '¿Cómo debe usarse?', facts });
const cautionAnswer = answerFromVerifiedFields({ name: 'Sprainer', message: '¿Qué precauciones tiene?', facts });
check('aspect-purpose', questionAspect('¿Para qué sirve?') === 'purpose' && /limpiar los p[aá]rpados y las pestañas/i.test(purposeAnswer) && !/componente que indicaste/i.test(purposeAnswer));
check('aspect-use', questionAspect('¿Cómo debe usarse?') === 'administration' && /no tengo instrucciones comprobadas/i.test(useAnswer) && !/limpieza/i.test(useAnswer));
check('aspect-caution', questionAspect('¿Qué precauciones tiene?') === 'precautions' && /no tengo precauciones comprobadas/i.test(cautionAnswer) && !/limpieza/i.test(cautionAnswer));
console.log(purposeAnswer);
console.log(useAnswer);
console.log(cautionAnswer);

async function live(name: string): Promise<void> {
  const found = await lookupCommercialCatalog(name);
  if (!found) {
    console.log(`live ${name}: sin ficha comercial del mismo nombre`);
    return;
  }
  console.log(`live ${name}: ${describeCommercialProduct(found)} [${found.source}]`);
}

async function main(): Promise<void> {
  if (process.env.CATALOG_LIVE !== '1') return;
  for (const name of ['Sprainer', 'Sevedol', 'Nalixone', 'Macrofurin', 'Ibuprofeno']) {
    await live(name);
  }
}

main().catch((error: unknown) => {
  console.log(error instanceof Error ? error.message : 'failed');
  process.exitCode = 1;
});
