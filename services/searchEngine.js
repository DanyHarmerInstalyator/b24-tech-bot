// services/searchEngine.js

const { normalizeWithSynonyms } = require('../utils/normalizer');
const { expandSynonyms } = require('../data/synonyms');
const { shouldRedirectToFolder, getBothCurtains, getBothAC } = require('../data/folderLinks');
const fs = require('fs');
const path = require('path');

let fileIndexCache = null;
let lastLoadTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 минут кеш

// Загрузка индекса файлов
function loadFileIndex() {
  const now = Date.now();
  
  if (fileIndexCache && (now - lastLoadTime) < CACHE_TTL) {
    return fileIndexCache;
  }
  
  try {
    const indexPath = path.join(process.cwd(), 'data', 'file_index.json');
    const data = fs.readFileSync(indexPath, 'utf8');
    let fileIndex = JSON.parse(data);
    
    if (!Array.isArray(fileIndex)) {
      fileIndex = Object.values(fileIndex);
    }
    
    console.log(`✅ Загружено ${fileIndex.length} записей из индекса`);
    fileIndexCache = fileIndex;
    lastLoadTime = now;
    return fileIndexCache;
  } catch (error) {
    console.error('❌ Ошибка загрузки индекса:', error);
    return [];
  }
}

// Вычисление релевантности
function calculateRelevance(item, queryWords, normQuery) {
  let relevance = 0;
  
  const normName = (item.norm_name || '').toLowerCase();
  const name = (item.name || '').toLowerCase();
  const path = (item.path || '').toLowerCase();
  
  if (normName === normQuery) {
    relevance += 100;
  }
  
  for (const word of queryWords) {
    if (normName.includes(word)) {
      relevance += 20;
    }
    if (name.includes(word)) {
      relevance += 10;
    }
    if (path.includes(word)) {
      relevance += 5;
    }
  }
  
  if (normName.includes(normQuery)) {
    relevance += 30;
  }
  if (name.includes(normQuery)) {
    relevance += 15;
  }
  
  const brands = ['hdl', 'buspro', 'urri', 'matech', 'easycool', 'coolplug', 'yeelight'];
  for (const brand of brands) {
    if (normQuery.includes(brand) && normName.includes(brand)) {
      relevance += 25;
    }
  }
  
  return relevance;
}

// Основной поиск
function searchFiles(query, limit = 10) {
  if (!query || query.trim().length === 0) {
    console.log('⚠️ Пустой запрос');
    return [];
  }
  
  console.log(`🔍 Поиск: "${query}"`);
  
  let normalizedQuery = normalizeWithSynonyms(query);
  console.log(`📝 Нормализовано: "${normalizedQuery}"`);
  
  let expandedQuery = expandSynonyms(normalizedQuery);
  if (expandedQuery !== normalizedQuery) {
    console.log(`🔄 Расширено: "${expandedQuery}"`);
  }
  
  const queryWords = expandedQuery.split(/\s+/).filter(w => w.length > 1);
  if (queryWords.length === 0) {
    return [];
  }
  
  const fileIndex = loadFileIndex();
  if (fileIndex.length === 0) {
    return [];
  }
  
  const results = fileIndex.map(item => ({
    ...item,
    relevance: calculateRelevance(item, queryWords, expandedQuery)
  }));
  
  const relevantResults = results
    .filter(item => item.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);
  
  console.log(`✅ Найдено ${relevantResults.length} результатов`);
  return relevantResults;
}

// Поиск с контекстом
function searchWithContext(query, previousQuery, previousResults) {
  if (previousResults && previousResults.length > 0 && previousResults.length < 5) {
    const normQuery = normalizeWithSynonyms(query);
    const filtered = previousResults.filter(item => {
      const normName = (item.norm_name || '').toLowerCase();
      return normName.includes(normQuery) || 
             (item.name || '').toLowerCase().includes(normQuery);
    });
    
    if (filtered.length > 0) {
      return filtered;
    }
  }
  
  return searchFiles(query);
}

// Получение ссылки на файл
function getFileLink(filePath) {
  const baseUrl = 'https://disk.360.yandex.ru/d/xJi6eEXBTq01sw';
  let cleanPath = filePath
    .replace(/^\/+/, '')
    .replace(/\[|\]/g, '');
  
  const encodedPath = encodeURIComponent(cleanPath).replace(/%2F/g, '/');
  return `${baseUrl}/${encodedPath}`;
}

