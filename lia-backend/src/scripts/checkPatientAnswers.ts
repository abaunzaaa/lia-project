import { readFileSync } from 'fs';
import path from 'path';
import { assistantQuotaMessage } from '../services/aiService';
import {
  answerFromVerifiedFields,
  clarificationReply,
  missingCauseReply,
  questionAspect,
  replyFromVerifiedSources,
  unambiguousIngredientSpelling,
} from '../services/drugChatService';
import {
  answerFromPatientMonograph,
  lookupSpanishPatientMonograph,
  parseSpanishMonograph,
} from '../services/patientMonographService';

function check(label: string, ok: boolean): void {
  if (!ok) process.exitCode = 1;
  console.log(`${label} ${ok ? 'OK' : 'FAIL'}`);
}

const technical = /AI_API_KEY|gemini-|\bHTTP\s*\d{3}\b|cuota diaria|mañana|AI_MODEL|AI_CHAT/i;

const fixture = `
<title>Ejemplol: MedlinePlus medicinas</title>
<div id="why"><div class="section-body"><p>El ejemplol se usa para aliviar el dolor y la fiebre.</p></div></div></section>
<div id="how"><div class="section-body"><p>Tome el ejemplol con agua. No deje de tomar el ejemplol sin hablar con su médico. Si interrumpe bruscamente el tratamiento puede haber problemas graves.</p></div></div></section>
<div id="precautions"><div class="section-body"><p>Antes de tomar ejemplol,</p><ul>
<li>informe a su médico si es alérgico a este medicamento.</li>
<li>informe a su médico y farmacéutico de cualquier medicamento con receta o productos a base de plantas que esté tomando.</li>
<li>informe a su médico si tiene asma, diabetes o una enfermedad del corazón.</li>
</ul></div></div></section>
<div id="side-effects"><div class="section-body"><p>Puede ocasionar efectos secundarios.</p><ul>
<li>mareos o aturdimiento</li>
<li>cansancio</li>
</ul></div></div></section>
`;

const parsed = parseSpanishMonograph(fixture, 'ejemplol', 'https://medlineplus.gov/spanish/druginfo/meds/ejemplo-es.html');
const rejected = parseSpanishMonograph(fixture, 'Sprainer', 'https://medlineplus.gov/spanish/druginfo/meds/ejemplo-es.html');
check('fixture-agrees', Boolean(parsed));
check('fixture-rejects-other-product', rejected === null);

const precautions = parsed
  ? answerFromPatientMonograph({ name: 'Ejemplol', aspect: 'precautions', monograph: parsed })
  : '';
const purpose = parsed
  ? answerFromPatientMonograph({ name: 'Ejemplol', aspect: 'purpose', monograph: parsed })
  : '';
const follow = parsed
  ? replyFromVerifiedSources({
      name: 'Ejemplol',
      message: '¿y eso?',
      history: [{ role: 'user', content: '¿Qué precauciones tiene?' }],
      monograph: parsed,
      facts: null,
    })
  : null;

check('fixture-purpose', Boolean(purpose && /dolor/i.test(purpose) && !technical.test(purpose || '')));
check(
  'fixture-precautions',
  Boolean(
    precautions &&
      /no lo dejes de un d[ií]a para otro/i.test(precautions) &&
      /cu[eé]ntale a tu m[eé]dico si tienes asma/i.test(precautions) &&
      /puede darte mareo/i.test(precautions) &&
      precautions.endsWith('.') &&
      !technical.test(precautions)
  )
);
check('follow-up-aspect', questionAspect('¿y eso?', [{ role: 'user', content: '¿Qué precauciones tiene?' }]) === 'precautions');
check('why-is-its-own-question', questionAspect('¿Y por qué?') === 'reason');
const iconFile = path.resolve(__dirname, '../../../lia-mobile/src/components/icons/Ionicons.tsx');
const iconPathsFile = path.resolve(__dirname, '../../../lia-mobile/src/components/icons/iconPaths.json');
const iconSource = readFileSync(iconFile, 'utf8');
const iconPaths = JSON.parse(readFileSync(iconPathsFile, 'utf8')) as {
  units: number;
  bottom: Record<string, number>;
  icons: Record<string, string>;
};
check(
  'icons-square-without-scale',
  /viewBox=\{`0 0 \$\{units\} \$\{units\}`\}/.test(iconSource) && !/scale:/.test(iconSource)
);
check(
  'icons-paths-present',
  Object.entries(iconPaths.icons).every(([, path]) => path.length > 40) &&
    Object.keys(iconPaths.icons).length >= 60
);
const overflowing = Object.entries(iconPaths.bottom).filter(([, bottom]) => bottom > iconPaths.units);
console.log(`iconos con tinta bajo 512: ${overflowing.length}`);
check('follow-up-answer', Boolean(follow && follow === precautions));

