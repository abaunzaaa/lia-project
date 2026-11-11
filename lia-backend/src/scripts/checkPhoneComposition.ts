/**
 * Pruebas SIMULADAS del reconocimiento por la cámara del celular.
 * No envían fotografías ni consultan un modelo de visión.
 * La sección final intenta una consulta real a RxNorm y lo dice aparte.
 */
import { AiProviderError } from '../services/aiService';
import {
  acceptGroundedSheet,
  combinationSheetUrls,
  CompositionDeps,
  explainMobileRecognition,
  lookupCombinationSheets,
  lookupIngredientIdentity,
  phoneIdentityAgrees,
} from '../services/compositionRecognitionService';
import { findExactRxcuis, getConceptProperties } from '../services/rxNormService';
import { VisionRecognitionResult } from '../models/types';
import {
  commercialNameAgrees,
  displayIngredientName,
  MOBILE_PACKAGE_VISION_INSTRUCTION,
  parseListedProduct,
  parseObservedPackage,
  plainHormoneReplacement,
  plainVerifiedPurpose,
  sameFormulation,
  sameIngredient,
  withoutSalt,
} from '../services/packageObservation';

let failed = 0;

function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failed += 1;
  console.log(`[SIMULADA] ${name} ${ok ? 'OK' : 'FAIL'}${detail ? ` ${detail}` : ''}`);
}

function vision(
  name: string,
  observed: VisionRecognitionResult['observedPackage']
): VisionRecognitionResult {
  return {
    name,
    identified: true,
    confidence: 90,
    observedPackage: observed,
  };
}

const nalidixic = { rxcui: '7258', canonicalName: 'nalidixic acid' };
const phenazopyridine = { rxcui: '3321', canonicalName: 'phenazopyridine' };
const nitrofurantoin = { rxcui: '7454', canonicalName: 'nitrofurantoin' };
const acetaminophen = { rxcui: '161', canonicalName: 'acetaminophen' };
const ibuprofen = { rxcui: '5640', canonicalName: 'ibuprofen' };
const caffeine = { rxcui: '1886', canonicalName: 'caffeine' };

function deps(partial: Partial<CompositionDeps>): CompositionDeps {
  return {
    verifyIngredient: async () => null,
    monographFor: async () => null,
    listedProducts: async () => [],
    nameOnly: async () => null,
    commercialProduct: async () => null,
    ...partial,
  };
}

const instructionOk =
  /principios activos/i.test(MOBILE_PACKAGE_VISION_INSTRUCTION) &&
  /Nalixone no es naloxona/i.test(MOBILE_PACKAGE_VISION_INSTRUCTION) &&
  /No expliques para qué sirve/i.test(MOBILE_PACKAGE_VISION_INSTRUCTION) &&
  !/ESP32/.test(MOBILE_PACKAGE_VISION_INSTRUCTION);
check('instruccion-vision-movil', instructionOk);

const parsed = parseObservedPackage({
  ingredients: [
    { name: 'Ácido nalidíxico', strength: '500MG' },
    { name: 'Fenazopiridina', strength: '50 mg' },
  ],
  presentation: 'tabletas recubiertas',
  route: 'oral',
  manufacturer: 'Laboratorio',
  sanitaryRegistry: 'INVIMA 1',
});
check(
  'extraccion-estructurada',
  Boolean(
    parsed &&
      parsed.ingredients.length === 2 &&
      parsed.ingredients[0].strength === '500 mg' &&
      parsed.ingredients[1].strength === '50 mg' &&
      parsed.presentation === 'tabletas' &&
      parsed.route === 'oral'
  )
);

const sheet = parseListedProduct(
  'Sevedol Extra Fuerte tabletas. PRINCIPIO ACTIVO: ACETAMINOFEN+CAFEINA+IBUPROFENO. CONCENTRACIÓN: (250+65+400)MG. PRESENTACIÓN: CAJ X 60. INDICACIONES: Analgésico, antipirético. Úlcera péptica.',
  'Sevedol Extra Fuerte'
);
check(
  'ficha-sevedol',
  Boolean(
    sheet &&
      sheet.ingredients.length === 3 &&
      sheet.ingredients.every((item) => item.strength) &&
      sheet.presentation === 'tabletas' &&
      /analg/i.test(sheet.purpose || '')
  ),
  sheet ? `ingredients=${sheet.ingredients.map((item) => `${item.name}:${item.strength}`).join('|')}` : 'sin ficha'
);

const onlyAcetaminophen = {
  ingredients: [{ name: 'Acetaminophen', strength: '500 mg' }],
  presentation: 'tabletas',
};
check(
  'no-mezcla-formulaciones',
  parsed
    ? !sameFormulation(
        {
          ingredients: [
            { name: 'acetaminofén', strength: '250 mg' },
            { name: 'ibuprofeno', strength: '400 mg' },
            { name: 'cafeína', strength: '65 mg' },
          ],
          presentation: 'tabletas',
          route: null,
          manufacturer: null,
          sanitaryRegistry: null,
        },
        onlyAcetaminophen
      )
    : false
);

check(
  'sevedol-no-hereda-acetaminofen',
  !phoneIdentityAgrees('Sevedol Extra Fuerte', {
    name: 'Acetaminophen',
    genericName: 'Acetaminophen',
    brandNames: ['Extra Strength Acetaminophen'],
  })
);
check(
  'acetaminofen-si-coincide',
  phoneIdentityAgrees('Acetaminofén Genfar', {
    name: 'Acetaminophen',
    genericName: 'Acetaminophen',
    brandNames: [],
  })
);

