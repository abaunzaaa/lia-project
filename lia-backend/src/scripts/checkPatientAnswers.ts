import { readFileSync } from 'fs';
import path from 'path';
import { assistantQuotaMessage } from '../services/aiService';
import { isRestatement, mentionedDrugNames } from '../services/accountMedicationChatService';
import { chooseCommercialProduct } from '../services/commercialCatalogService';
import { healthTopicFromSearch } from '../services/healthTopicService';
import {
  answerFromVerifiedFields,
  clarificationReply,
  firstSpokenSentence,
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
import {
  selectImportantWarnings,
  briefMonographPurpose,
  shortenPurpose,
} from '../services/packageObservation';

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
  /viewBox=\{`0 0 \$\{side\} \$\{side\}`\}/.test(iconSource) &&
    /width: size, height: size/.test(iconSource) &&
    !/transform=/.test(iconSource)
);
check(
  'icons-paths-present',
  Object.entries(iconPaths.icons).every(([, path]) => path.length > 40) &&
    Object.keys(iconPaths.icons).length >= 60
);
const overflowing = Object.entries(iconPaths.bottom).filter(([, bottom]) => bottom > iconPaths.units);
console.log(`iconos con tinta bajo 512: ${overflowing.length}`);
check('follow-up-answer', Boolean(follow && follow === precautions));

const listedPurpose = `
<title>Lista: MedlinePlus medicinas</title>
<div id="why"><div class="section-body"><p>Se usa para aliviar</p><ul>
<li>estornudos</li>
<li>secreción nasal</li>
<li>ojos rojos</li>
</ul></div></div></section>
<div id="precautions"><div class="section-body">
<p>Informe a su médico si tiene glaucoma, porque puede aumentar la presión del ojo.</p>
<p>Informe a su médico si tiene una enfermedad pulmonar.</p>
</div></div></section>
`;
const listed = parseSpanishMonograph(listedPurpose, 'lista', 'https://medlineplus.gov/spanish/druginfo/meds/lista-es.html');
const listedUse = listed ? answerFromPatientMonograph({ name: 'Lista', aspect: 'purpose', monograph: listed }) : '';
check(
  'list-keeps-punctuation',
  Boolean(
    listedUse &&
      /estornudos, secreción nasal y ojos rojos/i.test(listedUse) &&
      !/estornudos secreción/i.test(listedUse)
  )
);
const several = listed
  ? replyFromVerifiedSources({
      name: 'Lista',
      message: '¿Por qué es importante esa precaución?',
      history: [
        { role: 'user', content: '¿Qué precauciones tiene?' },
        {
          role: 'assistant',
          content: 'Antes de tomarlo, cuéntale a tu médico si tienes glaucoma. Puede darte mareo.',
        },
      ],
      monograph: listed,
      facts: null,
    })
  : null;
check(
  'why-asks-which',
  Boolean(several && /mencioné varias/i.test(several) && /glaucoma/i.test(several) && /mareo/i.test(several))
);
const glaucomaWhy = listed
  ? replyFromVerifiedSources({
      name: 'Lista',
      message: '¿Por qué importa el glaucoma?',
      history: [
        { role: 'user', content: '¿Qué precauciones tiene?' },
        { role: 'assistant', content: 'Antes de tomarlo, cuéntale a tu médico si tienes glaucoma.' },
      ],
      monograph: listed,
      facts: null,
    })
  : null;