const quota = assistantQuotaMessage('daily');
check('quota-plain', quota === 'En este momento no puedo consultar más información. Puedes intentarlo más tarde.');
check('quota-not-technical', !technical.test(quota));

const sprainerFacts = {
  purpose: 'la limpieza de párpados y pestañas',
  form: 'solución espumosa',
  instructions: [] as string[],
  precautions: [] as string[],
  adverse: [] as string[],
};
const sprainerPurpose = answerFromVerifiedFields({
  name: 'Sprainer',
  message: '¿Para qué sirve?',
  facts: sprainerFacts,
});
const sprainerCaution = answerFromVerifiedFields({
  name: 'Sprainer',
  message: '¿Qué precauciones tiene?',
  facts: sprainerFacts,
});
check(
  'sprainer-purpose',
  sprainerPurpose ===
    'Sprainer es una solución espumosa que sirve para limpiar los párpados y las pestañas.' &&
    !/componente que indicaste|Esto corresponde|No confirma la composici/i.test(sprainerPurpose)
);
check(
  'sprainer-no-borrowed-precautions',
  /no tengo precauciones comprobadas/i.test(sprainerCaution) && !/bruscamente|mareos|asma/i.test(sprainerCaution)
);

const unknown = answerFromVerifiedFields({
  name: 'ZZZMedicamento',
  message: '¿Para qué sirve?',
  facts: { purpose: '', form: null, instructions: [], precautions: [], adverse: [] },
});
check(
  'unknown-no-instructions',
  /No tengo información comprobada sobre ZZZMedicamento/i.test(unknown) && !/tome|aplique|dosis/i.test(unknown)
);

function show(label: string, text: string | null): void {
  console.log(`${label}: ${(text || '(vacío)').slice(0, 420)}`);
}

