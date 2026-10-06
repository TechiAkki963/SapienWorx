// The Go-embedded contract is canonical. Keep frontend builds self-contained.
import {readFile,writeFile} from 'node:fs/promises';
const canonical=new URL('../backend/internal/candidate/profile_contract.json',import.meta.url);
const target=new URL('../frontend/lib/profile-contract.json',import.meta.url);
const source=await readFile(canonical,'utf8');
if(process.argv.includes('--check')){if(await readFile(target,'utf8')!==source)throw new Error('Profile validation contract drift; run node scripts/sync-profile-contract.mjs');console.log('Profile validation contracts match.');}
else{await writeFile(target,source);console.log('Frontend profile validation contract synchronized.');}