const groundedWrong = acceptGroundedSheet(
  'Nalixone',
  JSON.stringify({
    found: true,
    name: 'Naloxone',
    ingredients: [{ name: 'naloxone', strength: '0.4 mg' }],
    presentation: 'solución',
    purpose: 'Revierte una sobredosis.',
    cautions: '',
    sourceName: 'fuente',
  })
);
check(
  'parecidos-no-son-el-mismo-principio',
  !sameIngredient('prednisone', 'prednisolone') &&
    !sameIngredient('vinblastine', 'vincristine') &&
    !sameIngredient('hydralazine', 'hydroxyzine') &&
    !sameIngredient('amoxicilina', 'ampicilina') &&
    !sameIngredient('sulfasalazina', 'sulfadiazina') &&
    !sameIngredient('nalixone', 'naloxone') &&
    !sameIngredient('nalixone', 'naloxona') &&
    !sameIngredient('levotiroxina', 'levothyroxine') &&
    sameIngredient('Amoxicilina', 'amoxicilina') &&
    sameIngredient('Acetaminofén', 'acetaminophen') &&
    sameIngredient('Ibuprofeno', 'ibuprofen') &&
    plainVerifiedPurpose('Tratamiento del hipotiroidismo.')?.includes('poca hormona') === true &&
    plainVerifiedPurpose('Indicado para el tratamiento de la gota.') === 'Sirve para el tratamiento de la gota.'
);
check(
  'nombre-en-minuscula',
  displayIngredientName('TIAMAZOL') === 'tiamazol' &&
    displayIngredientName('LEVOTIROXINA SÓDICA') === 'levotiroxina sódica' &&
    displayIngredientName('Vitamina B12') === 'vitamina B12' &&
    withoutSalt('levotiroxina sódica') === 'levotiroxina' &&
    withoutSalt('metformina clorhidrato') === 'metformina'
);
check(
  'hormona-solo-si-la-fuente-lo-dice',
  plainHormoneReplacement(
    'La levotiroxina se utiliza para tratar el hipotiroidismo. Su acción consiste en sustituir la hormona tiroidea que normalmente produce el cuerpo.'
  ) ===
    'Sustituye la hormona de la tiroides. Sirve sobre todo para el hipotiroidismo, cuando la tiroides produce poca hormona.' &&
    plainHormoneReplacement('Sirve para controlar la tiroides.') === null &&
    plainHormoneReplacement('Tratamiento del hipertiroidismo.') === null
);
check('rechaza-naloxona', groundedWrong === null);

check(
  'nombre-sevedol-extra-fuerte',
  commercialNameAgrees('Sevedol Extra Fuerte', 'SEVEDOL EXTRAFUERTE') &&
    commercialNameAgrees('Sevedol Extra Fuerte', 'SEVEDOL EXTRAFUERTE Tabletas') &&
    !commercialNameAgrees('Sevedol Extra Fuerte', 'SEVEDOL') &&
    !commercialNameAgrees('Sevedol Extra Fuerte', 'SEVEDOL TENSE') &&
    !commercialNameAgrees('Sevedol', 'SEVEDOL EXTRAFUERTE') &&
    commercialNameAgrees('Nalixone', 'NALIXONE') &&
    !commercialNameAgrees('Nalixone', 'Naloxona')
);

const plmSearch = `<script>var data = [{"type":"product","data":{"DivisionId":196,"CategoryId":101,"ProductId":34780,"PharmaFormId":210,"Label":"SEVEDOL EXTRAFUERTE","PharmaForm":"Tabletas"}},{"type":"product","data":{"DivisionId":196,"CategoryId":101,"ProductId":64945,"PharmaFormId":210,"Label":"SEVEDOL TENSE","PharmaForm":"Tabletas"}},{"type":"product","data":{"DivisionId":196,"CategoryId":101,"ProductId":21313,"PharmaFormId":210,"Label":"SEVEDOL®","PharmaForm":"Tabletas"}}];</script>`;
const sevedolUrls = combinationSheetUrls('Sevedol Extra Fuerte', [
  { html: plmSearch, origin: 'https://www.medicamentosplm.com.co' },
]);
check(
  'busca-solo-sevedol-extra-fuerte',
  sevedolUrls.length === 1 &&
    sevedolUrls[0] ===
      'https://www.medicamentosplm.com.co/Home/productos/sevedol_extrafuerte_tabletas/196/101/34780/210'
);

const nalixoneSearch = `<a href="https://mx.mivademecum.com/medicamento/nalixone-quimica-son-s"><strong>NALIXONE</strong></a><a href="https://mx.mivademecum.com/medicamento/naloxona-ejemplo"><strong>NALOXONA</strong></a>`;
const nalixoneUrls = combinationSheetUrls('Nalixone', [
  { html: nalixoneSearch, origin: 'https://mx.mivademecum.com' },
]);
check(
  'busca-nalixone-y-no-naloxona',
  nalixoneUrls.length === 1 && nalixoneUrls[0].includes('/medicamento/nalixone-quimica-son-s')
);

const plmSheetHtml =
  '<h1>SEVEDOL EXTRAFUERTE</h1> COMPOSICI&Oacute;N: Cada TABLETA contiene acetaminof&eacute;n 250 mg, ibuprofeno 400 mg y cafe&iacute;na 65 mg. INDICACIONES: Analg&eacute;sico, antipir&eacute;tico. Contraindicaciones: úlcera péptica e hipersensibilidad.';
const plmSheet = parseListedProduct(plmSheetHtml, 'Sevedol Extra Fuerte');
check(
  'lee-ficha-con-tildes-codificadas',
  Boolean(
    plmSheet &&
      plmSheet.ingredients.length === 3 &&
      plmSheet.presentation === 'tabletas' &&
      plainVerifiedPurpose(plmSheet.purpose || '') ===
        'Sirve para aliviar el dolor y bajar la fiebre.'
  ),
  plmSheet ? `${plmSheet.purpose}` : 'sin ficha'
);

const nalixoneSheetHtml =
  '<h1>NALIXONE</h1><h3>Composición y características</h3><p>Cada tableta contiene principios activos.</p><ul><li>Ácido nalidíxico 500 mg; Fenazopiridina clorhidrato 50 mg.</li></ul><h3>Indicaciones de uso</h3><p>Tratamiento de infecciones urinarias agudas y dolorosas.</p><p>Hipersensibilidad al ácido nalidíxico. Insuficiencia hepática.</p>';
