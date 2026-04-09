// services/yandexDisk.js
// Работа с API Яндекс.Диска (публичные папки)

const YANDEX_DISK_PUBLIC_KEY = process.env.YANDEX_DISK_PUBLIC_KEY;
const YANDEX_DISK_FOLDER_PATH = process.env.YANDEX_DISK_FOLDER_PATH;

// Базовые URL для API Яндекс.Диска
const YANDEX_PUBLIC_API_BASE = 'https://cloud-api.yandex.net/v1/disk/public/resources';

// Кэш для результатов поиска
const searchCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 минут

/**
 * Получение содержимого публичной папки (без авторизации)
 */
async function getPublicFolderContents(publicKey, path = '') {
  try {
    const url = new URL(YANDEX_PUBLIC_API_BASE);
    url.searchParams.append('public_key', publicKey);
    if (path) {
      url.searchParams.append('path', path);
    }
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      console.error(`❌ Ошибка API: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ Ошибка получения содержимого папки:', error);
    return null;
  }
}

/**
 * Получение прямой ссылки на скачивание файла
 */
async function getDownloadLink(filePath) {
  try {
    const url = new URL(`${YANDEX_PUBLIC_API_BASE}/download`);
    url.searchParams.append('public_key', YANDEX_DISK_PUBLIC_KEY);
    url.searchParams.append('path', filePath);
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      console.error(`❌ Ошибка получения ссылки: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return data.href;
  } catch (error) {
    console.error('❌ Ошибка получения ссылки на скачивание:', error);
    return null;
  }
}

/**
 * Поиск файлов в публичной папке через API
 * @param {string} query - поисковый запрос
 * @param {number} limit - максимум результатов
 * @returns {Promise<Array>} - массив найденных файлов
 */
async function searchPublicFiles(query, limit = 20) {
  if (!query || !YANDEX_DISK_PUBLIC_KEY) {
    console.log('⚠️ searchPublicFiles: нет запроса или public key');
    return [];
  }
  
  const cacheKey = `search:${query}:${limit}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('📦 searchPublicFiles: возвращаем из кэша');
    return cached.results;
  }
  
  try {
    console.log(`📡 Поиск на Яндекс.Диске: "${query}"`);
    
    const url = new URL(YANDEX_PUBLIC_API_BASE);
    url.searchParams.append('public_key', YANDEX_DISK_PUBLIC_KEY);
    if (YANDEX_DISK_FOLDER_PATH) {
      url.searchParams.append('path', YANDEX_DISK_FOLDER_PATH);
    }
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data._embedded || !data._embedded.items) {
      return [];
    }
    
    const results = [];
    const queryLower = query.toLowerCase();
    
    async function searchItems(items) {
      for (const item of items) {
        if (results.length >= limit) break;
        
        const itemName = item.name.toLowerCase();
        
        // Проверяем совпадение в имени файла
        if (itemName.includes(queryLower)) {
          let downloadUrl = null;
          if (item.type === 'file') {
            downloadUrl = await getDownloadLink(item.path);
          }
          
          results.push({
            name: item.name,
            path: item.path,
            type: item.type,
            size: item.size,
            modified: item.modified,
            downloadUrl: downloadUrl
          });
        }
        
        // Рекурсивно обходим вложенные папки
        if (item.type === 'folder' && results.length < limit) {
          const folderUrl = new URL(YANDEX_PUBLIC_API_BASE);
          folderUrl.searchParams.append('public_key', YANDEX_DISK_PUBLIC_KEY);
          folderUrl.searchParams.append('path', item.path);
          
          const folderResponse = await fetch(folderUrl.toString());
          if (folderResponse.ok) {
            const folderData = await folderResponse.json();
            if (folderData._embedded) {
              await searchItems(folderData._embedded.items);
            }
          }
          
          // Небольшая задержка чтобы не перегружать API
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    }
    
    await searchItems(data._embedded.items);
    
    console.log(`✅ Найдено ${results.length} файлов на Диске`);
    
    // Сохраняем в кэш
    searchCache.set(cacheKey, {
      results: results,
      timestamp: Date.now()
    });
    
    return results;
    
  } catch (error) {
    console.error('❌ Ошибка поиска на Яндекс.Диске:', error);
    return [];
  }
}

/**
 * Получение информации о файле
 */
async function getFileInfo(filePath) {
  try {
    const url = new URL(YANDEX_PUBLIC_API_BASE);
    url.searchParams.append('public_key', YANDEX_DISK_PUBLIC_KEY);
    url.searchParams.append('path', filePath);
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ Ошибка получения информации о файле:', error);
    return null;
  }
}

/**
 * Получение всех файлов в папке (для обновления индекса)
 */
async function getAllFilesInFolder() {
  if (!YANDEX_DISK_PUBLIC_KEY) {
    console.error('❌ Нет YANDEX_DISK_PUBLIC_KEY');
    return [];
  }
  
  try {
    const allFiles = [];
    
    async function collectFiles(path = YANDEX_DISK_FOLDER_PATH || '') {
      const contents = await getPublicFolderContents(YANDEX_DISK_PUBLIC_KEY, path);
      
      if (!contents || !contents._embedded) {
        return;
      }
      
      for (const item of contents._embedded.items) {
        if (item.type === 'file') {
          allFiles.push({
            name: item.name,
            path: item.path,
            size: item.size,
            modified: item.modified
          });
        } else if (item.type === 'folder') {
          await collectFiles(item.path);
        }
      }
    }
    
    await collectFiles();
    console.log(`✅ Собрано ${allFiles.length} файлов с Яндекс.Диска`);
    return allFiles;
  } catch (error) {
    console.error('❌ Ошибка сбора файлов:', error);
    return [];
  }
}

/**
 * Очистка кэша поиска
 */
function clearSearchCache() {
  searchCache.clear();
  console.log('🗑️ Кэш поиска Яндекс.Диска очищен');
}

module.exports = {
  getPublicFolderContents,
  getDownloadLink,
  getFileInfo,
  searchPublicFiles,
  getAllFilesInFolder,
  clearSearchCache
};