import { db } from '../src/lib/db';
import { signalChunks } from '../src/lib/db/schema';

async function verifySetup() {
  try {
    console.log('[verify] Testing database connection...');
    
    // Test query
    const result = await db.select().from(signalChunks).limit(1);
    
    console.log('[verify] ✓ Database connection successful');
    console.log('[verify] ✓ signal_chunks table accessible');
    console.log('[verify] Current row count:', result.length);
    
    console.log('\n[verify] Setup verification complete!');
    console.log('[verify] Infrastructure is ready for document ingestion.');
  } catch (error) {
    console.error('[verify] Error:', error);
    process.exit(1);
  }
}

verifySetup();