const nalixoneSheet = parseListedProduct(nalixoneSheetHtml, 'Nalixone');
check(
  'lee-ficha-nalixone',
  Boolean(
    nalixoneSheet &&
      nalixoneSheet.ingredients.length === 2 &&
      nalixoneSheet.presentation === 'tabletas' &&
      /vías urinarias/i.test(plainVerifiedPurpose(nalixoneSheet.purpose || '') || '') &&
      !/naloxona/i.test(JSON.stringify(nalixoneSheet))
  ),
  nalixoneSheet
    ? nalixoneSheet.ingredients.map((item) => `${item.name}:${item.strength}`).join('|')
    : 'sin ficha'
);

async function runCases(): Promise<void> {
  const nalixone = await explainMobileRecognition(
    vision('Nalixone', {
      ingredients: [
        { name: 'Ácido nalidíxico', strength: '500 mg' },
        { name: 'Fenazopiridina', strength: '50 mg' },
      ],
      presentation: 'tabletas',
      route: 'oral',
      manufacturer: null,
      sanitaryRegistry: null,
    }),
    deps({
      verifyIngredient: async (lookup) => {
        if (lookup === 'nalidixic acid') return nalidixic;
        if (lookup === 'phenazopyridine') return phenazopyridine;
        if (lookup.toLowerCase() === 'naloxone') return { rxcui: '7242', canonicalName: 'naloxone' };
        return null;
      },
      monographFor: async () => {
        throw new Error('la combinación no debe consultar un solo componente');
      },
      listedProducts: async () => [
        {
          name: 'Nalixone',
          ingredients: [
            { name: 'ácido nalidíxico', strength: '500 mg' },
            { name: 'fenazopiridina', strength: '50 mg' },
          ],
          presentation: 'tabletas',
          purpose: 'Tratamiento de las infecciones urinarias agudas y dolorosas.',
          cautionText: 'Hipersensibilidad al ácido nalidíxico. Insuficiencia hepática y renal.',
          source: 'ficha del producto',
        },
      ],
    })
  );
  const nalixoneText = `${nalixone.description} ${nalixone.patientInfo && typeof nalixone.patientInfo === 'object' ? JSON.stringify(nalixone.patientInfo) : ''}`;
  check(
    'nalixone-dos-componentes',
    nalixone.compositionVerified === true &&
      /ácido nalidíxico 500 mg y fenazopiridina 50 mg/i.test(nalixoneText) &&
      /vías urinarias/i.test(nalixoneText) &&
      !/naloxona|naloxone/i.test(nalixoneText) &&
      /tabletas por vía oral/i.test(nalixoneText)
  );

  const confused = await explainMobileRecognition(
    vision('Nalixone', {
      ingredients: [{ name: 'Nalixone', strength: null }],
      presentation: 'tabletas',
      route: null,
      manufacturer: null,
      sanitaryRegistry: null,
    }),
    deps({
      verifyIngredient: async () => ({ rxcui: '7242', canonicalName: 'naloxone' }),
      monographFor: async () => ({
        purpose: 'Se usa en una sobredosis.',
        precautions: [],
        source: 'MedlinePlus',
      }),
    })
  );
  const confusedText = JSON.stringify(confused);
  check(
    'nalixone-no-se-explica-como-naloxona',
    confused.compositionVerified === false && !/sobredosis|naloxona|naloxone/i.test(confusedText)
  );

  const macrofurin = await explainMobileRecognition(
    vision('Macrofurin', {
      ingredients: [{ name: 'Nitrofurantoína', strength: '100 mg' }],
      presentation: 'cápsulas',
      route: 'oral',
      manufacturer: null,
      sanitaryRegistry: null,
    }),
    deps({
      verifyIngredient: async (lookup) => (lookup === 'nitrofurantoin' ? nitrofurantoin : null),
      monographFor: async () => ({
        purpose: 'La nitrofurantoína se usa para tratar infecciones de las vías urinarias.',
        precautions: ['No tomes más de 4000 mg. Puede oscurecer la orina.'],
        source: 'MedlinePlus',
      }),
    })
  );
  const macroText = JSON.stringify(macrofurin);
  check(
    'macrofurin-nitrofurantoina',
    macrofurin.compositionVerified === true &&
      /nitrofurantoína 100 mg/i.test(macroText) &&
      /cápsulas por vía oral/i.test(macroText) &&
      /vías urinarias/i.test(macroText) &&
      !/jarabe|50 mg|4000 mg/i.test(macroText) &&
      /empaque o tu médico/i.test(macroText)
  );

  const sevedolWrong = await explainMobileRecognition(
    vision('Sevedol Extra Fuerte', {
      ingredients: [
        { name: 'Acetaminofén', strength: '250 mg' },
        { name: 'Ibuprofeno', strength: '400 mg' },
        { name: 'Cafeína', strength: '65 mg' },
      ],
      presentation: 'tabletas',
      route: null,
      manufacturer: null,
      sanitaryRegistry: null,
    }),
    deps({
      verifyIngredient: async (lookup) => {
        if (lookup === 'acetaminophen') return acetaminophen;
        if (lookup === 'ibuprofen') return ibuprofen;
        if (lookup === 'caffeine') return caffeine;
        return null;
      },
      listedProducts: async () => [
        {
          name: 'Sevedol',
          ingredients: [{ name: 'acetaminofén', strength: '500 mg' }],
          presentation: 'tabletas',
          purpose: 'Analgésico.',
          cautionText: 'No tome más de 4 g de acetaminofén al día.',
          source: 'otra presentación',
        },
      ],
    })
  );
  const wrongText = JSON.stringify(sevedolWrong);
  check(
    'sevedol-no-usa-otra-presentacion',
    sevedolWrong.compositionVerified === true &&
      /acetaminofén 250 mg, ibuprofeno 400 mg y cafeína 65 mg/i.test(wrongText) &&
      /Confirmé los componentes, pero no encontré para qué se usa esta combinación/i.test(wrongText) &&
      !/4 g|Acetaminophen|Sigue lo que indica el empaque/i.test(wrongText)
  );

  const sevedol = await explainMobileRecognition(
    vision('Sevedol Extra Fuerte', {
      ingredients: [
        { name: 'Acetaminofén', strength: '250 mg' },
        { name: 'Ibuprofeno', strength: '400 mg' },
        { name: 'Cafeína', strength: '65 mg' },
      ],
      presentation: 'tabletas',
      route: null,
      manufacturer: null,
      sanitaryRegistry: null,
    }),
    deps({
      verifyIngredient: async (lookup) => {
        if (lookup === 'acetaminophen') return acetaminophen;
        if (lookup === 'ibuprofen') return ibuprofen;
        if (lookup === 'caffeine') return caffeine;
        return null;
      },
      monographFor: async () => {
        throw new Error('no debe explicar la combinación con la ficha de un solo componente');
      },
      listedProducts: async () => [
        {
          name: 'Sevedol Extra Fuerte',
          ingredients: [
            { name: 'acetaminofén', strength: '250 mg' },
            { name: 'cafeína', strength: '65 mg' },
            { name: 'ibuprofeno', strength: '400 mg' },
          ],
          presentation: 'tabletas',
          purpose: 'Analgésico, antipirético.',
          cautionText: 'Úlcera péptica y alergia a los antiinflamatorios.',
          source: 'Cruz Verde',
        },
      ],
    })
  );
  const sevedolText = JSON.stringify(sevedol);
  check(
    'sevedol-combinacion-verificada',
    sevedol.compositionVerified === true &&
      /acetaminofén 250 mg, ibuprofeno 400 mg y cafeína 65 mg/i.test(sevedolText) &&
      /aliviar el dolor y bajar la fiebre/i.test(sevedolText) &&
      /úlcera/i.test(sevedolText) &&
      !/Acetaminophen|4 g/i.test(sevedolText) &&
      sevedol.rxcui == null
  );

  const sevedolFromSheet = plmSheet
    ? await explainMobileRecognition(
        vision('Sevedol Extra Fuerte', {
          ingredients: [
            { name: 'Acetaminofén', strength: '250 mg' },
            { name: 'Ibuprofeno', strength: '400 mg' },
            { name: 'Cafeína', strength: '65 mg' },
          ],
          presentation: 'tabletas',
          route: null,
          manufacturer: null,
          sanitaryRegistry: null,
        }),
        deps({
          verifyIngredient: async (lookup) => {
            if (lookup === 'acetaminophen') return acetaminophen;
            if (lookup === 'ibuprofen') return ibuprofen;
            if (lookup === 'caffeine') return caffeine;
            return null;
          },
          monographFor: async () => {
            throw new Error('no debe explicar la combinación con un solo componente');
          },
          listedProducts: async () => [plmSheet],
        })
      )
    : null;
  const fromSheetText = JSON.stringify(sevedolFromSheet);
  check(
    'sevedol-desde-html-de-la-ficha',
    Boolean(
      sevedolFromSheet &&
        /aliviar el dolor y bajar la fiebre/i.test(fromSheetText) &&
        /úlcera/i.test(fromSheetText) &&
        !/Sigue lo que indica el empaque/i.test(fromSheetText) &&
        /aliviar el dolor y bajar la fiebre/i.test(sevedolFromSheet?.voiceText || '')
    )
  );

  const nalixoneFromSheet = nalixoneSheet
    ? await explainMobileRecognition(
        vision('Nalixone', {
          ingredients: [
            { name: 'Ácido nalidíxico', strength: '500 mg' },
            { name: 'Fenazopiridina', strength: '50 mg' },
          ],
          presentation: 'tabletas',
          route: 'oral',
          manufacturer: null,
          sanitaryRegistry: null,
        }),
        deps({
          verifyIngredient: async (lookup) => {
            if (lookup === 'nalidixic acid') return nalidixic;
            if (lookup === 'phenazopyridine') return phenazopyridine;
            return null;
          },
          monographFor: async () => {
            throw new Error('la combinación no debe consultar un solo componente');
          },
          listedProducts: async () => [nalixoneSheet],
        })
      )
    : null;
  const nalixoneSheetText = JSON.stringify(nalixoneFromSheet);
  check(
    'nalixone-desde-html-de-la-ficha',
    Boolean(
      nalixoneFromSheet &&
        /ácido nalidíxico 500 mg y fenazopiridina 50 mg/i.test(nalixoneSheetText) &&
        /vías urinarias/i.test(nalixoneSheetText) &&
        !/naloxona|Sigue lo que indica el empaque/i.test(nalixoneSheetText) &&
        /vías urinarias/i.test(nalixoneFromSheet?.voiceText || '')
    )
  );

  const genfar = await explainMobileRecognition(
    vision('Acetaminofén Genfar', {
      ingredients: [{ name: 'Acetaminofén', strength: '500 mg' }],
      presentation: 'tabletas',
      route: 'oral',
      manufacturer: 'Genfar',
      sanitaryRegistry: null,
    }),
    deps({
      verifyIngredient: async (lookup) => (lookup === 'acetaminophen' ? acetaminophen : null),
      monographFor: async () => ({
        purpose: 'El acetaminophen se usa para aliviar el dolor y bajar la fiebre.',
        precautions: ['La dosis máxima es 4000 mg al día.', 'Si tomas otros productos con el mismo componente, puedes pasarte.'],
        source: 'MedlinePlus',
      }),
    })
  );
  const genfarText = JSON.stringify(genfar);
  check(
    'genfar-acetaminofen-breve',
    genfar.compositionVerified === true &&
      /acetaminofén 500 mg/i.test(genfarText) &&
      /aliviar el dolor/i.test(genfarText) &&
      !/Acetaminophen|4000 mg|dosis máxima/i.test(genfarText) &&
      /empaque o tu médico/i.test(genfarText)
  );

  const lisinopril = await explainMobileRecognition(
    vision('Lisinopril Genfar', {
      ingredients: [{ name: 'Lisinopril', strength: '10 mg' }],
      presentation: 'tabletas',
      route: 'oral',
      manufacturer: null,
      sanitaryRegistry: null,
    }),
    deps({
      verifyIngredient: async (lookup) =>
        /lisinopril/i.test(lookup) ? { rxcui: '29046', canonicalName: 'lisinopril' } : null,
      monographFor: async () => ({
        purpose: 'El lisinopril se usa para tratar la presión arterial alta.',
        precautions: ['No lo tomes si estás embarazada.'],
        source: 'MedlinePlus',
      }),
    })
  );
  const lisinoprilText = JSON.stringify(lisinopril);
  check(
    'generico-fuera-del-diccionario',
    lisinopril.compositionVerified === true &&
      /lisinopril 10 mg/i.test(lisinoprilText) &&
      /presión arterial alta/i.test(lisinoprilText) &&
      /presión arterial alta/i.test(lisinopril.voiceText || '') &&
      !/No confirmé para qué se usa/i.test(lisinoprilText)
  );

  const eutirox = await explainMobileRecognition(
    vision('Eutirox', {
      ingredients: [{ name: 'LEVOTIROXINA SÓDICA', strength: '100 mcg' }],
      presentation: 'tabletas',
      route: 'oral',
      manufacturer: 'Merck',
      sanitaryRegistry: null,
    }),
    deps({
      verifyIngredient: async (lookup) =>
        lookup === 'levotiroxina' ? { rxcui: '10582', canonicalName: 'levothyroxine' } : null,
      monographFor: async () => ({
        purpose:
          'Sustituye la hormona de la tiroides. Sirve sobre todo para el hipotiroidismo, cuando la tiroides produce poca hormona.',
        precautions: ['No lo tomes si eres alérgico a alguno de sus componentes.'],
        source: 'MedlinePlus',
      }),
      commercialProduct: async () => ({
        name: 'Eutirox',
        purpose: 'controlar la tiroides',
        form: 'tabletas',
        source: 'Farmatodo',
      }),
    })
  );
  const eutiroxText = JSON.stringify(eutirox);
  check(
    'eutirox-usa-la-monografia-no-el-titulo-comercial',
    eutirox.compositionVerified === true &&
      /levotiroxina sódica 100 mcg/i.test(eutiroxText) &&
      /hipotiroidismo/i.test(eutiroxText) &&
      /hormona/i.test(eutiroxText) &&
      !/controlar la tiroides/i.test(eutiroxText) &&
      !/tIAMAZOL|TIAMAZOL/.test(eutiroxText)
  );

  const gota = await explainMobileRecognition(
    vision('Producto combinado', {
      ingredients: [
        { name: 'Alopurinol', strength: '100 mg' },
        { name: 'Probenecid', strength: '200 mg' },
      ],
      presentation: 'tabletas',
      route: 'oral',
      manufacturer: null,
      sanitaryRegistry: null,
    }),
    deps({
      verifyIngredient: async (lookup) => {
        if (/alopurinol|allopurinol/i.test(lookup)) return { rxcui: '519', canonicalName: 'allopurinol' };
        if (/probenecid/i.test(lookup)) return { rxcui: '8698', canonicalName: 'probenecid' };
        return null;
      },
      monographFor: async () => {
        throw new Error('la combinación no debe usar la ficha de un solo componente');
      },
      listedProducts: async () => [
        {
          name: 'Producto combinado',
          ingredients: [
            { name: 'allopurinol', strength: '100 mg' },
            { name: 'probenecid', strength: '200 mg' },
          ],
          presentation: 'tabletas',
          purpose: 'Indicado para el tratamiento de la gota.',
          cautionText: 'Hipersensibilidad al alopurinol.',
          source: 'ficha de la formulación',
        },
        {
          name: 'Otra formulación',
          ingredients: [
            { name: 'allopurinol', strength: '300 mg' },
            { name: 'probenecid', strength: '200 mg' },
          ],
          presentation: 'tabletas',
          purpose: 'Indicado para el tratamiento de la gota.',
          cautionText: '',
          source: 'otra concentración',
        },
      ],
    })
  );
  const gotaText = JSON.stringify(gota);
  check(
    'combinacion-nueva-solo-si-coincide',
    gota.compositionVerified === true &&
      /alopurinol 100 mg y probenecid 200 mg/i.test(gotaText) &&
      /tratamiento de la gota/i.test(gotaText) &&
      /alérgico/i.test(gotaText) &&
      !/300 mg/i.test(gotaText)
  );

  const lookalike = await explainMobileRecognition(
    vision('Parecido', {
      ingredients: [
        { name: 'Prednisone', strength: '5 mg' },
        { name: 'Cafeína', strength: '30 mg' },
      ],
      presentation: 'tabletas',
      route: 'oral',
      manufacturer: null,
      sanitaryRegistry: null,
    }),
    deps({
      verifyIngredient: async (lookup) => {
        if (/^prednisone$/i.test(lookup)) return { rxcui: '8640', canonicalName: 'prednisone' };
        if (/prednisolone/i.test(lookup)) return { rxcui: '8638', canonicalName: 'prednisolone' };
        if (lookup === 'caffeine') return caffeine;
        return null;
      },
      monographFor: async () => {
        throw new Error('la combinación no debe usar la ficha de un solo componente');
      },
      listedProducts: async () => [
        {
          name: 'Parecido',
          ingredients: [
            { name: 'prednisolone', strength: '5 mg' },
            { name: 'caffeine', strength: '30 mg' },
          ],
          presentation: 'tabletas',
          purpose: 'Indicado para el tratamiento del asma.',
          cautionText: '',
          source: 'otra sustancia',
        },
      ],
    })
  );
  const lookalikeText = JSON.stringify(lookalike);
  check(
    'parecidos-no-heredan-la-finalidad',
    lookalike.compositionVerified === true &&
      /no encontré para qué se usa esta combinación/i.test(lookalikeText) &&
      !/asma/i.test(lookalikeText)
  );

  const sprainer = await explainMobileRecognition(
    vision('Sprainer', {
      ingredients: [{ name: 'higiene de párpados', strength: null }],
      presentation: 'solución espumosa',
      route: null,
      manufacturer: null,
      sanitaryRegistry: null,
    }),
    deps({
      verifyIngredient: async () => null,
      commercialProduct: async (requested) =>
        requested === 'Sprainer'
          ? {
              name: 'Sprainer',
              purpose: 'la limpieza de párpados y pestañas',
              form: 'solución espumosa',
              source: 'Cruz Verde',
            }
          : null,
    })
  );
  const sprainerText = JSON.stringify(sprainer);
  check(
    'producto-comercial-sin-rxnorm',
    sprainer.compositionVerified === false &&
      /"genericName":null/.test(sprainerText) &&
      /"importantInformation":\[\]/.test(sprainerText) &&
      /solución espumosa/i.test(sprainerText) &&
      /limpieza de párpados y pestañas/i.test(sprainerText) &&
      /no quedó confirmada/i.test(sprainer.voiceText || '') &&
      !/naloxona|metoprolol|asma/i.test(sprainerText)
  );

  const ambiguous = await explainMobileRecognition(
    vision('Medicamento X', {
      ingredients: [{ name: 'compuesto ilegible', strength: null }],
      presentation: null,
      route: null,
      manufacturer: null,
      sanitaryRegistry: null,
    }),
    deps({
      verifyIngredient: async () => null,
    })
  );
  check(
    'composicion-ilegible',
    ambiguous.compositionVerified === false &&
      ambiguous.patientInfo == null &&
      /no quedó confirmada/i.test(ambiguous.voiceText || '') &&
      !/sirve para/i.test(JSON.stringify(ambiguous))
  );

  let quotaThrew = false;
  let quotaResult: Awaited<ReturnType<typeof explainMobileRecognition>> | null = null;
  try {
    quotaResult = await explainMobileRecognition(
      vision('Sevedol Extra Fuerte', {
        ingredients: [
          { name: 'Acetaminofén', strength: '250 mg' },
          { name: 'Ibuprofeno', strength: '400 mg' },
          { name: 'Cafeína', strength: '65 mg' },
        ],
        presentation: 'tabletas',
        route: null,
        manufacturer: null,
        sanitaryRegistry: null,
      }),
      deps({
        verifyIngredient: async (lookup) => {
          if (lookup === 'acetaminophen') return acetaminophen;
          if (lookup === 'ibuprofen') return ibuprofen;
          if (lookup === 'caffeine') return caffeine;
          return null;
        },
        listedProducts: async () => {
          throw new AiProviderError('cuota', 'http', 429, 'rate');
        },
      })
    );
  } catch {
    quotaThrew = true;
  }
  const quotaText = JSON.stringify(quotaResult);
  check(
    'cuota-429-no-inventa-utilidad',
    !quotaThrew &&
      quotaResult?.compositionVerified === true &&
      /temporalmente agotada/i.test(quotaText) &&
      !/aliviar el dolor|No confirmé para qué se usa/i.test(quotaText)
  );

  const unnamed = await explainMobileRecognition(
    { name: '', identified: false, confidence: 0, observedPackage: null },
    deps({})
  );
  check('sin-nombre', unnamed.identified === false && unnamed.patientInfo == null);
}