check(
  'why-uses-source-cause',
  Boolean(glaucomaWhy && /presi[oó]n/i.test(glaucomaWhy) && !/no tengo una explicación comprobada/i.test(glaucomaWhy))
);
const simpler = replyFromVerifiedSources({
  name: 'Lista',
  message: 'Dímelo más sencillo',
  history: [
    { role: 'user', content: '¿Para qué sirve?' },
    { role: 'assistant', content: 'Sirve para aliviar el dolor. También baja la fiebre.' },
  ],
  monograph: listed,
  facts: null,
});
check('simpler-uses-previous', simpler === 'Sirve para aliviar el dolor.');
check(
  'follow-up-precautions-keep-drug',
  mentionedDrugNames('¿Y qué precauciones debo tener?', [
    { role: 'user', content: '¿Para qué sirve el acetaminofén?' },
  ]).join(' ') === 'acetaminofén'
);
check(
  'new-topic-leaves-previous-drug',
  mentionedDrugNames('Ahora explícame qué es el hipotiroidismo', [
    { role: 'user', content: '¿Para qué sirve el acetaminofén?' },
  ]).join(' ') === 'hipotiroidismo'
);
check('restatement', isRestatement('Resúmelo en una frase') && !isRestatement('¿Y qué precauciones debo tener?'));
check('summary-sentence', firstSpokenSentence('Sirve para el dolor. También baja la fiebre.') === 'Sirve para el dolor.');
const topic = healthTopicFromSearch(
  `<document rank="0" url="https://medlineplus.gov/spanish/hypothyroidism.html"><content name="title">Hipotiroidismo</content><content name="FullSummary">¿Qué es el hipotiroidismo? El hipotiroidismo ocurre cuando la glándula tiroides no produce suficiente hormona. Puede causar cansancio.</content></document>`,
  'hipotiroidismo'
);
check(
  'health-topic-from-source',
  Boolean(topic && /glándula tiroides/i.test(topic.summary) && /no produce suficiente hormona/i.test(topic.summary) && !topic.summary.includes('?'))
);
check(
  'health-topic-rejects-other',
  healthTopicFromSearch(
    `<document rank="0" url="https://medlineplus.gov/spanish/diabetes.html"><content name="title">Diabetes</content><content name="FullSummary">La diabetes es una condición en la que hay mucha azúcar en la sangre durante bastante tiempo.</content></document>`,
    'hipotiroidismo'
  ) === null
);
const sameUse = chooseCommercialProduct([
  { name: 'Ejemplo', purpose: 'la limpieza de párpados y pestañas', form: 'solución espumosa', source: 'Cruz Verde' },
  { name: 'Ejemplo', purpose: 'limpiar los párpados y las pestañas', form: null, source: 'Cruz Verde' },
]);
const splitUse = chooseCommercialProduct([
  { name: 'Ejemplo', purpose: 'aliviar el dolor', form: 'tabletas', source: 'Cruz Verde' },
  { name: 'Ejemplo', purpose: 'limpiar los párpados', form: 'solución', source: 'Cruz Verde' },
]);
check('catalog-same-purpose', Boolean(sameUse && !sameUse.alternatives && /p[aá]rpados/i.test(sameUse.purpose)));
check(
  'catalog-does-not-pick',
  Boolean(splitUse?.alternatives && splitUse.alternatives.length === 2 && splitUse.form === null)
);
const naproxenSentence =
  'El naproxeno se usa para aliviar el dolor causado por la osteoartritis (artrosis), la artritis reumatoide y la espondilitis anquilosante.';
const naproxenPurpose = shortenPurpose(naproxenSentence);
check(
  'purpose-stays-complete',
  naproxenPurpose.endsWith('.') &&
    /artritis reumatoide/i.test(naproxenPurpose) &&
    !naproxenPurpose.includes('…') &&
    !/\([^)]*$/.test(naproxenPurpose)
);
const warningText = [
  'No lo tome si es alérgico a este medicamento o a otro analgésico parecido.',
  'No tome más de 8 tabletas en un día.',
  'Informe a su médico si tiene una enfermedad del hígado.',
  'Otros medicamentos pueden contener el mismo componente y tomados juntos pueden hacerle daño.',
].join(' ');
const warnings = selectImportantWarnings(warningText);
check(
  'warnings-keep-relevant',
  warnings.length >= 2 &&
    warnings.some((line) => /al[eé]rgic/i.test(line)) &&
    warnings.some((line) => /h[ií]gado/i.test(line)) &&
    warnings.every((line) => line.endsWith('.')) &&
    !warnings.some((line) => /8 tabletas/i.test(line))
);
const referencePage = parseSpanishMonograph(
  `<title>Muestra: MedlinePlus</title>
  <div id="why"><div class="section-body"><p>La muestra se usa para aliviar la alergia.</p></div></div></section>
  <div id="how"><div class="section-body"><p>Tome la muestra con agua.</p></div></div></section>
  <div id="precautions"><div class="section-body"><p>Informe a su médico si tiene glaucoma, porque puede aumentar la presión del ojo.</p></div></div></section>`,
  'muestra',
  'https://medlineplus.gov/spanish/druginfo/meds/muestra-es.html'
);
const allReasons = referencePage
  ? replyFromVerifiedSources({
      name: 'Muestra',
      message: 'De todas',
      history: [
        { role: 'user', content: '¿Qué precauciones tiene?' },
        { role: 'assistant', content: 'Antes de tomarlo, cuéntale a tu médico si tienes glaucoma. Puede darte mareo.' },
        { role: 'user', content: '¿Por qué es importante esa precaución?' },
        { role: 'assistant', content: 'Mencioné varias: glaucoma y mareo. ¿De cuál quieres que te explique el motivo?' },
      ],
      monograph: referencePage,
      facts: null,
    })
  : null;