async function live(): Promise<void> {
  const metoprolol = await lookupSpanishPatientMonograph({ rxcui: '6918', drugName: 'metoprolol' });
  const metoprololPrecautions = metoprolol
    ? answerFromPatientMonograph({ name: 'Metoprolol', aspect: 'precautions', monograph: metoprolol })
    : null;
  check(
    'metoprolol-precautions',
    Boolean(
      metoprololPrecautions &&
        metoprololPrecautions.startsWith('No lo dejes de un día para otro.') &&
        /problemas del coraz[oó]n/i.test(metoprololPrecautions) &&
        /asma/i.test(metoprololPrecautions) &&
        /puede darte mareo/i.test(metoprololPrecautions) &&
        metoprololPrecautions.endsWith('.') &&
        !/embarazada/i.test(metoprololPrecautions) &&
        !/[…]$/.test(metoprololPrecautions) &&
        !technical.test(metoprololPrecautions)
    )
  );
  const why = metoprolol
    ? replyFromVerifiedSources({
        name: 'Metoprolol',
        message: '¿Y por qué?',
        history: [
          { role: 'user', content: '¿Qué precauciones tiene?' },
          { role: 'assistant', content: metoprololPrecautions || '' },
        ],
        monograph: metoprolol,
        facts: null,
      })
    : null;
  check(
    'metoprolol-why',
    Boolean(
      why &&
        why === 'Si lo dejas de golpe, puedes tener problemas graves del corazón.' &&
        !/^porque no lo dejes/i.test(why) &&
        !/no lo dejes de un d[ií]a/i.test(why)
    )
  );
  show('metoprolol por qué', why);
  show('metoprolol precauciones', metoprololPrecautions);

  const acetaminophen = await lookupSpanishPatientMonograph({
    rxcui: '161',
    drugName: 'acetaminophen',
  });
  const acetaminophenPurpose = acetaminophen
    ? answerFromPatientMonograph({ name: 'Acetaminofén', aspect: 'purpose', monograph: acetaminophen })
    : null;
  const acetaminophenPrecautions = acetaminophen
    ? answerFromPatientMonograph({ name: 'Acetaminofén', aspect: 'precautions', monograph: acetaminophen })
    : null;
  check(
    'acetaminophen-purpose',
    acetaminophenPurpose ===
      'El acetaminofén se usa para el alivio del dolor de leve a moderado y para disminuir la fiebre.'
  );
  check(
    'acetaminophen-precautions',
    Boolean(
      acetaminophenPrecautions &&
        acetaminophenPrecautions.startsWith('No tomes más de lo que indica el empaque o tu médico.') &&
        /tambi[eé]n contengan acetaminof[eé]n/i.test(acetaminophenPrecautions) &&
        /m[aá]s de 10 d[ií]as/i.test(acetaminophenPrecautions) &&
        /menores de 2 a[nñ]os/i.test(acetaminophenPrecautions) &&
        !/^si est[aá]s embarazada/i.test(acetaminophenPrecautions) &&
        acetaminophenPrecautions.endsWith('.') &&
        !acetaminophenPrecautions.includes('…') &&
        !/Acetaminophen\./.test(acetaminophenPrecautions) &&
        !technical.test(acetaminophenPrecautions)
    )
  );
  const combineWhy = acetaminophen
    ? replyFromVerifiedSources({
        name: 'Acetaminofén',
        message: '¿Por qué no puedo combinarlo con otros?',
        history: [
          { role: 'user', content: '¿Qué precauciones tiene?' },
          { role: 'assistant', content: acetaminophenPrecautions || '' },
        ],
        monograph: acetaminophen,
        facts: null,
      })
    : null;
  check(
    'acetaminophen-why-combine',
    Boolean(
      combineWhy &&
        /otros medicamentos tambi[eé]n pueden contener acetaminof[eé]n/i.test(combineWhy) &&
        /pasar la dosis/i.test(combineWhy) &&
        !/^porque no combines/i.test(combineWhy) &&
        !/no tomes m[aá]s de lo que indica/i.test(combineWhy)
    )
  );
  show('acetaminofén para qué', acetaminophenPurpose);
  show('acetaminofén precauciones', acetaminophenPrecautions);
  show('acetaminofén por qué no combinarlo', combineWhy);

  const sprainerHow = replyFromVerifiedSources({
    name: 'Sprainer',
    message: '¿Y cómo se usa?',
    history: [
      { role: 'user', content: '¿Para qué sirve?' },
      {
        role: 'assistant',
        content: 'Sprainer es una solución espumosa que sirve para limpiar los párpados y las pestañas.',
      },
    ],
    monograph: null,
    facts: sprainerFacts,
  });
  check(
    'sprainer-how-after-purpose',
    sprainerHow === 'No tengo instrucciones comprobadas de cómo se usa Sprainer.'
  );
  const sprainerWhy = replyFromVerifiedSources({
    name: 'Sprainer',
    message: '¿Y por qué?',
    history: [
      { role: 'user', content: '¿Para qué sirve?' },
      {
        role: 'assistant',
        content: 'Sprainer es una solución espumosa que sirve para limpiar los párpados y las pestañas.',
      },
    ],
    monograph: null,
    facts: sprainerFacts,
  });
  check('sprainer-why-not-invented', sprainerWhy === missingCauseReply());
  show('sprainer cómo se usa', sprainerHow);
  show('sprainer por qué', sprainerWhy);

  const borrowed = await lookupSpanishPatientMonograph({ rxcui: '6918', drugName: 'Sprainer' });
  check('sprainer-not-metoprolol-page', borrowed === null);

  const typo = await unambiguousIngredientSpelling('metropolol');
  const notNaloxone = await unambiguousIngredientSpelling('nalixone');
  const sprainerName = await unambiguousIngredientSpelling('Sprainer');
  check('metropolol-resolves', typo === 'metoprolol');
  check('nalixone-stays-ambiguous', notNaloxone === null);
  check('sprainer-not-corrected', sprainerName === null);
  const gapFollowUp = replyFromVerifiedSources({
    name: 'Metropolol',
    message: '¿Y por qué?',
    history: [
      { role: 'user', content: '¿Qué precauciones tiene?' },
      { role: 'assistant', content: 'No tengo información comprobada sobre Metropolol para responder eso.' },
    ],
    monograph: null,
    facts: null,
  });
  check(
    'gap-follow-up-asks',
    gapFollowUp === clarificationReply() && !/no tengo informaci[oó]n comprobada/i.test(gapFollowUp || '')
  );
}

live().catch((error: unknown) => {
  console.log(error instanceof Error ? error.message : 'failed');
  process.exitCode = 1;
});
