// services/searchEngine.js
// Поисковый движок для документации (Яндекс.Диск + локальный поиск)

// ✅ Импорт функции нормализации с синонимами
const { normalizeWithSynonyms } = require('../data/synonyms');

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

// Сопоставление ключевых слов с путями на Яндекс.Диске
const FOLDER_REDIRECTS = {
  'кабель': '/01. iOT Systems/02. iOT Кабель',
  'cable': '/01. iOT Systems/02. iOT Кабель',
  'провода': '/01. iOT Systems/02. iOT Кабель',
  
  'замок': '/01. iOT Systems/04. iOT Замки',
  'lock': '/01. iOT Systems/04. iOT Замки',
  'дверной': '/01. iOT Systems/04. iOT Замки',
  
  'easycool': '/01. iOT Systems/03. iOT EasyCool',
  'изикул': '/01. iOT Systems/03. iOT EasyCool',
  'easy cool': '/01. iOT Systems/03. iOT EasyCool',
  'кондиционер': '/01. iOT Systems/03. iOT EasyCool',
  
  'coolplug': '/01. iOT Systems/05. CoolPlug',
  'кулплаг': '/01. iOT Systems/05. CoolPlug',
  'кулплуг': '/01. iOT Systems/05. CoolPlug',
  'розетка': '/01. iOT Systems/05. CoolPlug',
  
  'урри': '/01. iOT Systems/06. URRI',
  'urri': '/01. iOT Systems/06. URRI',
  'юрии': '/01. iOT Systems/06. URRI',
  
  'алиса': '/07. Интеграции/Алиса',
  'alisa': '/07. Интеграции/Алиса',
  'яндекс': '/07. Интеграции/Алиса',
  'голосовой': '/07. Интеграции/Алиса',
  
  'buspro': '/02. Buspro',
  'баспро': '/02. Buspro',
  
  'knx': '/03. KNX',
  'кникс': '/03. KNX',
  
  'hdl': '/01. iOT Systems',
  'хдл': '/01. iOT Systems',
  
  'matech': '/04. Matech',
  'матек': '/04. Matech',
  
  'yeelight': '/05. Yeelight',
  'йилайт': '/05. Yeelight',
  
  'dali': '/06. DALI',
  'дайли': '/06. DALI',
  
  'документация': '/8. Документация по брендам. Общая',
  'техничка': '/8. Документация по брендам. Общая',
  'инструкция': '/8. Документация по брендам. Общая',
  'мануал': '/8. Документация по брендам. Общая'
};

/**
 * Форматирует название файла/папки для красивой ссылки
 * @param {string} title - Исходное название
 * @returns {string} - Очищенное название
 */
function formatLinkTitle(title) {
  if (!title) return 'Документ';
  
  let clean = String(title);
  
  // Убираем расширение файла
  clean = clean.replace(/\.[a-zA-Z0-9]+$/, '');
  
  // Декодируем проценты (если есть)
  try {
    clean = decodeURIComponent(clean);
  } catch (e) {
    // Если декодирование не удалось — оставляем как есть
  }
  
  // Убираем лишние пробелы и спецсимволы
  clean = clean
    .replace(/\s+/g, ' ')           // Несколько пробелов → один
    .replace(/^\d+\.\s*/, '')       // Убираем "01. ", "02. " в начале
    .replace(/^[\d\.\-\s]+/, '')    // Убираем ведущие цифры и точки
    .trim();
  
  // Убираем префиксы папок, если они дублируются
  const prefixes = ['iOT Systems', 'iOT', 'Документация'];
  for (const prefix of prefixes) {
    if (clean.startsWith(prefix) && clean.length > prefix.length + 5) {
      clean = clean.substring(prefix.length).replace(/^[\s\-\/]*/, '').trim();
      break;
    }
  }
  
  // Ограничиваем длину
  if (clean.length > 50) {
    clean = clean.substring(0, 47) + '...';
  }
  
  return clean || 'Документ';
}

/**
 * Строит публичную ссылку на Яндекс.Диск
 * @param {string} folderPath - Путь к папке
 * @returns {string} - Публичная ссылка
 */
function buildYandexLink(folderPath) {
  const basePath = YANDEX_CONFIG.basePath.replace(/\/$/, '');
  const fullPath = `${basePath}${folderPath}`;
  
  // Кодируем путь для URL
  const encodedPath = encodeURIComponent(fullPath);
  
  // Формируем ссылку на публичную папку
  return `https://disk.360.yandex.ru/d/${YANDEX_CONFIG.publicKey}${encodedPath}`;
}

/**
 * Проверяет перенаправление на папку по ключевому слову
 * @param {string} query - Поисковый запрос
 * @returns {Object} - Результат проверки
 */
