// api/webhook.js
// Главный обработчик вебхука для Битрикс24
console.log('🔍 RAW BODY:', JSON.stringify(req.body, null, 2));

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

// Хранилище контекстов диалогов
const dialogContexts = new Map();

// Функция для извлечения данных из плоской структуры Битрикс24
function extractBitrixData(data) {
  const result = {
    event: data.event,
    dialogId: null,
    message: null,
    userName: null,
    userId: null,
    isButton: false,
    isBot: false,
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
  
  // Проверяем нажатие кнопки (COMMAND)
  if (data["data[PARAMS][COMMAND]"]) {
    result.isButton = true;
    result.command = data["data[PARAMS][COMMAND]"];
    console.log('🔘 Нажата кнопка с командой:', result.command);
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

// Обработка текстовых команд (которые пользователь пишет вручную)
async function handleTextCommands(dialogId, text, userName) {
  console.log(`🎯 Проверка текстовой команды: "${text}"`);
  
  // Команды, которые пользователь пишет вручную
  if (text === '/refine' || text === 'refine' || text === 'уточнить') {
    await sendMessage(dialogId, "📝 *Уточните ваш запрос*\n\nНапишите, что именно вы ищете, например:\n• 'кабель hdl'\n• 'инструкция easycool'\n• 'прошивка urri'");
    return true;
  }
  
  if (text === '/transfer' || text === 'transfer' || text === 'специалист') {
    await transferToSpecialist(dialogId, userName, 39);
    return true;
  }
  
  if (text === '/helpful' || text === 'helpful' || text === 'помогло') {
    const ctx = dialogContexts.get(dialogId);
    const query = ctx ? ctx.lastQuery : "неизвестный запрос";
    await handleHelpful(dialogId, query);
    return true;
  }
  
  if (text === '/more' || text === 'more_results' || text === 'больше') {
    const ctx = dialogContexts.get(dialogId);
    if (ctx && ctx.lastResults) {
      const moreResults = ctx.lastResults.slice(5, 15);
      if (moreResults.length > 0) {
        const response = formatSearchResults(moreResults, ctx.lastQuery);
        await sendMessage(dialogId, response);
      } else {
        await sendMessage(dialogId, "📭 Больше результатов не найдено.");
      }
    } else {
      await sendMessage(dialogId, "🔍 Сначала выполните поиск.");
    }
    return true;
  }
  
  if (text === '/categories' || text === 'категории' || text === 'menu') {
    await sendCategories(dialogId);
    return true;
  }
  
  return false;
}

// Обработка команд от кнопок
async function handleButtonCommand(dialogId, command, userName) {
  console.log(`🔘 Обработка кнопки: ${command}`);
  
  switch (command) {
    // Категории
    case 'category_cable':
      const cableResult = handleFolderRedirect("кабель");
      await sendMessage(dialogId, cableResult.message);
      break;
      
    case 'category_lock':
      const lockResult = handleFolderRedirect("замок");
      await sendMessage(dialogId, lockResult.message);
      break;
      
    case 'category_easycool':
      const easycoolResult = handleFolderRedirect("easycool");
      await sendMessage(dialogId, easycoolResult.message);
      break;
      
    case 'category_coolplug':
      const coolplugResult = handleFolderRedirect("coolplug");
      await sendMessage(dialogId, coolplugResult.message);
      break;
      
    case 'category_alisa':
      const alisaResult = handleFolderRedirect("алиса");
      await sendMessage(dialogId, alisaResult.message);
      break;
      
    case 'all_categories':
      await sendCategories(dialogId);
      return;
      
    // Карнизы
    case 'curtain_buspro':
      await sendMessage(dialogId, "📁 *Карнизы Buspro*\nhttps://disk.360.yandex.ru/d/20Q51Ey5rDMXqA");
      break;
      
    case 'curtain_knx':
      await sendMessage(dialogId, "📁 *Карнизы KNX*\nhttps://disk.360.yandex.ru/d/x1w6XEUthCgTVg");
      break;
      
    // Кондиционеры
    case 'ac_easycool':
      await sendMessage(dialogId, "📁 *Кондиционеры EasyCool*\nhttps://disk.360.yandex.ru/d/EuWsEkI__LPmIQ");
      break;
      
    case 'ac_coolauto':
      await sendMessage(dialogId, "📁 *Кондиционеры CoolAutomation*\nhttps://disk.360.yandex.ru/d/UVzihaR7eRIRmw");
      break;
      
    // Основные команды
    case 'refine':
      await sendMessage(dialogId, "📝 *Уточните запрос*\nНапишите более конкретное описание того, что ищете.");
      break;
      
    case 'transfer':
      await transferToSpecialist(dialogId, userName, 39);
      break;
      
    case 'helpful':
      const ctx = dialogContexts.get(dialogId);
      const query = ctx ? ctx.lastQuery : "запрос";
      await handleHelpful(dialogId, query);
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
        await sendMessage(dialogId, "🔍 Сначала выполните поиск.");
      }
      break;
      
    case 'back':
      await sendMessageWithKeyboard(dialogId, "🔙 Главное меню. Что вас интересует?", COMMON_BUTTONS);
      return;
      
    default:
      await sendMessage(dialogId, "🤔 Неизвестная команда. Пожалуйста, воспользуйтесь кнопками меню.");
      return;
  }
  
  // После ответа показываем кнопки
  await sendMessageWithKeyboard(dialogId, "🔍 Что дальше?", COMMON_BUTTONS);
}

// Обработка текстовых сообщений
async function handleTextMessage(dialogId, message, userName) {
  const text = message.toLowerCase().trim();
  
  console.log(`🔍 Обработка сообщения: "${text}"`);
  
  // Проверяем команды
  const isCommand = await handleTextCommands(dialogId, text, userName);
  if (isCommand) return true;
  
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
    await sendMessageWithKeyboard(dialogId, "🔍 Что дальше? (напишите /more для продолжения)", REFINE_BUTTONS);
  } else {
    await sendMessageWithKeyboard(dialogId, "❌ Ничего не найдено. Напишите /refine для уточнения", COMMON_BUTTONS);
  }
  
  return true;
}

// Очистка старых контекстов (каждый час)
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
  // Проверяем метод
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    console.log('📨 Получен вебхук');
    
    const data = req.body;
    const bitrixData = extractBitrixData(data);
    
    if (!bitrixData.dialogId) {
      console.log('⚠️ Нет dialogId');
      return res.status(200).json({ status: 'ok', message: 'No dialog ID' });
    }
    
    if (bitrixData.isBot) {
      console.log('🤖 Сообщение от бота, игнорируем');
      return res.status(200).json({ status: 'ok', message: 'Bot message ignored' });
    }
    
    console.log(`💬 Обработка от ${bitrixData.userName} (${bitrixData.dialogId})`);
    
    // Если это нажатие кнопки
    if (bitrixData.isButton) {
      await handleButtonCommand(bitrixData.dialogId, bitrixData.command, bitrixData.userName);
    } else {
      // Обычное текстовое сообщение
      await handleTextMessage(bitrixData.dialogId, bitrixData.message, bitrixData.userName);
    }
    
    return res.status(200).json({ status: 'ok', message: 'Processed' });
    
  } catch (error) {
    console.error('❌ Ошибка в вебхуке:', error);
    console.error('Stack:', error.stack);
    return res.status(200).json({ status: 'error', error: error.message });
  }
};