import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Batch translate missing vocabulary using Azure OpenAI (gpt-4o-mini)
 * Requires AZURE_OPENAI_KEY environment variable
 */

const AZURE_OPENAI_ENDPOINT = 'https://lab-oai-ext-je.openai.azure.com/openai/deployments/gpt-4o-mini/chat/completions?api-version=2025-01-01-preview';
const AZURE_OPENAI_KEY = process.env.AZURE_OPENAI_KEY;

if (!AZURE_OPENAI_KEY) {
  console.error('❌ Error: AZURE_OPENAI_KEY environment variable not set');
  console.log('');
  console.log('Set it with:');
  console.log('  $env:AZURE_OPENAI_KEY="<your-key>"');
  console.log('Then run: node scripts/batch-translate.js');
  process.exit(1);
}

async function translateBatch(words, targetLang) {
  const langNames = {
    zh: 'Simplified Chinese',
    ja: 'Japanese'
  };
  
  const prompt = `Translate these Korean words to ${langNames[targetLang]}. Return ONLY a JSON array of translations in the same order, nothing else.

Korean words:
${words.map((w, i) => `${i + 1}. ${w.word} (${w.translations.en})`).join('\n')}

Example output format:
["translation1", "translation2", "translation3"]`;

  try {
    const response = await fetch(AZURE_OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': AZURE_OPENAI_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'You are a professional Korean-Chinese-Japanese translator. Provide accurate, natural translations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }
    
    const content = data.choices[0].message.content.trim();
    
    // Extract JSON array from response
    const jsonMatch = content.match(/\[.*\]/s);
    if (!jsonMatch) {
      console.warn('⚠️  Could not parse response:', content);
      return words.map(() => null);
    }
    
    const translations = JSON.parse(jsonMatch[0]);
    return translations;
    
  } catch (error) {
    console.error(`❌ Translation error: ${error.message}`);
    return words.map(() => null);
  }
}

async function batchTranslate(vocabFile, targetLangs = ['zh', 'ja'], batchSize = 20) {
  console.log(`📖 Reading vocabulary file: ${vocabFile}`);
  const vocab = JSON.parse(fs.readFileSync(vocabFile, 'utf-8'));
  
  let totalTranslated = 0;
  
  for (const lang of targetLangs) {
    console.log(`\n🌐 Translating to ${lang.toUpperCase()}...`);
    
    // Find words missing this translation
    const needTranslation = vocab.filter(w => 
      !w.translations[lang] || 
      w.translations[lang] === w.translations.en
    );
    
    if (needTranslation.length === 0) {
      console.log(`  ✅ All words already have ${lang.toUpperCase()} translations`);
      continue;
    }
    
    console.log(`  Found ${needTranslation.length} words needing translation`);
    
    // Process in batches
    for (let i = 0; i < needTranslation.length; i += batchSize) {
      const batch = needTranslation.slice(i, i + batchSize);
      process.stdout.write(`  Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(needTranslation.length / batchSize)}... `);
      
      const translations = await translateBatch(batch, lang);
      
      // Apply translations
      let successCount = 0;
      batch.forEach((word, index) => {
        if (translations[index]) {
          word.translations[lang] = translations[index];
          successCount++;
        }
      });
      
      console.log(`✅ ${successCount}/${batch.length} translated`);
      totalTranslated += successCount;
      
      // Small delay to avoid rate limits
      if (i + batchSize < needTranslation.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  // Save updated vocabulary
  const outputPath = vocabFile.replace('.json', '-translated.json');
  fs.writeFileSync(outputPath, JSON.stringify(vocab, null, 2), 'utf-8');
  
  console.log('');
  console.log('📊 Translation Complete!');
  console.log(`  Total translations added: ${totalTranslated}`);
  console.log(`  Output saved to: ${outputPath}`);
  console.log('');
  console.log('💡 Review the translations and then:');
  console.log(`  Move-Item "${outputPath}" "${vocabFile}" -Force`);
}

// Main execution
if (process.argv.includes('--help')) {
  console.log('Usage: node batch-translate.js [vocab-file] [options]');
  console.log('');
  console.log('Options:');
  console.log('  --langs zh,ja    Languages to translate (default: zh,ja)');
  console.log('  --batch 20       Batch size (default: 20)');
  console.log('  --help           Show this help');
  console.log('');
  console.log('Environment:');
  console.log('  AZURE_OPENAI_KEY   Your Azure OpenAI key (required)');
  console.log('');
  console.log('Example:');
  console.log('  $env:AZURE_OPENAI_KEY="<your-key>"');
  console.log('  node scripts/batch-translate.js src/assets/topik-vocab.json');
  process.exit(0);
}

const defaultVocabPath = path.join(__dirname, '..', 'src', 'assets', 'topik-vocab.json');
const vocabFile = process.argv[2] || defaultVocabPath;

const langsIndex = process.argv.indexOf('--langs');
const targetLangs = langsIndex !== -1 
  ? process.argv[langsIndex + 1].split(',') 
  : ['zh', 'ja'];

const batchIndex = process.argv.indexOf('--batch');
const batchSize = batchIndex !== -1 
  ? parseInt(process.argv[batchIndex + 1]) 
  : 20;

batchTranslate(vocabFile, targetLangs, batchSize);
