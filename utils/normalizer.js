// utils/normalizer.js
// Нормализация текста с синонимами (аналог Python версии)

const SYNONYMS = {
  // Бренды
  "изикул": "easycool",
  "изи кул": "easycool",
  "easycool": "easycool",
  "баспро": "buspro",
  "buspro": "buspro",
  "бас про": "buspro",
  "хдл": "hdl",
  "hdl": "hdl",
  "урри": "urri",
  "юрии": "urri",
  "urri": "urri",
  "матек": "matech",
  "мутек": "matech",
  "matech": "matech",
  "йилайт": "yeelight",
  "yeelight": "yeelight",
  "дайли": "dali",
  "dali": "dali",
  "кулплаг": "coolplug",
  "кулплуг": "coolplug",
  "coolplug": "coolplug",
  "cooplug": "coolplug",
  
  // Типы документации
  "техничка": "manual",
  "документация": "manual",
  "инструкция": "manual",
  "мануал": "manual",
  "manual": "manual",
  "доки": "manual",
  "док": "manual",
  "описание": "manual",
  "руководство": "manual",
  "документ": "manual",
  "файл": "file",
  
  // Типы устройств
  "модуль": "module",
  "контроллер": "controller",
  "панель": "panel",
  "пульт": "panel",
  "датчик": "sensor",
  "сенсор": "sensor",
  "ресивер": "receiver",
  "усилитель": "amplifier",
  "шлюз": "gateway",
  "гейтвей": "gateway",
  "приемник": "receiver",
  "блок": "unit",
  "устройство": "device",
  
  // Протоколы и технологии
  "кникс": "knx",
  "кнх": "knx",
  "knx": "knx",
  "dmx": "dmx",
  "modbus": "modbus",
  "mod бас": "modbus",
  
  // Глаголы (удаляем)
  "сбрось": "",
  "отправь": "",
  "найди": "",
  "дай": "",
  "скинь": "",
  "пришли": "",
  "нужна": "",
  "нужен": "",
  "нужно": "",
  "ищу": "",
  "найти": "",
  "пожалуйста": "",
  "можно": "",
  "где": "",
  "как": "",
  "дайте": "",
  "покажи": "",
  "показать": "",
  "выдай": "",
  "надо": "",
  "требуется": "",
  "помоги": "",
  "помогите": "",
  
  // Кабели
  "кабель": "cable",
  "кабел": "cable",
  "кабеля": "cable",
  "кабели": "cable",
  "cable": "cable",
  "кабелька": "cable",
  "провод": "cable",
  "провода": "cable",
  
  // Замки
  "замок": "lock",
  "замки": "lock",
  "замочек": "lock",
  "дверной": "door lock",
  "дверные": "door lock",
  "lock": "lock",
  "электрозамок": "lock",
  
  // CoolPlug специфическое
  "кулплагтехничка": "coolplug manual",
  "кулплагмануал": "coolplug manual",
  "кулплаг инструкция": "coolplug manual",
  "coolplug manual": "coolplug manual",
  "кулплаг документация": "coolplug manual",
  
  // EasyCool специфическое
  "easycool техничка": "easycool manual",
  "easycool инструкция": "easycool manual",
  "изикул инструкция": "easycool manual",
  "easycool документация": "easycool manual",
  
  // Интеграции
  "алиса": "alisa",
  "яндекс алиса": "alisa",
  "alisa": "alisa",
  "голосовой помощник": "voice assistant",
  "яндекс": "yandex",
  "siri": "siri",
  "google assistant": "google",
  "homekit": "homekit",
  "умный дом": "smart home",
  
  // Комплектующие
  "блок питания": "power supply",
  "бп": "power supply",
  "power supply": "power supply",
  "psu": "power supply",
  "трансформатор": "transformer",
  "адаптер": "adapter",
  
  // Программирование
  "прошивка": "firmware",
  "firmware": "firmware",
  "обновление": "update",
  "update": "update",
  "софт": "software",
  "software": "software",
  "программа": "software",
  "настройка": "setup",
  "конфигурация": "config",
  "конфиг": "config",
  
  // Карнизы
  "карниз": "curtain",
  "шторы": "curtain",
  "curtain": "curtain",
  
  // Кондиционеры
  "кондиционер": "air conditioner",
  "кондиционеры": "air conditioner",
  "ac": "air conditioner",
  "сплит": "split system",
  
  // Дополнительные
  "схема": "diagram",
  "diagram": "diagram",
  "подключение": "connection",
  "монтаж": "installation",
  "установка": "installation"
};

// Функция нормализации текста с синонимами
function normalizeWithSynonyms(query) {
  if (!query) return "";
  
  let normalized = query.toLowerCase().trim();
  
  // Заменяем синонимы (сначала длинные фразы)
  const sortedSynonyms = Object.entries(SYNONYMS).sort((a, b) => b[0].length - a[0].length);
  
  for (const [wrong, correct] of sortedSynonyms) {
    if (correct) {
      // Используем глобальную замену
      const regex = new RegExp(wrong, 'gi');
      normalized = normalized.replace(regex, correct);
    } else {
      const regex = new RegExp(wrong, 'gi');
      normalized = normalized.replace(regex, '');
    }
  }
  
  // Удаляем спецсимволы, оставляем буквы, цифры, пробелы
  normalized = normalized.replace(/[^a-zа-я0-9\s]/g, ' ');
  
  // Удаляем лишние пробелы
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

// Функция расширения синонимов (для поиска)
function expandSynonyms(query) {
  if (!query) return [];
  
  const words = query.toLowerCase().split(/\s+/);
  const expanded = new Set(words);
  
  for (const word of words) {
    // Ищем синонимы для каждого слова
    for (const [wrong, correct] of Object.entries(SYNONYMS)) {
      if (correct && (word === wrong || word.includes(wrong))) {
        if (correct.includes(' ')) {
          correct.split(' ').forEach(c => expanded.add(c));
        } else {
          expanded.add(correct);
        }
      }
    }
  }
  
  return Array.from(expanded);
}

// Функция проверки является ли запрос поиском документации
function isSearchQuery(query) {
  const searchIndicators = ['техничка', 'документация', 'инструкция', 'мануал', 'manual', 'доки'];
  const lowerQuery = query.toLowerCase();
  return searchIndicators.some(ind => lowerQuery.includes(ind));
}

// Функция извлечения бренда из запроса
function extractBrand(query) {
  const brands = ['hdl', 'buspro', 'urri', 'matech', 'easycool', 'coolplug', 'yeelight', 'dali', 'knx'];
  const lowerQuery = query.toLowerCase();
  
  for (const brand of brands) {
    if (lowerQuery.includes(brand)) {
      return brand;
    }
  }
  return null;
}

// Функция извлечения типа устройства из запроса
function extractDeviceType(query) {
  const deviceTypes = ['module', 'controller', 'panel', 'sensor', 'gateway', 'cable', 'lock'];
  const lowerQuery = query.toLowerCase();
  
  for (const type of deviceTypes) {
    if (lowerQuery.includes(type)) {
      return type;
    }
  }
  return null;
}

module.exports = { 
  normalizeWithSynonyms, 
  SYNONYMS,
  expandSynonyms,
  isSearchQuery,
  extractBrand,
  extractDeviceType
};