async function liveRxNorm(): Promise<void> {
  try {
    const nitroIds = await findExactRxcuis('nitrofurantoin');
    const nalixoneIds = await findExactRxcuis('nalixone');
    const naloxoneIds = await findExactRxcuis('naloxone');
    const nitroName = nitroIds[0] ? (await getConceptProperties(nitroIds[0]))?.name : null;
    const confused = [];
    for (const id of nalixoneIds) {
      const props = await getConceptProperties(id);
      if (props && /naloxone/i.test(props.name)) confused.push(props.name);
    }
    console.log(
      `[REAL RxNorm] nitrofurantoin ids=${nitroIds.join(',') || 'ninguno'} name=${nitroName || '-'} naloxone ids=${naloxoneIds.join(',') || 'ninguno'} nalixone ids=${nalixoneIds.join(',') || 'ninguno'}`
    );
    if (confused.length > 0) {
      failed += 1;
      console.log(`[REAL RxNorm] nalixone-no-es-naloxona FAIL ${confused.join(',')}`);
    } else {
      console.log('[REAL RxNorm] nalixone-no-es-naloxona OK');
    }
    if (!nitroIds.length) {
      console.log('[REAL RxNorm] nitrofurantoin sin resultado exacto; no se usa como fallo de la simulación');
    }
  } catch (error) {
    console.log(
      `[REAL RxNorm] no disponible ${error instanceof Error ? error.message : 'error'}`
    );
  }
}

