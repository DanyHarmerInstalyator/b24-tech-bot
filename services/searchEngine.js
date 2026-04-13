// services/searchEngine.js
// Поисковый движок: API Яндекс.Диска + локальный индекс (fallback)

// Импорт нормализатора с синонимами
const { normalizeWithSynonyms } = require('../utils/normalizer');

// Импорт API Яндекс.Диска
const { searchPublicFiles, getDownloadLink } = require('./yandexDisk');

// Загрузка локального индекса (fallback)
let fileIndex = [];
try {
  fileIndex = require('../data/file_index.json');
  console.log(`📚 Загружено ${fileIndex.length} файлов в локальный индекс (fallback)`);
} catch (e) {
  console.error('❌ Не удалось загрузить file_index.json:', e.message);
}

// Кэш поиска
const searchCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

// Домен Яндекс.Диска
const YANDEX_DOMAIN = 'disk.360.yandex.ru';

// Быстрые перенаправления на папки (готовые ссылки для частых запросов)
const QUICK_REDIRECTS = {
  'easycool': 'https://disk.360.yandex.ru/d/EuWsEkI__LPmIQ',
  'изикул': 'https://disk.360.yandex.ru/d/EuWsEkI__LPmIQ',
  'кабель': 'https://disk.360.yandex.ru/d/xJi6eEXBTq01sw/01.%20iOT%20Systems/02.%20iOT%20%D0%9A%D0%B0%D0%B1%D0%B5%D0%BB%D1%8C',
  'замок': 'https://disk.360.yandex.ru/d/xJi6eEXBTq01sw/01.%20iOT%20Systems/04.%20%D0%94%D0%B2%D0%B5%D1%80%D0%BD%D1%8B%D0%B5%20%D0%B7%D0%B0%D0%BC%D0%BA%D0%B8%20iOT%20Systems',
  'coolplug': 'https://disk.360.yandex.ru/d/xJi6eEXBTq01sw/03.%20Coolautomation/3.%20CooLink%20Hub%20%26%20Coolplug',
  'кулплаг': 'https://disk.360.yandex.ru/d/xJi6eEXBTq01sw/03.%20Coolautomation/3.%20CooLink%20Hub%20%26%20Coolplug',
  'алиса': 'https://disk.360.yandex.ru/d/xJi6eEXBTq01sw/02.%20HDL/09.%20%D0%98%D0%BD%D1%82%D0%B5%D0%B3%D1%80%D0%B0%D1%86%D0%B8%D1%8F%20%D1%81%20%D0%B3%D0%BE%D0%BB%D0%BE%D1%81%D0%BE%D0%B2%D1%8B%D0%BC%D0%B8%20%D0%B0%D1%81%D1%81%D0%B8%D1%81%D1%82%D0%B5%D0%BD%D1%82%D0%B0%D0%BC%D0%B8.%20Buspro%20%D0%B8%20KNX',
  'алисой': 'https://disk.360.yandex.ru/d/xJi6eEXBTq01sw/02.%20HDL/09.%20%D0%98%D0%BD%D1%82%D0%B5%D0%B3%D1%80%D0%B0%D1%86%D0%B8%D1%8F%20%D1%81%20%D0%B3%D0%BE%D0%BB%D0%BE%D1%81%D0%BE%D0%B2%D1%8B%D0%BC%D0%B8%20%D0%B0%D1%81%D1%81%D0%B8%D1%81%D1%82%D0%B5%D0%BD%D1%82%D0%B0%D0%BC%D0%B8.%20Buspro%20%D0%B8%20KNX',
  'карниз buspro': 'https://disk.360.yandex.ru/d/20Q51Ey5rDMXqA',
  'карниз knx': 'https://disk.360.yandex.ru/d/x1w6XEUthCgTVg'
};

/**
 * Форматирует название файла для красивой ссылки
 */