// Форматирование результатов
function formatSearchResults(results, query) {
  if (!results || results.length === 0) {
    return `🔍 По запросу "${query}" ничего не найдено.\n\nПопробуйте:\n• Уточнить запрос\n• Использовать ключевые слова (кабель, замок, easycool)\n• Связаться со специалистом`;
  }
  
  let response = `📋 *Результаты поиска по запросу:* "${query}"\n\n`;
  response += `Найдено документов: ${results.length}\n\n`;
  
  for (let i = 0; i < Math.min(results.length, 5); i++) {
    const file = results[i];
    const relevanceStars = file.relevance > 80 ? '⭐⭐⭐' : file.relevance > 50 ? '⭐⭐' : '⭐';
    
    response += `${i + 1}. ${relevanceStars} *${file.name || file.norm_name || 'Документ'}*\n`;
    if (file.norm_name && file.norm_name !== file.name) {
      response += `   🏷️ ${file.norm_name}\n`;
    }
    response += `   🔗 [Скачать](${getFileLink(file.path)})\n\n`;
  }
  
  if (results.length > 5) {
    response += `_... и еще ${results.length - 5} документов_\n\n`;
  }
  
  response += `\n📌 *Подсказка:* Если не нашли нужное, уточните запрос или обратитесь к специалисту.`;
  
  return response;
}

// Обработка перенаправлений
function handleFolderRedirect(query) {
  const lowerQuery = query.toLowerCase().trim();
  console.log(`📁 Проверка перенаправления для: "${lowerQuery}"`);
  
  // Специальные случаи
  if (lowerQuery.includes('карниз')) {
    if (lowerQuery.includes('buspro') || lowerQuery.includes('баспро')) {
      return { 
        redirect: true, 
        multiple: false,
        link: getBothCurtains()[0].link,
        message: `📁 *Карнизы Buspro*\n${getBothCurtains()[0].link}`
      };
    } else if (lowerQuery.includes('knx') || lowerQuery.includes('кникс')) {
      return { 
        redirect: true, 
        multiple: false,
        link: getBothCurtains()[1].link,
        message: `📁 *Карнизы KNX*\n${getBothCurtains()[1].link}`
      };
    } else {
      return {
        redirect: true,
        multiple: true,
        message: `🎯 *Найдено несколько категорий:*\n\n${getBothCurtains().map(c => `${c.name}\n${c.link}`).join('\n\n')}`,
        buttons: [
          { text: "Buspro", command: "curtain_buspro" },
          { text: "KNX", command: "curtain_knx" }
        ]
      };
    }
  }
  
  if (lowerQuery.includes('кондиционер')) {
    if (lowerQuery.includes('easycool')) {
      return { 
        redirect: true, 
        multiple: false,
        link: getBothAC()[0].link,
        message: `📁 *Кондиционеры EasyCool*\n${getBothAC()[0].link}`
      };
    } else if (lowerQuery.includes('coolautomation')) {
      return { 
        redirect: true, 
        multiple: false,
        link: getBothAC()[1].link,
        message: `📁 *Кондиционеры CoolAutomation*\n${getBothAC()[1].link}`
      };
    } else {
      return {
        redirect: true,
        multiple: true,
        message: `🎯 *Найдено несколько категорий:*\n\n${getBothAC().map(c => `${c.name}\n${c.link}`).join('\n\n')}`,
        buttons: [
          { text: "EasyCool", command: "ac_easycool" },
          { text: "CoolAutomation", command: "ac_coolauto" }
        ]
      };
    }
  }
  
  // Обычная проверка через folderLinks
  const redirect = shouldRedirectToFolder(query);
  if (redirect.redirect) {
    console.log(`✅ Перенаправление на: ${redirect.link}`);
    return {
      redirect: true,
      multiple: false,
      link: redirect.link,
      message: `📁 *Категория:* ${query}\n\n🔗 ${redirect.link}`
    };
  }
  
  console.log(`❌ Нет перенаправления для: "${lowerQuery}"`);
  return { redirect: false };
}

module.exports = {
  loadFileIndex,
  searchFiles,
  searchWithContext,
  getFileLink,
  formatSearchResults,
  handleFolderRedirect
};