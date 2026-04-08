// api/webhook.js (полностью заменяем)

const { 
  searchFiles, 
  formatSearchResults, 
  handleFolderRedirect,
  searchWithContext 
} = require('../services/searchEngine');

const { 
  sendMessage, 
  sendMessageWithKeyboard, 
  transferToSpecialist, 
  handleHelpful, 
  sendWelcomeMessage,
  sendCategories,
  COMMON_BUTTONS,
  REFINE_BUTTONS,
  CATEGORY_BUTTONS
} = require('../services/bitrixApi');

const dialogContexts = new Map();

// Функция для извлечения данных из плоской структуры Битрикс24
function extractBitrixData(data) {
  const result = {
    event: data.event,
    dialogId: null,
    message: null,
    userName: null,
    userId: null,
    isCommand: false,
    isButton: false,
    command: null
  };
  
  // Извлекаем параметры
  if (data["data[PARAMS][MESSAGE]"]) {
    result.message = data["data[PARAMS][MESSAGE]"];
  }
  
  if (data["data[PARAMS][DIALOG_ID]"]) {
    result.dialogId = data["data[PARAMS][DIALOG_ID]"];
  }
  
  if (data["data[USER][NAME]"]) {
    result.userName = data["data[USER][NAME]"];
  }
  
  if (data["data[USER][ID]"]) {
    result.userId = data["data[USER][ID]"];
  }
  
  // ВАЖНО: Проверяем нажатие кнопки (COMMAND)
  // Кнопки приходят в data[PARAMS][COMMAND] или в data[PARAMS][COMMAND_PARAMS]
  if (data["data[PARAMS][COMMAND]"]) {
    result.isButton = true;
    result.command = data["data[PARAMS][COMMAND]"];
    console.log('🔘 Нажата кнопка (COMMAND поле):', result.command);
  }
  
  // Альтернативное поле для команды
  if (data["data[PARAMS][COMMAND_PARAMS]"]) {
    result.isButton = true;
    result.command = data["data[PARAMS][COMMAND_PARAMS]"];
    console.log('🔘 Нажата кнопка (COMMAND_PARAMS поле):', result.command);
  }
  
  // Если сообщение начинается с / - это тоже команда
  if (result.message && result.message.startsWith('/')) {
    result.isCommand = true;
    result.command = result.message.slice(1);
  }
  
  // Проверяем не от бота ли сообщение
  if (data["data[USER][IS_BOT]"] === 'Y') {
    result.isBot = true;
  }
  
  console.log('📊 Извлеченные данные:', {
    dialogId: result.dialogId,
    message: result.message,
    userName: result.userName,
    isButton: result.isButton,
    command: result.command
  });
  
  return result;
}

// Обработка текстовых сообщений
async function handleTextMessage(dialogId, message, userName) {
  const text = message.toLowerCase().trim();
  
  console.log(`🔍 Обработка сообщения: "${text}"`);
  
  // Приветствия
  const greetings = ['привет', 'здравствуй', 'бот', 'start', 'начать', '/start', 'help', 'помощь'];
  if (greetings.some(g => text === g || text.startsWith(g))) {
    return await sendWelcomeMessage(dialogId);
  }
  
  // Показ категорий
  if (text === 'категории' || text === 'категорий' || text === 'menu' || text === 'меню') {
    return await sendCategories(dialogId);
  }
  
  // Поиск документации
  console.log(`🔎 Ищем: "${message}"`);
  
  // Проверяем перенаправления на папки
  const folderRedirect = handleFolderRedirect(message);
  if (folderRedirect.redirect) {
    console.log(`📁 Перенаправление на папку: ${folderRedirect.type || 'single'}`);
    if (folderRedirect.multiple) {
      return await sendMessageWithKeyboard(dialogId, folderRedirect.message, folderRedirect.buttons);
    } else {
      await sendMessage(dialogId, folderRedirect.message);
      return await sendMessageWithKeyboard(dialogId, "🔍 Что дальше?", COMMON_BUTTONS);
    }
  }
  
  // Поиск файлов
  let searchResults;
  
  const context = dialogContexts.get(dialogId);
  if (context && context.lastQuery && context.lastResults && text.includes('уточн')) {
    searchResults = searchWithContext(message, context.lastQuery, context.lastResults);
    dialogContexts.delete(dialogId);
  } else {
    searchResults = searchFiles(message);
  }
  
  console.log(`📊 Найдено результатов: ${searchResults ? searchResults.length : 0}`);
  
  if (searchResults && searchResults.length > 0) {
    dialogContexts.set(dialogId, {
      lastQuery: message,
      lastResults: searchResults,
      timestamp: Date.now()
    });
  }
  
  const response = formatSearchResults(searchResults, message);
  await sendMessage(dialogId, response);
  
  if (searchResults && searchResults.length > 0) {
    await sendMessageWithKeyboard(dialogId, "🔍 Что дальше?", REFINE_BUTTONS);
  } else {
    await sendMessageWithKeyboard(dialogId, "❌ Ничего не найдено. Что делать?", COMMON_BUTTONS);
  }
  
  return true;
}

