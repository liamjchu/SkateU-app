import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createInterface } from 'node:readline';

const DEFAULT_CSV_PATH = 'all_us_schools.csv';
const DEFAULT_BATCH_SIZE = 1000;
const REQUIRED_COLUMNS = ['name', 'city', 'state', 'latitude', 'longitude', 'type'];
const VALID_TYPES = new Set(['k12_public', 'k12_private', 'higher_ed']);

const args = parseArgs(process.argv.slice(2));
const csvPath = args.csv ?? DEFAULT_CSV_PATH;
const batchSize = Number(args.batchSize ?? DEFAULT_BATCH_SIZE);
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.');
}

if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5000) {
  throw new Error('--batch-size must be an integer between 1 and 5000.');
}

await assertReadable(csvPath);

let insertedCount = 0;
let skippedCount = 0;
let batch = [];

for await (const row of readCsv(csvPath)) {
  const school = mapRowToSchool(row);

  if (!school) {
    skippedCount += 1;
    continue;
  }

  batch.push(school);

  if (batch.length >= batchSize) {
    await insertBatch(batch);
    insertedCount += batch.length;
    console.log(`Inserted ${insertedCount.toLocaleString()} schools...`);
    batch = [];
  }
}

if (batch.length > 0) {
  await insertBatch(batch);
  insertedCount += batch.length;
}

console.log(
  `Done. Inserted ${insertedCount.toLocaleString()} schools. Skipped ${skippedCount.toLocaleString()} invalid rows.`
);

function parseArgs(values) {
  const parsed = {};

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (value === '--csv') {
      parsed.csv = values[index + 1];
      index += 1;
    } else if (value === '--batch-size') {
      parsed.batchSize = values[index + 1];
      index += 1;
    }
  }

  return parsed;
}

async function assertReadable(path) {
  try {
    await stat(path);
  } catch {
    throw new Error(`CSV file not found: ${path}`);
  }
}

async function* readCsv(path) {
  const lines = createInterface({
    input: createReadStream(path, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let headers = null;

  for await (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    if (!headers) {
      headers = parseCsvLine(line).map((header) => header.trim().toLowerCase());
      validateHeaders(headers);
      continue;
    }

    const values = parseCsvLine(line);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() ?? '';
    });

    yield row;
  }
}

function validateHeaders(headers) {
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));

  if (missingColumns.length > 0) {
    throw new Error(
      `CSV is missing required columns: ${missingColumns.join(', ')}. The schools table requires coordinates.`
    );
  }
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let isQuoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && isQuoted && nextChar === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      isQuoted = !isQuoted;
    } else if (char === ',' && !isQuoted) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function mapRowToSchool(row) {
  const name = row.name?.trim();
  const city = row.city?.trim();
  const state = row.state?.trim().toUpperCase();
  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);
  const type = row.type?.trim();

  if (
    !name ||
    !city ||
    !state ||
    !VALID_TYPES.has(type) ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return {
    name,
    city,
    state,
    latitude,
    longitude,
    numspots: 0,
    type,
  };
}

async function insertBatch(rows) {
  const response = await fetch(`${supabaseUrl}/rest/v1/schools`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(rows),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Failed to insert batch: ${response.status} ${message}`);
  }
}