check(
  'all-precautions-stay-in-context',
  Boolean(allReasons && /glaucoma/i.test(allReasons) && /mareo/i.test(allReasons) && allReasons !== clarificationReply())
);
const secondReason = referencePage
  ? replyFromVerifiedSources({
      name: 'Muestra',
      message: 'La segunda',
      history: [
        { role: 'assistant', content: 'Mencioné varias: glaucoma y mareo. ¿De cuál quieres que te explique el motivo?' },
      ],
      monograph: referencePage,
      facts: null,
    })
  : null;
check('second-precaution', Boolean(secondReason && /mareo/i.test(secondReason) && !/presi[oó]n del ojo/i.test(secondReason || '')));
const everything = referencePage
  ? replyFromVerifiedSources({
      name: 'Muestra',
      message: 'Sí, explícame todo eso',
      history: [{ role: 'assistant', content: clarificationReply() }],
      monograph: referencePage,
      facts: null,
    })
  : null;
check(
  'accept-all-offered',
  Boolean(
    everything &&
      /alergia/i.test(everything) &&
      /glaucoma|presi[oó]n/i.test(everything) &&
      /con agua/i.test(everything) &&
      everything !== clarificationReply()
  )
);
const summarized = replyFromVerifiedSources({
  name: 'Muestra',
  message: 'Ahora resúmelo',
  history: [
    { role: 'assistant', content: 'La muestra se usa para aliviar la alergia. También puede dar sueño.' },
    { role: 'assistant', content: 'Mencioné varias: glaucoma y mareo. ¿De cuál quieres que te explique el motivo?' },
  ],
  monograph: referencePage,
  facts: null,
});
check('summary-skips-the-question', summarized === 'La muestra se usa para aliviar la alergia.');
const which = replyFromVerifiedSources({
  name: 'Muestra',
  message: '¿Cuáles?',
  history: [{ role: 'assistant', content: 'Mencioné varias: glaucoma y mareo. ¿De cuál quieres que te explique el motivo?' }],
  monograph: referencePage,
  facts: null,
});
check('which-lists-them', which === 'Las que mencioné son: glaucoma y mareo.');
const diphenhydraminePage = parseSpanishMonograph(
  `<title>Difenhidramina: MedlinePlus medicinas</title>
  <div id="why"><div class="section-body"><p>La difenhidramina se usa para aliviar la alergia.</p></div></div></section>
  <div id="precautions"><div class="section-body"><p>Informe a su médico si tiene o ha tenido alguna vez enfisema, bronquitis crónica u otro tipo de enfermedad pulmonar; glaucoma (una afección en la que el aumento de la presión en el ojo puede causar pérdida gradual de la visión).</p></div></div></section>
  <div id="side-effects"><div class="section-body"><p>somnolencia</p><p>mareos</p></div></div></section>`,
  'difenhidramina',
  'https://medlineplus.gov/spanish/druginfo/meds/difenhidramina-es.html'
);
const diphenPrecautions = diphenhydraminePage
  ? replyFromVerifiedSources({
      name: 'Difenhidramina',
      message: '¿Qué precauciones tiene?',
      history: [],
      monograph: diphenhydraminePage,
      facts: null,
    })
  : null;
const diphenWhy = diphenhydraminePage
  ? replyFromVerifiedSources({
      name: 'Difenhidramina',
      message: '¿Por qué son importantes?',
      history: [
        { role: 'user', content: '¿Qué precauciones tiene?' },
        { role: 'assistant', content: diphenPrecautions || '' },
      ],
      monograph: diphenhydraminePage,
      facts: null,
    })
  : null;
