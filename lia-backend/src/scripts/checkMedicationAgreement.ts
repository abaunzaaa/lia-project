import { mentionedDrugNames } from '../services/accountMedicationChatService';
import { chatAboutDrug, explainKnownMedicationContext, medicationSourceAgrees } from '../services/drugChatService';
import { getRawDrugInfo } from '../services/drugReferenceService';
import { getBrandNames, searchApproximateTerms } from '../services/rxNormService';
import { aiService } from '../services/aiService';
import { DrugInfo } from '../models/drugReferenceTypes';

function sample(name: string, genericName: string | null, brandNames: string[]): Pick<
  DrugInfo,
  'name' | 'genericName' | 'brandNames'
> {
  return { name, genericName, brandNames };
}

const localCases: Array<[string, boolean, ReturnType<typeof sample>]> = [
  ['Sprainer', false, sample('miconazole nitrate', 'miconazole nitrate', ['Dr. Rainer s Vaginal Cream'])],
  ['Ibuprofeno', true, sample('Ibuprofen', 'Ibuprofen', [])],
  ['Losartán', true, sample('Losartan', 'Losartan', [])],
  ['Acetaminofén', true, sample('Acetaminophen', 'Acetaminophen', [])],
  ['Aspirina', true, sample('Aspirin', 'Aspirin', [])],
];

let failed = 0;
const foam = explainKnownMedicationContext({
  name: 'Sprainer',
  notes: 'Sprainer es una solución espumosa.',
});
const foamOk = Boolean(
  foam &&
    /espuma/i.test(foam) &&
    /no está confirmada/i.test(foam) &&
    !/vaginal|miconazol|escríbeme/i.test(foam)
);
if (!foamOk) failed += 1;
console.log(`sprainer-note ${foamOk ? 'OK' : 'FAIL'}`);
const noContext = explainKnownMedicationContext({ name: 'Sprainer' });
if (noContext !== null) {
  failed += 1;
  console.log('sprainer-empty FAIL');
} else {
  console.log('sprainer-empty OK');
}
for (const [requested, expected, info] of localCases) {
  const actual = medicationSourceAgrees(requested, info);
  const ok = actual === expected;
  if (!ok) failed += 1;
  console.log(`local ${requested} expected=${expected} actual=${actual} ${ok ? 'OK' : 'FAIL'}`);
}

async function live(term: string): Promise<void> {
  const [hit] = await searchApproximateTerms(term, 1);
  if (!hit) {
    console.log(`live ${term} no-hit`);
    return;
  }
  const brands = await getBrandNames(hit.id);
  const agrees = medicationSourceAgrees(term, {
    name: hit.name,
    genericName: hit.tty === 'IN' ? hit.name : null,
    brandNames: brands,
  });
  console.log(
    `live ${term} rxcui=${hit.id} tty=${hit.tty ?? 'none'} score=${hit.score ?? 'none'} agrees=${agrees} concept=${hit.name}`
  );
}

function flags(text: string): string {
  const sample = text.toLowerCase();
  return [
    sample.includes('vaginal') ? 'vaginal' : 'no-vaginal',
    sample.includes('miconazol') ? 'miconazol' : 'no-miconazol',
    sample.includes('principio activo') ? 'asks-ingredient' : 'no-ask',
    sample.includes('no encontré información suficiente') ? 'insufficient' : 'answered',
  ].join(',');
}

async function ask(
  label: string,
  name: string,
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[] = []
): Promise<{ message: string; grounded: boolean; medicationName: string }> {
  const result = await chatAboutDrug({
    medication: { name },
    message,
    history,
  });
  console.log(
    `${label} medication=${result.medication.name} grounded=${result.grounded} source=${result.source?.name ?? 'none'} flags=${flags(result.message)}`
  );
  return {
    message: result.message,
    grounded: result.grounded,
    medicationName: result.medication.name,
  };
}

async function main(): Promise<void> {
  await live('Sprainer');
  await live('Ibuprofen');
  await live('Losartan');

  const resolved = await getRawDrugInfo({ name: 'Sprainer' });
  const agrees = medicationSourceAgrees('Sprainer', resolved);
  console.log(
    `resolved Sprainer concept=${resolved.name} generic=${resolved.genericName ?? 'none'} agrees=${agrees} brands=${resolved.brandNames.length}`
  );
  if (agrees) failed += 1;

  const mentions = mentionedDrugNames('¿Para qué sirve el ibuprofeno?');
  console.log(`mentions ibuprofeno=${mentions.join('|') || 'none'}`);
  if (mentions[0]?.toLowerCase() !== 'ibuprofeno') failed += 1;

  const first = await ask('sprainer-1', 'Sprainer', 'Explícame de forma sencilla para qué sirve.');
  const firstText = first.message.toLowerCase();
  if (
    first.grounded ||
    firstText.includes('vaginal') ||
    firstText.includes('escríbeme') ||
    firstText.includes('principio activo') ||
    !firstText.includes('no encontré información suficiente')
  ) {
    failed += 1;
    console.log('sprainer-1 FAIL');
  }
  const ingredient = await ask(
    'sprainer-ingredient',
    'Sprainer',
    'El principio activo es ibuprofeno.',
    [
      { role: 'user', content: 'Explícame de forma sencilla para qué sirve.' },
      { role: 'assistant', content: first.message },
    ]
  );
  if (!ingredient.grounded || ingredient.message.toLowerCase().includes('vaginal')) {
    failed += 1;
    console.log('sprainer-ingredient FAIL');
  }
  const second = await ask(
    'sprainer-2',
    'Sprainer',
    'Explícamelo de forma más sencilla.',
    [
      { role: 'user', content: 'Explícame de forma sencilla para qué sirve.' },
      { role: 'assistant', content: first.message },
    ]
  );
  await ask('sprainer-3', 'Sprainer', '¿Qué precauciones tiene?', [
    { role: 'user', content: 'Explícame de forma sencilla para qué sirve.' },
    { role: 'assistant', content: first.message },
    { role: 'user', content: 'Explícamelo de forma más sencilla.' },
    { role: 'assistant', content: second.message },
  ]);
  await ask('sprainer-with-other-history', 'Sprainer', '¿Para qué sirve?', [
    { role: 'user', content: '¿Para qué sirve?' },
    { role: 'assistant', content: 'El losartán se usa para la presión arterial.' },
  ]);

  const unknown = await ask('unknown', 'Zzqxnona', '¿Para qué sirve?').catch((error: unknown) => {
    const message = error instanceof Error ? error.name : 'error';
    console.log(`unknown threw ${message}`);
    return null;
  });
  if (unknown && (unknown.grounded || unknown.message.toLowerCase().includes('vaginal'))) {
    failed += 1;
    console.log('unknown FAIL attributed a monograph');
  }

  console.log(`aiConfigured=${aiService.isConfigured()}`);
  if (aiService.isConfigured()) {
    const known = await ask('losartan-1', 'Losartan', 'Explícame de forma sencilla para qué sirve.');
    const knownBad =
      known.medicationName.toLowerCase().includes('miconazol') ||
      known.message.toLowerCase().includes('vaginal');
    if (knownBad) {
      failed += 1;
      console.log('losartan FAIL crossed with the other monograph');
    }
  } else {
    console.log('losartan-model skipped because the assistant is not configured');
  }

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'lookup failed';
  console.error(`live lookup failed: ${message}`);
  process.exitCode = 1;
});