function formatLinkTitle(title) {
  if (!title) return 'Документ';
  
  let clean = String(title);
  clean = clean.replace(/\.[a-zA-Z0-9]+$/, '');
  try { clean = decodeURIComponent(clean); } catch (e) {}
  
  clean = clean
    .replace(/\s+/g, ' ')
    .replace(/^\d+\.\s*/, '')
    .replace(/^[\d\.\-\s]+/, '')
    .trim();
  
  if (clean.length > 50) clean = clean.substring(0, 47) + '...';
  return clean || 'Документ';
}

/**
 * Проверяет перенаправление на папку (быстрый доступ)
 */
function handleFolderRedirect(query) {
  if (!query || typeof query !== 'string') return { redirect: false };
  
  const normalized = query.toLowerCase().trim();
  
  // Точное совпадение
  if (QUICK_REDIRECTS[normalized]) {
    const url = QUICK_REDIRECTS[normalized];
    const name = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    
    return {
      redirect: true,
      type: 'single',
      message: `📁 **${formatLinkTitle(name)}**\n\n[Открыть папку на Яндекс.Диске](${url})`,
      url,
      folderName: name
    };
  }
  
  // Частичное совпадение
  for (const [key, url] of Object.entries(QUICK_REDIRECTS)) {
    if (normalized.includes(key)) {
      const name = key.charAt(0).toUpperCase() + key.slice(1);
      return {
        redirect: true,
        type: 'single',
        message: `📁 **${formatLinkTitle(name)}**\n\n[Открыть папку на Яндекс.Диске](${url})`,
        url,
        folderName: name
      };
    }
  }
  
  return { redirect: false };
}

/**
 * Поиск в локальном индексе (FALLBACK)
 */
function searchLocalIndex(query) {
  if (!query || fileIndex.length === 0) {
    console.log('⚠️ searchLocalIndex: пустой запрос или индекс не загружен');
    return [];
  }
  
  const normalizedQuery = normalizeWithSynonyms(query).toLowerCase();
  const cacheKey = `local:${normalizedQuery}`;
  
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('📦 searchLocalIndex: возвращаем из кэша');
    return cached.results;
  }
  
  console.log(`🔍 Поиск в локальном индексе: "${normalizedQuery}"`);
  
  const results = fileIndex.filter(file => {
    if (!file || !file.norm_name) return false;
    const fileNorm = file.norm_name.toLowerCase();
    return fileNorm.includes(normalizedQuery);
  });
  
  console.log(`📊 Локальный индекс: найдено ${results.length} файлов`);
  
  // Для локального индекса генерируем ссылку (неидеально, но работает как fallback)
  const formattedResults = results.slice(0, 15).map(file => {
    const encodedPath = file.path.split('/').map(seg => encodeURIComponent(seg)).join('/');
    const fallbackUrl = `https://${YANDEX_DOMAIN}/d/${process.env.YANDEX_DISK_PUBLIC_KEY || ''}${encodedPath}`;
    
    return {
      name: file.name,
      url: fallbackUrl,
      path: file.path,
      norm_name: file.norm_name,
      type: 'file',
      description: 'Документация (из локального индекса)'
    };
  });
  
  searchCache.set(cacheKey, {
    results: formattedResults,
    timestamp: Date.now()
  });
  
  return formattedResults;
}

/**
 * 🔍 ОСНОВНАЯ ФУНКЦИЯ ПОИСКА
 * Сначала ищет через API Яндекс.Диска, потом fallback на локальный индекс
 */