const diphenAll = diphenhydraminePage
  ? replyFromVerifiedSources({
      name: 'Difenhidramina',
      message: 'De todas',
      history: [
        { role: 'user', content: '¿Qué precauciones tiene?' },
        { role: 'assistant', content: diphenPrecautions || '' },
        { role: 'user', content: '¿Por qué son importantes?' },
        { role: 'assistant', content: diphenWhy || '' },
      ],
      monograph: diphenhydraminePage,
      facts: null,
    })
  : '';
check(
  'why-several-asks-which',
  Boolean(diphenWhy && /mencioné varias/i.test(diphenWhy) && /glaucoma/i.test(diphenWhy))
);
check(
  'definition-is-not-the-drug-reason',
  Boolean(
    diphenAll &&
      /glaucoma/i.test(diphenAll) &&
      (diphenAll.match(/no explica por qu[eé]/gi) || []).length === 1 &&
      !/presi[oó]n en el ojo|p[eé]rdida gradual/i.test(diphenAll) &&
      !/informe a su m[eé]dico si tiene o ha tenido/i.test(diphenAll)
  )
);
const labeledCause = diphenhydraminePage
  ? replyFromVerifiedSources({
      name: 'Difenhidramina',
      message: 'De todas',
      history: [
        { role: 'assistant', content: 'Mencioné varias: glaucoma de ángulo cerrado y mareo. ¿De cuál quieres que te explique el motivo?' },
      ],
      monograph: diphenhydraminePage,
      facts: null,
      labelNotes:
        'En el glaucoma de ángulo cerrado, este medicamento puede aumentar la presión del ojo. Informe a su médico si tiene enfisema.',
    })
  : '';