async function liveCatalog(): Promise<void> {
  const observedSevedol = {
    ingredients: [
      { name: 'Acetaminofén', strength: '250 mg' },
      { name: 'Ibuprofeno', strength: '400 mg' },
      { name: 'Cafeína', strength: '65 mg' },
    ],
    presentation: 'tabletas',
    route: null,
    manufacturer: null,
    sanitaryRegistry: null,
  };
  const observedNalixone = {
    ingredients: [
      { name: 'Ácido nalidíxico', strength: '500 mg' },
      { name: 'Fenazopiridina', strength: '50 mg' },
    ],
    presentation: 'tabletas',
    route: 'oral',
    manufacturer: null,
    sanitaryRegistry: null,
  };
  try {
    const sheets = await lookupCombinationSheets('Sevedol Extra Fuerte');
    const match = sheets.find(
      (item) =>
        Boolean(item.purpose && plainVerifiedPurpose(item.purpose)) &&
        sameFormulation(observedSevedol, item)
    );
    if (sheets.length === 0) {
      console.log(
        '[REAL catálogo] Sevedol Extra Fuerte: la consulta no devolvió fichas. No se inventó una indicación.'
      );
    } else if (!match) {
      failed += 1;
      console.log(
        `[REAL catálogo] Sevedol Extra Fuerte FAIL fichas=${sheets
          .map(
            (item) =>
              `${item.source} presentacion=${item.presentation || '-'} finalidad=${item.purpose || '-'} ${item.ingredients
                .map((ingredient) => `${ingredient.name}:${ingredient.strength || '-'}`)
                .join(', ')}`
          )
          .join(' || ')}`
      );
    } else {
      console.log(
        `[REAL catálogo] Sevedol Extra Fuerte OK ${plainVerifiedPurpose(match.purpose || '')} fuente=${match.source}`
      );
    }
  } catch (error) {
    console.log(
      `[REAL catálogo] Sevedol Extra Fuerte no disponible ${error instanceof Error ? error.message : 'error'}`
    );
  }
  try {
    const sheets = await lookupCombinationSheets('Nalixone');
    const match = sheets.find(
      (item) =>
        Boolean(item.purpose && plainVerifiedPurpose(item.purpose)) &&
        sameFormulation(observedNalixone, item) &&
        !/naloxona|naloxone/i.test(`${item.name} ${item.purpose || ''}`)
    );
    const confused = sheets.some((item) => /naloxona|naloxone/i.test(`${item.name} ${item.source}`));
    if (confused) {
      failed += 1;
      console.log('[REAL catálogo] Nalixone FAIL se confundió con naloxona');
    } else if (sheets.length === 0) {
      console.log(
        '[REAL catálogo] Nalixone: la consulta no devolvió fichas. Se conserva la incertidumbre y no se inventa la indicación.'
      );
    } else if (!match) {
      failed += 1;
      console.log(
        `[REAL catálogo] Nalixone FAIL fichas=${sheets
          .map(
            (item) =>
              `${item.source} presentacion=${item.presentation || '-'} finalidad=${item.purpose || '-'} ${item.ingredients
                .map((ingredient) => `${ingredient.name}:${ingredient.strength || '-'}`)
                .join(', ')}`
          )
          .join(' || ')}`
      );
    } else {
      console.log(
        `[REAL catálogo] Nalixone OK ${plainVerifiedPurpose(match.purpose || '')} fuente=${match.source}`
      );
    }
  } catch (error) {
    console.log(
      `[REAL catálogo] Nalixone no disponible ${error instanceof Error ? error.message : 'error'}`
    );
  }
}