async function searchFiles(query) {
  if (!query || typeof query !== 'string') {
    console.log('⚠️ searchFiles: пустой запрос');
    return [];
  }
  
  const normalizedQuery = normalizeWithSynonyms(query);
  console.log(`🔍 Поиск: "${query}" → нормализовано: "${normalizedQuery}"`);
  
  // Проверяем кэш основного поиска
  const cacheKey = `search:${normalizedQuery}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('📦 searchFiles: возвращаем из кэша');
    return cached.results;
  }
  
  try {
    // 1️⃣ Пытаемся найти через API Яндекс.Диска
    console.log('📡 Поиск через API Яндекс.Диска...');
    const diskResults = await searchPublicFiles(normalizedQuery, 15);
    
    if (diskResults && diskResults.length > 0) {
      console.log(`✅ API Диска: найдено ${diskResults.length} файлов`);
      
      const formattedResults = diskResults.map(item => ({
        name: item.name,
        url: item.downloadUrl,
        path: item.path,
        type: item.type,
        description: '📄 Документация'
      }));
      
      // Сохраняем в кэш
      searchCache.set(cacheKey, {
        results: formattedResults,
        timestamp: Date.now()
      });
      
      return formattedResults;
    }
    
    // 2️⃣ Fallback: поиск в локальном индексе
    console.log('⚠️ На Диске не найдено, ищем в локальном индексе...');
    const localResults = searchLocalIndex(query);
    
    // Сохраняем в кэш даже fallback результаты
    searchCache.set(cacheKey, {
      results: localResults,
      timestamp: Date.now()
    });
    
    return localResults;
    
  } catch (error) {
    console.error('❌ Ошибка в searchFiles:', error);
    // При любой ошибке используем локальный индекс
    return searchLocalIndex(query);
  }
}

/**
 * Поиск с учётом контекста предыдущего запроса
 */
function searchWithContext(newQuery, prevQuery, prevResults) {
  console.log(`🔍 Поиск в контексте: "${prevQuery}" + "${newQuery}"`);
  
  if (!Array.isArray(prevResults) || prevResults.length === 0) {
    return searchFiles(newQuery);
  }
  
  const normalizedNew = normalizeWithSynonyms(newQuery).toLowerCase();
  
  const filtered = prevResults.filter(item => {
    if (!item || !item.name) return false;
    const itemName = item.name.toLowerCase();
    return itemName.includes(normalizedNew);
  });
  
  if (filtered.length > 0) {
    console.log(`✅ Контекстный поиск: найдено ${filtered.length} файлов`);
    return filtered;
  }
  
  // Если ничего не найдено в контексте - обычный поиск
  return searchFiles(newQuery);
}

/**
 * Форматирует результаты поиска в сообщение для чата
 */
function formatSearchResults(results, query) {
  if (!Array.isArray(results)) {
    console.warn('⚠️ formatSearchResults: получен не массив');
    results = [];
  }
  
  if (results.length === 0) {
    return `❌ **Ничего не найдено** по запросу: *${query}*\n\n` +
      `Попробуйте:\n` +
      `• Уточнить запрос (например: "easycool техничка")\n` +
      `• Использовать /categories для выбора категории\n` +
      `• Написать /transfer для связи со специалистом`;
  }
  
  const limited = results.slice(0, 5);
  let response = `✅ **Найдено ${results.length} результат(ов)** по запросу: *${query}*\n\n`;
  
  limited.forEach((item, index) => {
    if (!item) return;
    
    const title = item.name || 'Документ';
    const url = item.url || '';
    const cleanTitle = formatLinkTitle(title);
    
    if (url) {
      response += `${index + 1}. [📄 ${cleanTitle}](${url})\n`;
    } else {
      response += `${index + 1}. 📄 ${cleanTitle}\n`;
    }
    
    if (item.description) {
      response += `   _${item.description}_\n`;
    }
  });
  
  if (results.length > 5) {
    response += `\n_... и ещё ${results.length - 5} результат(ов). Напишите /more для продолжения._`;
  }
  
  return response;
}

/**
 * Очищает кэш поиска
 */
function clearSearchCache() {
  searchCache.clear();
  console.log('🗑️ Кэш поиска очищен');
}

module.exports = {
  searchFiles,
  formatSearchResults,
  handleFolderRedirect,
  searchWithContext,
  formatLinkTitle,
  clearSearchCache,
  QUICK_REDIRECTS
};