check(
  'label-cause-keeps-the-qualifier',
  Boolean(
    labeledCause &&
      /[aá]ngulo cerrado/i.test(labeledCause) &&
      /aumentar la presi[oó]n del ojo/i.test(labeledCause) &&
      (labeledCause.match(/no explica por qu[eé]/gi) || []).length === 1
  )
);
const sheetWarnings = selectImportantWarnings(
  [
    'CONTRAINDICACIONES Y ADVERTENCIAS: Hipersensibilidad al principio activo o a sus excipientes.',
    'Broncoespasmo.',
    'Rinitis aguda, pólipos nasales y edema angioneurótico.',
    'Reacciones alérgicas a ácido acetil-salicílico o AINEs.',
    'Úlcera péptica, sangrado gastrointestinal y antecedente de enfermedad ácido péptica.',
    'Disfunción hepática severa.',
    'PRECAUCIONES Y ADVERTENCIAS ADVERTENCIAS: Tercer trimestre de embarazo y lactancia.',
    'Insuficiencia renal grave (depuración de creatinina <30 mL/min).',
    'El uso concomitante con el ácido acetil-salicílico incrementa el riesgo de úlcera gastrointestinal y sus complicaciones.',
    'Cafeína: Puede producir insomnio y náuseas debido a irritación gastrointestinal.',
    'No administrar a pacientes con antecedentes de úlcera péptica.',
  ].join(' ')
);
check(
  'sheet-warnings-are-plain',
  sheetWarnings.some((line) => /al[eé]rgico a sus componentes/i.test(line)) &&
    sheetWarnings.filter((line) => /[uú]lcera/i.test(line)).length === 2 &&
    sheetWarnings.some((line) => /tercer trimestre del embarazo y si das pecho/i.test(line)) &&
    sheetWarnings.some((line) => /enfermedad grave del h[ií]gado/i.test(line)) &&
    sheetWarnings.every((line) => !/ADVERTENCIAS:|úlcera péptica, sangrado gastrointestinal/i.test(line)) &&
    sheetWarnings.every((line) => /[.!?]$/.test(line))
);
const pregnancyWarnings = selectImportantWarnings(
  [
    'El naproxeno puede dañar al feto y causar problemas con el parto si se toma alrededor de las 20 semanas o más tarde durante el embarazo.',
    'No tome naproxeno alrededor o después de las 20 semanas de embarazo, a menos que su médico se lo indique.',
    'Si está embarazada, planea quedar embarazada o está amamantando, informe a su médico.',
    'Puede causar úlcera o sangrado del estómago.',
  ].join(' ')
);
const brokenWarnings = selectImportantWarnings(
  [
    'No tome meloxicam con ningún otro analgésico, a menos que su médico le indique que puede hacerlo.;',
    'Informe a su médico si cualquiera de estos síntomas se vuelve severo o si no desaparece:',
    'Las personas que toman este antiinflamatorio pueden tener un riesgo más alto de sufrir un ataque cardíaco o un derrame cerebral.',
    'No use este medicamento si sufrió un ataque cardíaco recientemente, a menos que se lo indique su médico.',
    'Puede provocar úlceras, hemorragias o perforaciones en el estómago o el intestino.',
    'Informe a su médico si padece insuficiencia cardíaca o enfermedad renal.',
    'Informe a su médico y farmacéutico qué medicamentos con y sin receta médica toma.',
    'Hable con su médico sobre los riesgos si tiene 65 años o más.',
  ].join(' ')
);
check(
  'warnings-keep-punctuation-and-critical-risks',
  brokenWarnings.some((line) => /infarto o derrame/i.test(line)) &&
    brokenWarnings.some((line) => /[uú]lcera, sangrado o una perforaci[oó]n/i.test(line)) &&
    brokenWarnings.some((line) => /cu[eé]ntale a tu m[eé]dico si tienes una enfermedad de los ri[nñ]ones/i.test(line)) &&
    !brokenWarnings.some((line) => /no lo tomes si tienes una enfermedad de los ri[nñ]ones/i.test(line)) &&
    brokenWarnings.some((line) => /insuficiencia card[ií]aca/i.test(line)) &&
    brokenWarnings.every((line) => !/[;]\s*\.|:\s*$|puede hacerlo\.;/i.test(line)) &&
    brokenWarnings.every((line) => !/se vuelve severo o si no desaparece/i.test(line)) &&
    !brokenWarnings.some((line) => /65 a[nñ]os/i.test(line))
);
const meloxicamPurpose = briefMonographPurpose(
  'El meloxicam se utiliza para aliviar el dolor, la hinchazón y la rigidez causados por la osteoartritis (artritis causada por el desgaste de la articulación) y la artritis reumatoide (artritis causada por la inflamación de la articulación). También se usa para bajar la fiebre en algunos casos documentados.'
);
check(
  'long-purpose-drops-disease-definitions',
  Boolean(
    meloxicamPurpose &&
      /dolor/i.test(meloxicamPurpose) &&
      /fiebre/i.test(meloxicamPurpose) &&
      meloxicamPurpose.endsWith('.') &&
      !/desgaste de la articulaci[oó]n|artritis reumatoide|oste[oa]rtritis/i.test(meloxicamPurpose) &&
      meloxicamPurpose.length < 220
  )
);
const repeatedBleed = selectImportantWarnings(
  [
    'Los antiinflamatorios pueden provocar úlceras, hemorragias o perforaciones en el esófago, el estómago o el intestino.',
    'Puede causar úlcera, sangrado o una perforación en el estómago o el intestino.',
    'Informe a su médico si tiene insuficiencia cardíaca.',
    'No lo tomes si tienes úlcera o sangrado del estómago.',
  ].join(' ')
);
check(
  'equivalent-bleed-warnings-collapse',
  repeatedBleed.filter((line) => /[uú]lcera|hemorragia|sangrado/i.test(line)).length === 2 &&
    repeatedBleed.some((line) => /insuficiencia card[ií]aca/i.test(line)) &&
    repeatedBleed.some((line) => /no lo tomes si tienes [uú]lcera/i.test(line))
);
check(
  'organ-warning-keeps-its-severity',
  selectImportantWarnings('Insuficiencia hepática y renal.').some(
    (line) => /h[ií]gado o de los ri[nñ]ones/i.test(line) && !/grave/i.test(line)
  ) &&
    selectImportantWarnings('Disfunción hepática severa.').some((line) => /enfermedad grave del h[ií]gado/i.test(line))
);
check(
  'pregnancy-warnings-are-not-repeated',
  pregnancyWarnings.filter((line) => /embaraz/i.test(line)).length === 1 &&
    pregnancyWarnings.some((line) => /20 semanas/i.test(line) && /parto/i.test(line)) &&
    pregnancyWarnings.some((line) => /[uú]lcera|sangrado/i.test(line)) &&
    !pregnancyWarnings.some((line) => /planea quedar embarazada/i.test(line))
);

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
