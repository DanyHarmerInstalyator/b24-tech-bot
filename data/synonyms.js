// data/synonyms.js
// Расширенные синонимы для поиска (аналог Python версии)

const SYNONYMS = {
  // Бренды и их вариации
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
  
  // Кабели
  "кабель": "cable",
  "кабел": "cable",
  "кабеля": "cable",
  "кабели": "cable",
  "cable": "cable",
  "кабелька": "cable",
  
  // Замки
  "замок": "lock",
  "замки": "lock",
  "замочек": "lock",
  "дверной": "door lock",
  "дверные": "door lock",
  "lock": "lock",
  
  // CoolPlug специфическое
  "кулплагтехничка": "coolplug manual",
  "кулплагмануал": "coolplug manual",
  "кулплаг инструкция": "coolplug manual",
  "coolplug manual": "coolplug manual",
  
  // EasyCool специфическое
  "easycool техничка": "easycool manual",
  "easycool инструкция": "easycool manual",
  "изикул инструкция": "easycool manual",
  
  // Интеграции
  "алиса": "alisa",
  "яндекс алиса": "alisa",
  "alisa": "alisa",
  "голосовой помощник": "voice assistant",
  "яндекс": "yandex",
  "siri": "siri",
  "google assistant": "google",
  "homekit": "homekit",
  
  // Комплектующие
  "блок питания": "power supply",
  "бп": "power supply",
  "power supply": "power supply",
  "psu": "power supply",
  "трансформатор": "transformer",
  
  // Программирование
  "прошивка": "firmware",
  "firmware": "firmware",
  "обновление": "update",
  "update": "update",
  "софт": "software",
  "software": "software",
  "программа": "software",
  "настройка": "setup",
  "конфигурация": "config"
};

// Функция для применения синонимов
function expandSynonyms(query) {
  let expanded = [];
  let words = query.toLowerCase().split(/\s+/);
  
  for (let word of words) {
    expanded.push(word);
    // Если есть синоним, добавляем и его
    for (const [wrong, correct] of Object.entries(SYNONYMS)) {
      if (correct && (word === wrong || word.includes(wrong))) {
        if (correct.includes(' ')) {
          expanded.push(...correct.split(' '));
        } else {
          expanded.push(correct);
        }
      }
    }
  }
  
  return [...new Set(expanded)].join(' ');
}

function normalizeWithSynonyms(text) {
  if (!text || typeof text !== 'string') return '';
  
  // Приводим к нижнему регистру и убираем лишние пробелы
  let normalized = text.toLowerCase().trim();
  
  // Удаляем стоп-слова (глаголы и служебные слова)
  const stopWords = [
    'сбрось', 'отправь', 'найди', 'дай', 'скинь', 'пришли',
    'нужна', 'нужен', 'нужно', 'ищу', 'найти', 'пожалуйста',
    'можно', 'где', 'как', 'что', 'это', 'для', 'по', 'в', 'на'
  ];
  
  for (const stopWord of stopWords) {
    normalized = normalized.replace(new RegExp(`\\b${stopWord}\\b`, 'gi'), '');
  }
  
  // Применяем синонимы из словаря
  let words = normalized.split(/\s+/).filter(w => w.length > 0);
  let expanded = [];
  
  for (let word of words) {
    let replaced = false;
    
    // Ищем точное совпадение или вхождение
    for (const [wrong, correct] of Object.entries(SYNONYMS)) {
      if (wrong && word === wrong) {
        if (correct) {
          expanded.push(...correct.split(' ').filter(w => w));
        }
        replaced = true;
        break;
      }
    }
    
    // Если не заменили — оставляем как есть
    if (!replaced) {
      expanded.push(word);
    }
  }
  
  // Убираем дубликаты и пустые строки
  return [...new Set(expanded)].filter(w => w).join(' ');
}

// Обновите module.exports в конце файла:
module.exports = { 
  SYNONYMS, 
  expandSynonyms,
  normalizeWithSynonyms  // 
};