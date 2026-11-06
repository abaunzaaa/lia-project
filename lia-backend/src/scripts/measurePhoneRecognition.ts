import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { aiService } from '../services/aiService';
import { getDrugInfo } from '../services/drugReferenceService';
import { saveCameraJpeg, deleteCameraImage } from '../services/cameraImageService';

function jpegSize(buffer: Buffer): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  return null;
}

function ms(start: number): number {
  return Math.round(performance.now() - start);
}

async function timeEnrichment(): Promise<void> {
  const started = performance.now();
  await getDrugInfo({ name: 'Losartan' });
  console.log(`enrichment-losartan-cold ms=${ms(started)}`);
  const again = performance.now();
  await getDrugInfo({ name: 'Losartan' });
  console.log(`enrichment-losartan-cache ms=${ms(again)}`);
}

async function timeVision(filePath: string): Promise<void> {
  const buffer = fs.readFileSync(filePath);
  const size = jpegSize(buffer);
  console.log(
    `sample-jpeg bytes=${buffer.length} width=${size?.width ?? 0} height=${size?.height ?? 0}`
  );
  const encodeStarted = performance.now();
  const encoded = buffer.toString('base64');
  console.log(`base64 ms=${ms(encodeStarted)} chars=${encoded.length}`);

  const saveStarted = performance.now();
  const saved = await saveCameraJpeg(buffer);
  console.log(`save-jpeg ms=${ms(saveStarted)}`);
  await deleteCameraImage(saved);

  if (!aiService.isConfigured()) {
    console.log('vision skipped assistant-not-configured');
    return;
  }
  const visionStarted = performance.now();
  const vision = await aiService.recognizeFromImage(buffer);
  console.log(
    `vision ms=${ms(visionStarted)} identified=${Boolean(vision.identified)} bytes=${buffer.length}`
  );
}

async function timeCatalogStages(): Promise<void> {
  const { findRxcuiByName, getConceptProperties, getBrandNames } = await import('../services/rxNormService');
  const lookupStarted = performance.now();
  const rxcui = await findRxcuiByName('Losartan');
  console.log(`rxnorm-lookup ms=${ms(lookupStarted)} found=${Boolean(rxcui)}`);
  if (!rxcui) return;
  const sequentialStarted = performance.now();
  await getConceptProperties(rxcui);
  const afterProps = performance.now();
  await getBrandNames(rxcui);
  console.log(
    `rxnorm-props ms=${Math.round(afterProps - sequentialStarted)} brands ms=${Math.round(performance.now() - afterProps)}`
  );
}

async function main(): Promise<void> {
  const resized = path.resolve(process.cwd(), 'uploads', 'camera-measure');
  const files = fs.existsSync(resized)
    ? fs
        .readdirSync(resized)
        .filter((name) => name.endsWith('.jpg'))
        .map((name) => path.join(resized, name))
    : [];
  for (const filePath of files) {
    if (!/edge(1600|2048)-q95/.test(filePath)) continue;
    await timeVision(filePath);
  }
  await timeCatalogStages();
  await timeEnrichment();
}

main().catch((error: unknown) => {
  const name = error instanceof Error ? error.name : 'error';
  console.error(`measure-failed ${name}`);
  process.exitCode = 1;
});