// Обработка команд от кнопок
async function handleButtonCommand(dialogId, command, userName) {
  console.log(`🔘 Обработка команды кнопки: "${command}" от ${userName}`);
  
  switch (command) {
    case 'refine':
      await sendMessage(dialogId, "📝 *Уточните ваш запрос*\n\nНапишите более конкретное описание того, что ищете.\nНапример:\n• 'кабель hdl'\n• 'инструкция easycool'\n• 'прошивка urri'");
      break;
      
    case 'more_results':
      const context = dialogContexts.get(dialogId);
      if (context && context.lastResults) {
        const moreResults = context.lastResults.slice(5, 15);
        if (moreResults.length > 0) {
          const response = formatSearchResults(moreResults, context.lastQuery);
          await sendMessage(dialogId, response);
        } else {
          await sendMessage(dialogId, "📭 Больше результатов не найдено.");
        }
      } else {
        await sendMessage(dialogId, "🔍 Сначала выполните поиск, а потом запрашивайте больше результатов.");
      }
      break;
      
    case 'show_categories':
    case 'all_categories':
      await sendCategories(dialogId);
      break;
      
    case 'back':
      await sendMessageWithKeyboard(dialogId, "🔙 Вернулись в главное меню. Что вас интересует?", COMMON_BUTTONS);
      break;
      
    case 'transfer':
      // Переводим на специалиста с ID 39
      await transferToSpecialist(dialogId, userName, 39);
      break;
      
    case 'helpful':
      const ctx = dialogContexts.get(dialogId);
      const query = ctx ? ctx.lastQuery : "неизвестный запрос";
      await handleHelpful(dialogId, query);
      break;
      
    case 'category_cable':
      const cableResult = handleFolderRedirect("кабель");
      await sendMessage(dialogId, cableResult.message);
      await sendMessageWithKeyboard(dialogId, "🔍 Что дальше?", COMMON_BUTTONS);
      break;
      
    case 'category_lock':
      const lockResult = handleFolderRedirect("замок");
      await sendMessage(dialogId, lockResult.message);
      await sendMessageWithKeyboard(dialogId, "🔍 Что дальше?", COMMON_BUTTONS);
      break;
      
    case 'category_easycool':
      const easycoolResult = handleFolderRedirect("easycool");
      await sendMessage(dialogId, easycoolResult.message);
      await sendMessageWithKeyboard(dialogId, "🔍 Что дальше?", COMMON_BUTTONS);
      break;
      
    case 'category_coolplug':
      const coolplugResult = handleFolderRedirect("coolplug");
      await sendMessage(dialogId, coolplugResult.message);
      await sendMessageWithKeyboard(dialogId, "🔍 Что дальше?", COMMON_BUTTONS);
      break;
      
    case 'category_alisa':
      const alisaResult = handleFolderRedirect("алиса");
      await sendMessage(dialogId, alisaResult.message);
      await sendMessageWithKeyboard(dialogId, "🔍 Что дальше?", COMMON_BUTTONS);
      break;
      
    case 'curtain_buspro':
      await sendMessage(dialogId, "📁 *Карнизы Buspro*\nhttps://disk.360.yandex.ru/d/20Q51Ey5rDMXqA");
      await sendMessageWithKeyboard(dialogId, "🔍 Что дальше?", COMMON_BUTTONS);
      break;
      
    case 'curtain_knx':
      await sendMessage(dialogId, "📁 *Карнизы KNX*\nhttps://disk.360.yandex.ru/d/x1w6XEUthCgTVg");
      await sendMessageWithKeyboard(dialogId, "🔍 Что дальше?", COMMON_BUTTONS);
      break;
      
    case 'ac_easycool':
      await sendMessage(dialogId, "📁 *Кондиционеры EasyCool*\nhttps://disk.360.yandex.ru/d/EuWsEkI__LPmIQ");
      await sendMessageWithKeyboard(dialogId, "🔍 Что дальше?", COMMON_BUTTONS);
      break;
      
    case 'ac_coolauto':
      await sendMessage(dialogId, "📁 *Кондиционеры CoolAutomation*\nhttps://disk.360.yandex.ru/d/UVzihaR7eRIRmw");
      await sendMessageWithKeyboard(dialogId, "🔍 Что дальше?", COMMON_BUTTONS);
      break;
      
    default:
      // Если неизвестная команда, пробуем как обычный поиск
      console.log(`⚠️ Неизвестная команда: ${command}, пробуем поиск`);
      await handleTextMessage(dialogId, command, userName);
  }
  
  return true;
}

// Очистка старых контекстов
setInterval(() => {
  const now = Date.now();
  for (const [dialogId, context] of dialogContexts.entries()) {
    if (now - context.timestamp > 30 * 60 * 1000) {
      dialogContexts.delete(dialogId);
    }
  }
}, 60 * 60 * 1000);

// Главный обработчик вебхука
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    console.log('📨 Получен вебхук');
    
    const data = req.body;
    
    // Извлекаем данные
    const bitrixData = extractBitrixData(data);
    
    if (!bitrixData.message && !bitrixData.command) {
      console.log('⚠️ Нет сообщения или команды');
      return res.status(200).json({ status: 'ok', message: 'No message data' });
    }
    
    if (!bitrixData.dialogId) {
      console.log('⚠️ Нет dialogId');
      return res.status(200).json({ status: 'ok', message: 'No dialog ID' });
    }
    
    if (bitrixData.isBot) {
      console.log('🤖 Сообщение от бота, игнорируем');
      return res.status(200).json({ status: 'ok', message: 'Bot message ignored' });
    }
    
    console.log(`💬 Обработка от ${bitrixData.userName} (${bitrixData.dialogId})`);
    
    if (bitrixData.isButton) {
      // Обработка нажатия кнопки
      await handleButtonCommand(bitrixData.dialogId, bitrixData.command, bitrixData.userName);
    } else {
      // Обработка текстового сообщения
      await handleTextMessage(bitrixData.dialogId, bitrixData.message, bitrixData.userName);
    }
    
    return res.status(200).json({ status: 'ok', message: 'Processed' });
    
  } catch (error) {
    console.error('❌ Ошибка в вебхуке:', error);
    console.error('Stack:', error.stack);
    return res.status(200).json({ status: 'error', error: error.message });
  }
};