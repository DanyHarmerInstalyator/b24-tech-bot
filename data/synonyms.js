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

module.exports = { SYNONYMS, expandSynonyms };