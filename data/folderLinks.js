// data/folderLinks.js
// Перенаправления на папки Яндекс.Диска

const FOLDER_LINKS = {
  // Кабели
  "кабель": "https://disk.360.yandex.ru/d/xJi6eEXBTq01sw/01.%20iOT%20Systems/02.%20iOT%20%D0%9A%D0%B0%D0%B1%D0%B5%D0%BB%D1%8C",
  "cable": "https://disk.360.yandex.ru/d/xJi6eEXBTq01sw/01.%20iOT%20Systems/02.%20iOT%20%D0%9A%D0%B0%D0%B1%D0%B5%D0%BB%D1%8C",
  
  // Замки
  "замок": "https://disk.360.yandex.ru/d/xJi6eEXBTq01sw/01.%20iOT%20Systems/04.%20%D0%94%D0%B2%D0%B5%D1%80%D0%BD%D1%8B%D0%B5%20%D0%B7%D0%B0%D0%BC%D0%BA%D0%B8%20iOT%20Systems",
  "замки": "https://disk.360.yandex.ru/d/xJi6eEXBTq01sw/01.%20iOT%20Systems/04.%20%D0%94%D0%B2%D0%B5%D1%80%D0%BD%D1%8B%D0%B5%20%D0%B7%D0%B0%D0%BC%D0%BA%D0%B8%20iOT%20Systems",
  
  // EasyCool
  "easycool": "https://disk.360.yandex.ru/d/xJi6eEXBTq01sw/01.%20iOT%20Systems/03.%20iOT%20EasyCool",
  "изикул": "https://disk.360.yandex.ru/d/xJi6eEXBTq01sw/01.%20iOT%20Systems/03.%20iOT%20EasyCool",
  
  // CoolPlug
  "coolplug": "https://disk.360.yandex.ru/d/xJi6eEXBTq01sw/03.%20Coolautomation/3.%20CooLink%20Hub%20%26%20Coolplug",
  "кулплаг": "https://disk.360.yandex.ru/d/xJi6eEXBTq01sw/03.%20Coolautomation/3.%20CooLink%20Hub%20%26%20Coolplug",
  
  // Алиса
  "алиса": "https://disk.360.yandex.ru/d/xJi6eEXBTq01sw/02.%20HDL/09.%20%D0%98%D0%BD%D1%82%D0%B5%D0%B3%D1%80%D0%B0%D1%86%D0%B8%D1%8F%20%D1%81%20%D0%B3%D0%BE%D0%BB%D0%BE%D1%81%D0%BE%D0%B2%D1%8B%D0%BC%D0%B8%20%D0%B0%D1%81%D1%81%D0%B8%D1%81%D1%82%D0%B5%D0%BD%D1%82%D0%B0%D0%BC%D0%B8.%20Buspro%20%D0%B8%20KNX",
  
  // Карнизы
  "карниз buspro": "https://disk.360.yandex.ru/d/20Q51Ey5rDMXqA",
  "карниз баспро": "https://disk.360.yandex.ru/d/20Q51Ey5rDMXqA",
  "карниз knx": "https://disk.360.yandex.ru/d/x1w6XEUthCgTVg",
  "карниз кникс": "https://disk.360.yandex.ru/d/x1w6XEUthCgTVg",
  
  // Кондиционеры
  "кондиционеры easycool": "https://disk.360.yandex.ru/d/EuWsEkI__LPmIQ",
  "кондиционеры coolautomation": "https://disk.360.yandex.ru/d/UVzihaR7eRIRmw"
};

// Ключевые слова для категорий
const CATEGORY_KEYWORDS = {
  cable: ["кабель", "cable", "кабел", "кабели"],
  lock: ["замок", "замки", "дверной", "door", "lock"],
  easycool: ["easycool", "изикул", "изи кул", "easycool техничка", "easycool инструкция"],
  coolplug: ["coolplug", "кулплаг", "кулплуг"],
  alisa: ["алиса", "яндекс алиса", "alisa", "голосовой"],
  curtain_buspro: ["карниз buspro", "карниз баспро"],
  curtain_knx: ["карниз knx", "карниз кникс"],
  ac_easycool: ["кондиционеры easycool"],
  ac_coolauto: ["кондиционеры coolautomation"]
};

// ГЛАВНАЯ ФУНКЦИЯ ПРОВЕРКИ ПЕРЕНАПРАВЛЕНИЯ
function shouldRedirectToFolder(query) {
  const lowerQuery = query.toLowerCase().trim();
  console.log(`🔍 Проверка перенаправления: "${lowerQuery}"`);
  
  // Точное совпадение
  if (FOLDER_LINKS[lowerQuery]) {
    console.log(`✅ Точное совпадение: ${FOLDER_LINKS[lowerQuery]}`);
    return { redirect: true, link: FOLDER_LINKS[lowerQuery] };
  }
  
  // Проверка по ключевым словам
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerQuery.includes(keyword)) {
        // Находим соответствующую ссылку
        if (category === 'cable') return { redirect: true, link: FOLDER_LINKS["кабель"] };
        if (category === 'lock') return { redirect: true, link: FOLDER_LINKS["замок"] };
        if (category === 'easycool') return { redirect: true, link: FOLDER_LINKS["easycool"] };
        if (category === 'coolplug') return { redirect: true, link: FOLDER_LINKS["coolplug"] };
        if (category === 'alisa') return { redirect: true, link: FOLDER_LINKS["алиса"] };
        if (category === 'curtain_buspro') return { redirect: true, link: FOLDER_LINKS["карниз buspro"] };
        if (category === 'curtain_knx') return { redirect: true, link: FOLDER_LINKS["карниз knx"] };
        if (category === 'ac_easycool') return { redirect: true, link: FOLDER_LINKS["кондиционеры easycool"] };
        if (category === 'ac_coolauto') return { redirect: true, link: FOLDER_LINKS["кондиционеры coolautomation"] };
      }
    }
  }
  
  console.log(`❌ Нет перенаправления для: "${lowerQuery}"`);
  return { redirect: false };
}

function getBothCurtains() {
  return [
    { name: "📁 Карнизы Buspro", link: FOLDER_LINKS["карниз buspro"] },
    { name: "📁 Карнизы KNX", link: FOLDER_LINKS["карниз knx"] }
  ];
}

function getBothAC() {
  return [
    { name: "📁 Кондиционеры EasyCool", link: FOLDER_LINKS["кондиционеры easycool"] },
    { name: "📁 Кондиционеры CoolAutomation", link: FOLDER_LINKS["кондиционеры coolautomation"] }
  ];
}

module.exports = { 
  FOLDER_LINKS, 
  CATEGORY_KEYWORDS, 
  shouldRedirectToFolder,
  getBothCurtains,
  getBothAC
};