function handleFolderRedirect(query) {
  if (!query || typeof query !== 'string') {
    return { redirect: false };
  }
  
  const normalized = query.toLowerCase().trim();
  
  // Проверяем точное совпадение
  if (FOLDER_REDIRECTS[normalized]) {
    const folderPath = FOLDER_REDIRECTS[normalized];
    const url = buildYandexLink(folderPath);
    const folderName = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    const cleanName = formatLinkTitle(folderName);
    
    console.log(`✅ Точное совпадение: ${url}`);
    
    // ✅ BBCode-формат для Битрикс24: [url=...]Текст[/url]
    return {
      redirect: true,
      type: 'single',
      message: `[url=${url}]📁 ${cleanName}[/url]`,
      url: url,
      folderName: folderName
    };
  }
  
  // Проверяем частичное совпадение (содержит ключевое слово)
  for (const [key, path] of Object.entries(FOLDER_REDIRECTS)) {
    if (normalized.includes(key)) {
      const url = buildYandexLink(path);
      const displayName = key.charAt(0).toUpperCase() + key.slice(1);
      const cleanName = formatLinkTitle(displayName);
      
      console.log(`✅ Частичное совпадение "${key}": ${url}`);
      
      // ✅ BBCode-формат для Битрикс24
      return {
        redirect: true,
        type: 'single',
        message: `[url=${url}]📁 ${cleanName}[/url]`,
        url: url,
        folderName: displayName
      };
    }
  }
  
  console.log(`❌ Нет перенаправления для: "${normalized}"`);
  return { redirect: false };
}

/**
 * Поиск файлов на Яндекс.Диске (заглушка — заменить на реальный API)
 * @param {string} query - Поисковый запрос
 * @returns {Array} - Массив результатов
 */
async function searchFiles(query) {
  if (!query || typeof query !== 'string') {
    return [];
  }
  
  // Нормализуем запрос через синонимы
  const normalizedQuery = normalizeWithSynonyms(query);
  console.log(`🔍 Поиск: "${query}" → нормализовано: "${normalizedQuery}"`);
  
  // Проверяем кэш
  const cacheKey = `search:${normalizedQuery}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('📦 Возвращаем из кэша');
    return cached.results;
  }
  
  // 🔧 Заглушка: возвращаем тестовые данные
  // В продакшене здесь должен быть вызов Яндекс.Диск API
  const mockResults = [
    {
      name: `${normalizedQuery} - инструкция.pdf`,
      url: `https://disk.360.yandex.ru/d/${YANDEX_CONFIG.publicKey}/docs/${encodeURIComponent(normalizedQuery)}/manual.pdf`,
      type: 'file',
      description: 'Техническая документация'
    },
    {
      name: `${normalizedQuery} - тех. паспорт`,
      url: `https://disk.360.yandex.ru/d/${YANDEX_CONFIG.publicKey}/docs/${encodeURIComponent(normalizedQuery)}/passport.pdf`,
      type: 'file',
      description: 'Паспорт изделия'
    },
    {
      name: `${normalizedQuery} - схема подключения`,
      url: `https://disk.360.yandex.ru/d/${YANDEX_CONFIG.publicKey}/docs/${encodeURIComponent(normalizedQuery)}/scheme.pdf`,
      type: 'file',
      description: 'Схема монтажа'
    }
  ];
  
  // Сохраняем в кэш
  searchCache.set(cacheKey, {
    results: mockResults,
    timestamp: Date.now()
  });
  
  return mockResults;
}

/**
 * Поиск с учётом контекста предыдущего запроса
 * @param {string} newQuery - Новый запрос
 * @param {string} prevQuery - Предыдущий запрос
 * @param {Array} prevResults - Предыдущие результаты
 * @returns {Array} - Отфильтрованные результаты
 */
function searchWithContext(newQuery, prevQuery, prevResults) {
  console.log(`🔍 Поиск в контексте: "${prevQuery}" + "${newQuery}"`);
  
  if (!prevResults || prevResults.length === 0) {
    return searchFiles(newQuery);
  }
  
  // Фильтруем предыдущие результаты по новому запросу
  const filtered = prevResults.filter(item => {
    const name = (item.name || '').toLowerCase();
    const desc = (item.description || '').toLowerCase();
    const search = newQuery.toLowerCase();
    
    return name.includes(search) || desc.includes(search);
  });
  
  console.log(`📊 Найдено в контексте: ${filtered.length}`);
  return filtered.length > 0 ? filtered : searchFiles(newQuery);
}

/**
 * Форматирует результаты поиска в сообщение для чата
 * ✅ Использует BBCode-формат Битрикс24 для кликабельных ссылок
 * @param {Array} results - Массив результатов
 * @param {string} query - Исходный запрос
 * @returns {string} - Отформатированное сообщение
 */
function formatSearchResults(results, query) {
  if (!results || results.length === 0) {
    return `❌ Ничего не найдено по запросу: *${query}*\n\nПопробуйте уточнить запрос или воспользуйтесь кнопками меню.`;
  }
  
  // Берем первые 5 результатов
  const limited = results.slice(0, 5);
  
  // Формируем ответ
  let response = `✅ Найдено ${results.length} результат(ов) по запросу: *${query}*\n\n`;
  
  limited.forEach((item, index) => {
    // ✅ Надёжное получение названия
    const title = item.name || item.title || item.fileName || 'Документ';
    
    // ✅ Надёжное получение URL (проверяем все возможные поля)
    const url = item.url || item.link || item.href || item.path || item.downloadUrl || '';
    
    const cleanTitle = formatLinkTitle(title);
    
    // ✅ BBCode-формат для Битрикс24: [url=...]Текст[/url]
    // Это скрывает длинный URL и показывает только чистый кликабельный текст
    const linkDisplay = url 
      ? `[url=${url}]📁 ${cleanTitle}[/url]` 
      : `📁 ${cleanTitle} (ссылка недоступна)`;
    
    response += `${index + 1}. ${linkDisplay}\n`;
    
    // Если есть описание — добавляем
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
 * Очищает кэш поиска (для тестов или принудительного обновления)
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