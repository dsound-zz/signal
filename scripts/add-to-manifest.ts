// scripts/add-to-manifest.ts
// Usage: npx dotenv-cli -e .env.local -- tsx scripts/add-to-manifest.ts

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import * as readline from 'readline';
import { join } from 'path';

const MANIFEST_PATH = 'scripts/corpus-manifest.json';
const PDFS_DIR = './pdfs';

const SOURCE_TYPES = [
  'government_report',
  'congressional_testimony',
  'foia_document',
  'scientific_paper',
  'investigative_journalism',
  'witness_account',
] as const;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function askWithDefault(question: string, defaultValue: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(`${question} (default: ${defaultValue}): `, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

async function pickFile(): Promise<string | null> {
  const files = readdirSync(PDFS_DIR).filter(
    (f) => f.endsWith('.pdf') || f.endsWith('.txt')
  );

  if (files.length === 0) {
    console.log('No PDF or TXT files found in ./pdfs/');
    return null;
  }

  console.log('\nFiles in ./pdfs/:\n');
  files.forEach((f, i) => console.log(`  [${i + 1}] ${f}`));
  console.log(`  [0] Enter a pdfUrl instead (remote download)\n`);

  const choice = await ask('Select file number (or 0 for URL): ');
  const index = parseInt(choice) - 1;

  if (choice === '0') return null;
  if (index >= 0 && index < files.length) return files[index];

  console.log('Invalid selection.');
  return null;
}

async function pickSourceType(): Promise<string> {
  console.log('\nSource types:\n');
  SOURCE_TYPES.forEach((t, i) => console.log(`  [${i + 1}] ${t}`));

  const choice = await ask('\nSelect source type: ');
  const index = parseInt(choice) - 1;

  if (index >= 0 && index < SOURCE_TYPES.length) {
    return SOURCE_TYPES[index];
  }

  console.log('Invalid — defaulting to government_report');
  return 'government_report';
}

async function pickTier(): Promise<1 | 2 | 3> {
  console.log('\nCredibility tiers:');
  console.log('  [1] Tier 1 — Official government/scientific report');
  console.log('  [2] Tier 2 — Congressional testimony, FOIA, investigative');
  console.log('  [3] Tier 3 — Witness account, contested, secondary source\n');

  const choice = await ask('Select tier (1/2/3): ');
  if (['1', '2', '3'].includes(choice)) return parseInt(choice) as 1 | 2 | 3;

  console.log('Invalid — defaulting to 2');
  return 2;
}

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  SIGNAL — Add Document to Corpus');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));

  let localPath: string | undefined;
  let pdfUrl: string | undefined;

  const selectedFile = await pickFile();

  if (selectedFile) {
    localPath = `pdfs/${selectedFile}`;
    console.log(`\n✓ Selected: ${localPath}`);
  } else {
    pdfUrl = await ask('Enter PDF URL: ');
  }

  const sourceTitle = await ask('\nDocument title: ');

  // Check for duplicates
  const exists = manifest.find((e: any) => e.sourceTitle === sourceTitle);
  if (exists) {
    console.log(`\n⚠ "${sourceTitle}" is already in the manifest. Aborting.`);
    rl.close();
    return;
  }

  const sourceType = await pickSourceType();
  const tier = await pickTier();
  const docDate = await askWithDefault('\nDocument date (YYYY-MM-DD)', '2024-01-01');
  const declassifiedInput = await askWithDefault('Declassified? (y/n)', 'y');
  const declassified = declassifiedInput.toLowerCase() === 'y';
  const sourceUrl = await ask('Source URL (for citation, press enter to skip): ');

  const entry: any = {
    ...(localPath ? { localPath } : { pdfUrl }),
    sourceTitle,
    sourceUrl: sourceUrl || (pdfUrl ?? undefined),
    sourceType,
    credibilityTier: tier,
    docDate,
    declassified,
  };

  // Clean up undefined values
  Object.keys(entry).forEach((k) => entry[k] === undefined && delete entry[k]);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  New entry:\n');
  console.log(JSON.stringify(entry, null, 2));
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const confirm = await ask('\nAdd to manifest? (y/n): ');
  if (confirm.toLowerCase() === 'y') {
    manifest.push(entry);
    writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    console.log(`\n✓ Added "${sourceTitle}" to corpus-manifest.json`);
    console.log('  Run: npm run db:ingest:batch\n');
  } else {
    console.log('\n✗ Cancelled — nothing written.\n');
  }

  rl.close();
}

main();