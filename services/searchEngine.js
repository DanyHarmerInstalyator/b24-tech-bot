// services/searchEngine.js
// Поисковый движок для документации (Яндекс.Диск + file_index.json)

// ✅ Импорт нормализатора с синонимами
const { normalizeWithSynonyms } = require('../utils/normalizer');

// ✅ Загрузка индекса файлов (кэшируется при старте)
let fileIndex = [];
try {
  fileIndex = require('../data/file_index.json');
  console.log(`📚 Загружено ${fileIndex.length} файлов в индекс поиска`);
} catch (e) {
  console.error('❌ Не удалось загрузить file_index.json:', e.message);
}

// Кэш результатов поиска (опционально, для производительности)
const searchCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

// Конфигурация Яндекс.Диска
const YANDEX_CONFIG = {
  token: process.env.YANDEX_DISK_TOKEN,
  publicKey: process.env.YANDEX_DISK_PUBLIC_KEY,
  basePath: process.env.YANDEX_DISK_FOLDER_PATH || '/8. Документация по брендам. Общая',
  apiUrl: 'https://cloud-api.yandex.net/v1/disk/public/resources'
};

// Сопоставление ключевых слов с путями на Яндекс.Диске (для мгновенных перенаправлений)
const FOLDER_REDIRECTS = {
  'кабель': '/01. iOT Systems/02. iOT Кабель',
  'cable': '/01. iOT Systems/02. iOT Кабель',
  'провода': '/01. iOT Systems/02. iOT Кабель',
  
  'замок': '/01. iOT Systems/04. iOT Замки',
  'lock': '/01. iOT Systems/04. iOT Замки',
  
  'easycool': '/01. iOT Systems/03. iOT EasyCool',
  'изикул': '/01. iOT Systems/03. iOT EasyCool',
  'кондиционер': '/01. iOT Systems/03. iOT EasyCool',
  
  'coolplug': '/01. iOT Systems/05. CoolPlug',
  'кулплаг': '/01. iOT Systems/05. CoolPlug',
  
  'урри': '/01. iOT Systems/06. URRI',
  'urri': '/01. iOT Systems/06. URRI',
  'юрии': '/01. iOT Systems/06. URRI',
  
  'алиса': '/07. Интеграции/Алиса',
  'alisa': '/07. Интеграции/Алиса',
  
  'buspro': '/02. Buspro',
  'knx': '/03. KNX',
  'hdl': '/01. iOT Systems',
  
  'документация': '/8. Документация по брендам. Общая',
  'техничка': '/8. Документация по брендам. Общая',
  'инструкция': '/8. Документация по брендам. Общая',
  'мануал': '/8. Документация по брендам. Общая',
  
  'варфрейм': '/8. Документация по брендам. Общая',
  'wireframe': '/8. Документация по брендам. Общая'
};

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
 * Строит публичную ссылку на Яндекс.Диск с правильной кодировкой
 */
function buildYandexLink(folderPath) {
  const basePath = YANDEX_CONFIG.basePath.replace(/\/$/, '');
  const cleanFolderPath = folderPath.startsWith('/') ? folderPath.substring(1) : folderPath;
  const fullPath = `${basePath}/${cleanFolderPath}`;
  
  // ✅ Кодируем каждый сегмент отдельно, сохраняя "/"
  const encodedPath = fullPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
  
  return `https://disk.360.yandex.ru/d/${YANDEX_CONFIG.publicKey}${encodedPath}`;
}

/**
 * Проверяет перенаправление на папку (мгновенный доступ)
 */
function handleFolderRedirect(query) {
  if (!query || typeof query !== 'string') return { redirect: false };
  
  const normalized = query.toLowerCase().trim();
  
  // Точное совпадение
  if (FOLDER_REDIRECTS[normalized]) {
    const url = buildYandexLink(FOLDER_REDIRECTS[normalized]);
    const name = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    return {
      redirect: true,
      type: 'single',
      message: `[📁 ${formatLinkTitle(name)}](${url})`,
      url,
      folderName: name
    };
  }
  
  // Частичное совпадение
  for (const [key, path] of Object.entries(FOLDER_REDIRECTS)) {
    if (normalized.includes(key)) {
      const url = buildYandexLink(path);
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
 * @returns {Promise<Array>} - Массив найденных файлов
 */
async function searchFiles(query) {
  // ✅ Гарантия: всегда возвращаем массив
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
    const results = fileIndex.filter(file => {
      if (!file || !file.norm_name) return false;
      
      const fileNorm = file.norm_name.toLowerCase();
      const queryNorm = normalizedQuery.toLowerCase();
      
      // Ищем вхождение запроса в norm_name ИЛИ наоборот
      return fileNorm.includes(queryNorm) || queryNorm.includes(fileNorm);
    });
    
    // 4️⃣ Форматируем результаты: добавляем кликабельные ссылки
    const formattedResults = results.map(file => {
      const url = buildYandexLink(file.path);
      return {
        name: file.name,
        url: url,
        path: file.path,
        type: file.name.endsWith('.pdf') ? 'pdf' : 'file',
        description: 'Документация'
      };
    });
    
    console.log(`📊 Найдено ${formattedResults.length} файлов`);
    
    // 5️⃣ Сохраняем в кэш
    searchCache.set(cacheKey, {
      results: formattedResults,
      timestamp: Date.now()
    });
    
    // ✅ Гарантия: возвращаем массив
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
    if (!item || !item.name) return false;
    const nameNorm = normalizeWithSynonyms(item.name).toLowerCase();
    return nameNorm.includes(normalizedNew) || normalizedNew.includes(nameNorm);
  });
  
  return filtered.length > 0 ? filtered : searchFiles(newQuery);
}

/**
 * Форматирует результаты поиска в сообщение для чата
 * ✅ Использует Markdown-формат для кликабельных ссылок
 */
function formatSearchResults(results, query) {
  // ✅ Защита: гарантируем, что results — массив
  if (!Array.isArray(results)) {
    console.warn('⚠️ formatSearchResults: получен не массив, заменяем на []');
    results = [];
  }
  
  if (results.length === 0) {
    return `❌ Ничего не найдено по запросу: *${query}*\n\nПопробуйте уточнить запрос или воспользуйтесь кнопками меню.`;
  }
  
  const limited = results.slice(0, 5);
  let response = `✅ Найдено ${results.length} результат(ов) по запросу: *${query}*\n\n`;
  
  limited.forEach((item, index) => {
    if (!item) return;
    
    const title = item.name || item.title || 'Документ';
    const url = item.url || item.link || item.href || item.path || '';
    const cleanTitle = formatLinkTitle(title);
    
    // ✅ Markdown-формат: [текст](url) — лучше поддерживается в Битрикс24
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
  formatLinkTitle,
  clearSearchCache,
  FOLDER_REDIRECTS,
  YANDEX_CONFIG
};