import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const filePath = path.join(process.cwd(), 'public', 'data', 'pokemon_sets.json');
  
  try {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const sets = JSON.parse(fileContents);

    return NextResponse.json({
      sets,
      total: sets.length
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load sets' }, { status: 500 });
  }
}
