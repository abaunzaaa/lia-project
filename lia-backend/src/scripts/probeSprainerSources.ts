async function probe(label: string, url: string): Promise<void> {
  const response = await fetch(url);
  const text = await response.text();
  const compact = text.replace(/\s+/g, ' ').slice(0, 280);
  console.log(`${label} status=${response.status} body=${compact}`);
}

export async function main(): Promise<void> {
  await probe(
    'rxnorm-exact',
    'https://rxnav.nlm.nih.gov/REST/rxcui.json?name=Sprainer&search=1'
  );
  await probe(
    'dailymed-name',
    'https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?drug_name=Sprainer&pagesize=3'
  );
  await probe(
    'openfda-brand',
    `https://api.fda.gov/drug/label.json?search=${encodeURIComponent('openfda.brand_name:"Sprainer"')}&limit=1`
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.name : 'error');
  process.exitCode = 1;
});