async function liveIdentity(): Promise<void> {
  const expected: Array<[string, RegExp]> = [
    ['amoxicilina', /amoxicillin/i],
    ['ibuprofeno', /ibuprofen/i],
    ['tiamazol', /methimazole|thiamazole/i],
    ['paracetamol', /acetaminophen/i],
    ['metformina clorhidrato', /metformin/i],
  ];
  for (const [name, pattern] of expected) {
    try {
      const found = await lookupIngredientIdentity(name);
      const exactIds = new Set([
        ...(await findExactRxcuis(name)),
        ...(await findExactRxcuis(withoutSalt(name))),
      ]);
      if (!found) {
        console.log(`[REAL identidad] ${name}: sin concepto confirmado. No se inventa una equivalencia.`);
      } else if (!exactIds.has(found.rxcui) || !pattern.test(found.canonicalName)) {
        failed += 1;
        console.log(
          `[REAL identidad] ${name} FAIL ${found.canonicalName} rxcui=${found.rxcui} exactos=${[...exactIds].join(',') || 'ninguno'}`
        );
      } else {
        console.log(`[REAL identidad] ${name} OK ${found.canonicalName} rxcui=${found.rxcui}`);
      }
    } catch (error) {
      console.log(`[REAL identidad] ${name} no disponible ${error instanceof Error ? error.message : 'error'}`);
    }
  }
  try {
    const found = await lookupIngredientIdentity('levotiroxina sódica');
    if (!found) {
      console.log('[REAL identidad] levotiroxina sódica: sin identificador farmacológico. No se usa el parecido de letras.');
    } else if (!/^levothyroxine$/i.test(found.canonicalName)) {
      failed += 1;
      console.log(`[REAL identidad] levotiroxina sódica FAIL ${found.canonicalName} rxcui=${found.rxcui}`);
    } else {
      console.log(`[REAL identidad] levotiroxina sódica OK ${found.canonicalName} rxcui=${found.rxcui}`);
    }
  } catch (error) {
    console.log(
      `[REAL identidad] levotiroxina sódica no disponible ${error instanceof Error ? error.message : 'error'}`
    );
  }
  const lookalikes: Array<[string, string]> = [
    ['prednisone', 'prednisolone'],
    ['vinblastine', 'vincristine'],
    ['hydralazine', 'hydroxyzine'],
    ['amoxicillin', 'ampicillin'],
    ['sulfasalazine', 'sulfadiazine'],
  ];
  for (const [left, right] of lookalikes) {
    try {
      const first = await lookupIngredientIdentity(left);
      const second = await lookupIngredientIdentity(right);
      if (sameIngredient(left, right) || (first && second && first.rxcui === second.rxcui)) {
        failed += 1;
        console.log(
          `[REAL identidad] ${left}/${right} FAIL mismo concepto ${first?.canonicalName || '-'} / ${second?.canonicalName || '-'}`
        );
      } else {
        console.log(
          `[REAL identidad] ${left}/${right} OK distintos ${first?.rxcui || 'sin id'} / ${second?.rxcui || 'sin id'}`
        );
      }
    } catch (error) {
      console.log(
        `[REAL identidad] ${left}/${right} no disponible ${error instanceof Error ? error.message : 'error'}`
      );
    }
  }
  try {
    const confused = await lookupIngredientIdentity('nalixone');
    if (confused) {
      failed += 1;
      console.log(`[REAL identidad] nalixone FAIL se resolvió como ${confused.canonicalName}`);
    } else {
      console.log('[REAL identidad] nalixone OK sin equivalencia');
    }
  } catch (error) {
    console.log(`[REAL identidad] nalixone no disponible ${error instanceof Error ? error.message : 'error'}`);
  }
  try {
    const explained = await explainMobileRecognition(
      vision('Amoxicilina', {
        ingredients: [{ name: 'Amoxicilina', strength: '500 mg' }],
        presentation: 'cápsulas',
        route: 'oral',
        manufacturer: null,
        sanitaryRegistry: null,
      })
    );
    const text = `${explained.voiceText || ''} ${JSON.stringify(explained.patientInfo || {})}`;
    if (/naloxona|ibuprofeno|hipotiroidismo/i.test(text)) {
      failed += 1;
      console.log('[REAL explicación] amoxicilina FAIL se mezcló con otro medicamento');
    } else if (/bacterias|infecci/i.test(text)) {
      console.log('[REAL explicación] amoxicilina OK finalidad de su principio activo');
    } else {
      console.log(
        `[REAL explicación] amoxicilina sin finalidad verificada. ${explained.patientInfo && typeof explained.patientInfo === 'object' && 'purpose' in explained.patientInfo ? String(explained.patientInfo.purpose || '') : 'sin ficha'}`
      );
    }
  } catch (error) {
    console.log(`[REAL explicación] amoxicilina no disponible ${error instanceof Error ? error.message : 'error'}`);
  }
  for (const sample of [
    {
      name: 'Thyrozol',
      ingredient: 'Tiamazol',
      strength: '10 mg',
      presentation: 'tabletas',
      useful: /hipertiroidismo|tiroides/i,
      wrong: /hipotiroidismo|naloxona/i,
    },
  ]) {
    try {
      const explained = await explainMobileRecognition(
        vision(sample.name, {
          ingredients: [{ name: sample.ingredient, strength: sample.strength }],
          presentation: sample.presentation,
          route: 'oral',
          manufacturer: null,
          sanitaryRegistry: null,
        })
      );
      const text = `${explained.voiceText || ''} ${JSON.stringify(explained.patientInfo || {})}`;
      if (sample.wrong.test(text)) {
        failed += 1;
        console.log(`[REAL explicación] ${sample.name} FAIL se mezcló con otro uso`);
      } else if (sample.useful.test(text)) {
        console.log(`[REAL explicación] ${sample.name} OK ${sample.ingredient}`);
      } else {
        console.log(`[REAL explicación] ${sample.name} sin finalidad verificada`);
      }
    } catch (error) {
      console.log(`[REAL explicación] ${sample.name} no disponible ${error instanceof Error ? error.message : 'error'}`);
    }
  }
  try {
    const explained = await explainMobileRecognition(
      vision('Eutirox', {
        ingredients: [{ name: 'Levotiroxina sódica', strength: '100 mcg' }],
        presentation: 'tabletas',
        route: 'oral',
        manufacturer: 'Merck',
        sanitaryRegistry: null,
      })
    );
    const text = `${explained.voiceText || ''} ${JSON.stringify(explained.patientInfo || {})}`;
    if (/naloxona|hipertiroidismo|liotironina/i.test(text)) {
      failed += 1;
      console.log('[REAL explicación] Eutirox FAIL se mezcló con otro uso');
    } else if (!explained.compositionVerified || !/levotiroxina sódica 100 mcg/i.test(text)) {
      failed += 1;
      console.log('[REAL explicación] Eutirox FAIL no confirmó levotiroxina sódica 100 mcg');
    } else if (!/hipotiroidismo/i.test(text) || !/hormona/i.test(text)) {
      failed += 1;
      console.log(`[REAL explicación] Eutirox FAIL finalidad incompleta ${text.slice(0, 220)}`);
    } else if (/controlar la tiroides/i.test(text)) {
      failed += 1;
      console.log('[REAL explicación] Eutirox FAIL conservó la finalidad comercial vaga');
    } else {
      console.log('[REAL explicación] Eutirox OK levotiroxina sódica 100 mcg');
    }
  } catch (error) {
    console.log(`[REAL explicación] Eutirox no disponible ${error instanceof Error ? error.message : 'error'}`);
  }
  for (const reading of [
    {
      label: 'solo nombre',
      ingredients: [] as Array<{ name: string; strength: string | null }>,
    },
    {
      label: 'texto no farmacológico',
      ingredients: [{ name: 'higiene de párpados', strength: null }],
    },
  ]) {
    try {
      const explained = await explainMobileRecognition(
        vision('Sprainer', {
          ingredients: reading.ingredients,
          presentation: 'solución espumosa',
          route: null,
          manufacturer: null,
          sanitaryRegistry: null,
        })
      );
      const text = `${explained.voiceText || ''} ${JSON.stringify(explained.patientInfo || {})}`;
      const info =
        explained.patientInfo && typeof explained.patientInfo === 'object'
          ? (explained.patientInfo as { importantInformation?: unknown }).importantInformation
          : [];
      const precautions = Array.isArray(info) ? info : [];
      if (/naloxona|metoprolol|amoxicilina|principio activo:/i.test(text) || explained.compositionVerified) {
        failed += 1;
        console.log(`[REAL comercial] Sprainer ${reading.label} FAIL inventó composición o tomó otro medicamento`);
      } else if (/párpados|pestañas/i.test(text) && precautions.length === 0) {
        console.log(`[REAL comercial] Sprainer ${reading.label} OK solución de limpieza, sin composición inventada`);
      } else {
        console.log(
          `[REAL comercial] Sprainer ${reading.label}: el catálogo no devolvió la finalidad del mismo producto. No se inventó.`
        );
      }
    } catch (error) {
      console.log(
        `[REAL comercial] Sprainer ${reading.label} no disponible ${error instanceof Error ? error.message : 'error'}`
      );
    }
  }
  for (const brand of ['Eutirox', 'Thyrozol', 'Sprainer']) {
    try {
      const sheets = await lookupCombinationSheets(brand);
      const lines = sheets.map(
        (item) =>
          `${item.source}: ${plainVerifiedPurpose(item.purpose || '') || 'sin finalidad usable'} [${item.ingredients
            .map((ingredient) => `${ingredient.name} ${ingredient.strength || ''}`.trim())
            .join(', ')}]`
      );
      console.log(`[REAL marca] ${brand}: ${lines.join(' || ') || 'sin ficha. No se inventa la finalidad.'}`);
    } catch (error) {
      console.log(`[REAL marca] ${brand} no disponible ${error instanceof Error ? error.message : 'error'}`);
    }
  }
}

runCases()
  .then(liveRxNorm)
  .then(liveIdentity)
  .then(liveCatalog)
  .then(() => {
    if (failed > 0) {
      console.log(`[SIMULADA] resultado FAIL casos=${failed}`);
      process.exit(1);
    }
    console.log('[SIMULADA] resultado OK');
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
