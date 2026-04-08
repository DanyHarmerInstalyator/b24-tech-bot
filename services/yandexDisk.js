// services/yandexDisk.js
// Работа с API Яндекс.Диска

const YANDEX_DISK_TOKEN = process.env.YANDEX_DISK_TOKEN;
const YANDEX_DISK_PUBLIC_KEY = process.env.YANDEX_DISK_PUBLIC_KEY;
const YANDEX_DISK_FOLDER_PATH = process.env.YANDEX_DISK_FOLDER_PATH;

// Базовые URL для API Яндекс.Диска
const YANDEX_API_BASE = 'https://cloud-api.yandex.net/v1/disk';
const YANDEX_PUBLIC_API_BASE = 'https://cloud-api.yandex.net/v1/disk/public/resources';

// Получение списка файлов из публичной папки
async function getPublicFolderContents(publicKey, path = '') {
  try {
    const url = new URL(YANDEX_PUBLIC_API_BASE);
    url.searchParams.append('public_key', publicKey);
    if (path) {
      url.searchParams.append('path', path);
    }
    
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `OAuth ${YANDEX_DISK_TOKEN}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ Ошибка получения содержимого папки:', error);
    return null;
  }
}

// Получение прямой ссылки на скачивание файла
async function getDownloadLink(filePath) {
  try {
    // Для публичных файлов
    const url = new URL(`${YANDEX_PUBLIC_API_BASE}/download`);
    url.searchParams.append('public_key', YANDEX_DISK_PUBLIC_KEY);
    url.searchParams.append('path', filePath);
    
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `OAuth ${YANDEX_DISK_TOKEN}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.href; // Прямая ссылка на скачивание
  } catch (error) {
    console.error('❌ Ошибка получения ссылки на скачивание:', error);
    return null;
  }
}

// Получение информации о файле
async function getFileInfo(filePath) {
  try {
    const url = new URL(`${YANDEX_PUBLIC_API_BASE}`);
    url.searchParams.append('public_key', YANDEX_DISK_PUBLIC_KEY);
    url.searchParams.append('path', filePath);
    
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `OAuth ${YANDEX_DISK_TOKEN}`
      }
    });
    
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

// Поиск файлов в публичной папке (через API)
async function searchPublicFiles(query, limit = 20) {
  try {
    // Сначала получаем содержимое корневой папки
    const rootContents = await getPublicFolderContents(YANDEX_DISK_PUBLIC_KEY, YANDEX_DISK_FOLDER_PATH);
    
    if (!rootContents || !rootContents._embedded || !rootContents._embedded.items) {
      return [];
    }
    
    const results = [];
    const queryLower = query.toLowerCase();
    
    // Рекурсивный поиск по файлам
    async function searchItems(items, currentPath = '') {
      for (const item of items) {
        const itemName = item.name.toLowerCase();
        const itemPath = item.path;
        
        // Проверяем совпадение в имени
        if (itemName.includes(queryLower)) {
          results.push({
            name: item.name,
            path: itemPath,
            type: item.type,
            size: item.size,
            modified: item.modified,
            downloadUrl: item.type === 'file' ? await getDownloadLink(itemPath) : null
          });
        }
        
        // Если это папка и мы не превысили лимит, рекурсивно ищем внутри
        if (item.type === 'folder' && results.length < limit * 2) {
          const folderContents = await getPublicFolderContents(YANDEX_DISK_PUBLIC_KEY, itemPath);
          if (folderContents && folderContents._embedded) {
            await searchItems(folderContents._embedded.items, itemPath);
          }
        }
        
        if (results.length >= limit) break;
      }
    }
    
    await searchItems(rootContents._embedded.items);
    
    return results.slice(0, limit);
  } catch (error) {
    console.error('❌ Ошибка поиска на Яндекс.Диске:', error);
    return [];
  }
}

// Создание папки (если нужно)
async function createFolder(folderPath) {
  try {
    const url = new URL(`${YANDEX_API_BASE}/resources`);
    url.searchParams.append('path', folderPath);
    
    const response = await fetch(url.toString(), {
      method: 'PUT',
      headers: {
        'Authorization': `OAuth ${YANDEX_DISK_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok && response.status !== 409) { // 409 - папка уже существует
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.status === 201 || response.status === 409;
  } catch (error) {
    console.error('❌ Ошибка создания папки:', error);
    return false;
  }
}

// Получение списка всех файлов в папке (для обновления индекса)
async function getAllFilesInFolder() {
  try {
    const allFiles = [];
    
    async function collectFiles(path = YANDEX_DISK_FOLDER_PATH) {
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

module.exports = {
  getPublicFolderContents,
  getDownloadLink,
  getFileInfo,
  searchPublicFiles,
  createFolder,
  getAllFilesInFolder
};