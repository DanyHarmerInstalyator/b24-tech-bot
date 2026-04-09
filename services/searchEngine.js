// services/searchEngine.js
// Поисковый движок: file_index.json + нормализация + динамические ссылки

// ✅ Импорт нормализатора с синонимами
const { normalizeWithSynonyms } = require('../utils/normalizer');

// ✅ Загрузка индекса файлов
let fileIndex = [];
try {
  fileIndex = require('../data/file_index.json');
  console.log(`📚 Загружено ${fileIndex.length} файлов в индекс поиска`);
} catch (e) {
  console.error('❌ Не удалось загрузить file_index.json:', e.message);
}

// Кэш поиска
const searchCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

// ✅ Маппинг: префикс пути → publicKey Яндекс.Диска
// Добавьте сюда все папки, у которых свой ключ
const FOLDER_KEYS = {
  '/01. iOT Systems/02. iOT Кабель': 'xJi6eEXBTq01sw',
  '/01. iOT Systems/03. iOT EasyCool': 'EuWsEkI__LPmIQ',  // ✅ Ваша рабочая ссылка для easycool
  '/01. iOT Systems/04. iOT Замки': '...',
  '/01. iOT Systems/05. CoolPlug': '...',
  '/01. iOT Systems/06. URRI': '...',
  '/01. iOT Systems/07. Интеграции/Алиса': '...',
  '/02. Buspro': '...',
  '/03. KNX': '...',
  '/04. Matech': '...',
  '/05. Yeelight': '...',
  '/06. DALI': '...',
  '/07. Интеграции': '...',
  '/08. Документация по брендам. Общая': 'zL7GKQgcMMkcJg',  // Дефолтный ключ для общей папки
  '/10. URRI. Плееры, ресиверы': '...'
};

// Дефолтный publicKey (если путь не найден в маппинге)
const DEFAULT_PUBLIC_KEY = process.env.YANDEX_DISK_PUBLIC_KEY || 'zL7GKQgcMMkcJg';

// Домен Яндекс.Диска (проверьте, какой используется у вас)
const YANDEX_DOMAIN = 'disk.360.yandex.ru'; // или 'disk.yandex.ru'

/**
 * 🔍 Находит publicKey для пути файла
 * Ищет наиболее длинное совпадение префикса
 */
function getPublicKeyForPath(filePath) {
  if (!filePath) return DEFAULT_PUBLIC_KEY;
  
  // Сортируем ключи по длине (сначала самые длинные) для точного совпадения
  const sortedPrefixes = Object.keys(FOLDER_KEYS).sort((a, b) => b.length - a.length);
  
  for (const prefix of sortedPrefixes) {
    if (filePath.startsWith(prefix)) {
      console.log(`🔑 publicKey для "${filePath}": ${FOLDER_KEYS[prefix]} (по префиксу "${prefix}")`);
      return FOLDER_KEYS[prefix];
    }
  }
  
  console.log(`⚠️ Не найден publicKey для "${filePath}", используем дефолтный: ${DEFAULT_PUBLIC_KEY}`);
  return DEFAULT_PUBLIC_KEY;
}

/**
 * ✅ Строит рабочую ссылку на Яндекс.Диск с правильным publicKey и кодировкой
 */
function buildYandexLink(filePath, fileName = null) {
  // Определяем publicKey по пути
  const publicKey = getPublicKeyForPath(filePath);
  
  // Кодируем путь: каждый сегмент отдельно, сохраняя "/"
  const encodedPath = filePath.split('/').map(segment => encodeURIComponent(segment)).join('/');
  
  // Если есть имя файла — добавляем его в конец
  const filePart = fileName ? '/' + encodeURIComponent(fileName) : '';
  
  const url = `https://${YANDEX_DOMAIN}/d/${publicKey}${encodedPath}${filePart}`;
  
  // 🔍 Отладочный лог (можно закомментировать в продакшене)
  console.log(`🔗 Сгенерирована ссылка: ${url}`);
  
  return url;
}

/**
 * Форматирует название файла для красивой ссылки
 */
function formatLinkTitle(title) {
  if (!title) return 'Документ';
  
  let clean = String(title);
  clean = clean.replace(/\.[a-zA-Z0-9]+$/, ''); // Убираем расширение
  try { clean = decodeURIComponent(clean); } catch (e) {}
  
  clean = clean
    .replace(/\s+/g, ' ')
    .replace(/^\d+\.\s*/, '')
    .replace(/^[\d\.\-\s]+/, '')
    .trim();
  
  // Убираем дублирующиеся префиксы
  const prefixes = ['iOT Systems', 'iOT', 'Документация'];
  for (const prefix of prefixes) {
    if (clean.startsWith(prefix) && clean.length > prefix.length + 5) {
      clean = clean.substring(prefix.length).replace(/^[\s\-\/]*/, '').trim();
      break;
    }
  }
  
  if (clean.length > 50) clean = clean.substring(0, 47) + '...';
  return clean || 'Документ';
}

/**
 * Быстрые перенаправления на папки (готовые ссылки для частых запросов)
 */
const QUICK_REDIRECTS = {
  'easycool': 'https://disk.360.yandex.ru/d/EuWsEkI__LPmIQ',
  'изикул': 'https://disk.360.yandex.ru/d/EuWsEkI__LPmIQ',
  'кабель': 'https://disk.360.yandex.ru/d/xJi6eEXBTq01sw/01.%20iOT%20Systems/02.%20iOT%20Кабель',
  'урри': 'https://disk.360.yandex.ru/d/...', // ← добавьте вашу ссылку
  'алиса': 'https://disk.360.yandex.ru/d/...'  // ← добавьте вашу ссылку
};

/**
 * Проверяет перенаправление на папку (быстрый доступ)
 */
function handleFolderRedirect(query) {
  if (!query || typeof query !== 'string') return { redirect: false };
  
  const normalized = query.toLowerCase().trim();
  
  // Проверяем быстрые перенаправления
  if (QUICK_REDIRECTS[normalized]) {
    const url = QUICK_REDIRECTS[normalized];
    const name = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    
    return {
      redirect: true,
      type: 'single',
      message: `[📁 ${formatLinkTitle(name)}](${url})`,
      url,
      folderName: name
    };
  }
  
  // Частичное совпадение по ключевым словам
  for (const [key, url] of Object.entries(QUICK_REDIRECTS)) {
    if (normalized.includes(key)) {
      const name = key.charAt(0).toUpperCase() + key.slice(1);
      return {
        redirect: true,
        type: 'single',
        message: `[📁 ${formatLinkTitle(name)}](${url})`,
        url,
        folderName: name
      };
    }
  }
  
  return { redirect: false };
}

/**
 * 🔍 Поиск по file_index.json с использованием нормализации
 * @param {string} query - Поисковый запрос пользователя
 * @returns {Promise<Array>} - Массив найденных файлов с ссылками
 */
async function searchFiles(query) {
  if (!query || typeof query !== 'string' || fileIndex.length === 0) {
    console.log('⚠️ searchFiles: пустой запрос или индекс не загружен');
    return [];
  }
  
  try {
    // 1️⃣ Нормализуем запрос через синонимы
    const normalizedQuery = normalizeWithSynonyms(query);
    console.log(`🔍 Поиск: "${query}" → нормализовано: "${normalizedQuery}"`);
    
    // 2️⃣ Проверяем кэш
    const cacheKey = `search:${normalizedQuery}`;
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('📦 Возвращаем из кэша');
      return Array.isArray(cached.results) ? cached.results : [];
    }
    
    // 3️⃣ Поиск по индексу: сравниваем norm_name с запросом
    const queryLower = normalizedQuery.toLowerCase().trim();
    
    const results = fileIndex.filter(file => {
      if (!file || !file.norm_name) return false;
      
      const fileNorm = file.norm_name.toLowerCase();
      
      // Ищем вхождение: запрос в norm_name ИЛИ norm_name в запросе
      // Это позволяет найти "urri" в "urrimanual" и наоборот
      return fileNorm.includes(queryLower) || queryLower.includes(fileNorm);
    });
    
    console.log(`📊 Найдено ${results.length} файлов по norm_name`);
    
    // 4️⃣ Форматируем результаты: добавляем кликабельные ссылки
    const formattedResults = results.map(file => {
      // ✅ Генерируем ссылку с правильным publicKey для пути файла
      const url = buildYandexLink(file.path, file.name);
      
      return {
        name: file.name,
        url: url,
        path: file.path,
        norm_name: file.norm_name,
        type: file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'file',
        description: 'Документация'
      };
    });
    
    // 5️⃣ Сохраняем в кэш
    searchCache.set(cacheKey, {
      results: formattedResults,
      timestamp: Date.now()
    });
    
    return Array.isArray(formattedResults) ? formattedResults : [];
    
  } catch (error) {
    console.error('❌ Ошибка в searchFiles:', error);
    return [];
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
    if (!item || !item.norm_name) return false;
    const itemNorm = item.norm_name.toLowerCase();
    return itemNorm.includes(normalizedNew) || normalizedNew.includes(itemNorm);
  });
  
  return filtered.length > 0 ? filtered : searchFiles(newQuery);
}

/**
 * Форматирует результаты поиска в сообщение для чата
 * ✅ Использует Markdown-формат: [текст](url)
 */
function formatSearchResults(results, query) {
  // ✅ Защита: гарантируем массив
  if (!Array.isArray(results)) {
    console.warn('⚠️ formatSearchResults: получен не массив');
    results = [];
  }
  
  if (results.length === 0) {
    return `❌ Ничего не найдено по запросу: *${query}*\n\nПопробуйте уточнить запрос или воспользуйтесь кнопками меню.`;
  }
  
  const limited = results.slice(0, 5);
  let response = `✅ Найдено ${results.length} результат(ов) по запросу: *${query}*\n\n`;
  
  limited.forEach((item, index) => {
    if (!item) return;
    
    const title = item.name || 'Документ';
    const url = item.url || '';
    const cleanTitle = formatLinkTitle(title);
    
    // ✅ Markdown-ссылка для Битрикс24
    const linkDisplay = url 
      ? `[📁 ${cleanTitle}](${url})` 
      : `📁 ${cleanTitle} (ссылка недоступна)`;
    
    response += `${index + 1}. ${linkDisplay}\n`;
    
    if (item.description) {
      response += `   _${item.description}_\n`;
    }
  });
  
  if (results.length > 5) {
    response += `\n... и ещё ${results.length - 5} результат(ов). Напишите \`/more\` для продолжения.`;
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
  buildYandexLink,
  getPublicKeyForPath,
  formatLinkTitle,
  clearSearchCache,
  FOLDER_KEYS,
  QUICK_REDIRECTS
};