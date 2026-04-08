// services/bitrixApi.js
// Отправка сообщений и кнопок в Битрикс24

const BITRIX_WEBHOOK = process.env.BITRIX_WEBHOOK;
const BOT_ID = process.env.BOT_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const YOUR_USER_ID = process.env.YOUR_USER_ID;

// Базовые кнопки для всех диалогов
const COMMON_BUTTONS = [
  { text: "📝 Уточнить запрос", command: "refine" },
  { text: "👨‍💻 Связаться со специалистом", command: "transfer" },
  { text: "✅ Помогло", command: "helpful" },
  { text: "🧪 ТЕСТ", command: "ECHO_TEST" }
];

// Кнопки для уточнения запроса
const REFINE_BUTTONS = [
  { text: "🔍 Показать больше результатов", command: "more_results" },
  { text: "📁 Посмотреть категории", command: "show_categories" },
  { text: "◀️ Назад", command: "back" }
];

// Кнопки для категорий
const CATEGORY_BUTTONS = [
  { text: "🔌 Кабели", command: "category_cable" },
  { text: "🔒 Замки", command: "category_lock" },
  { text: "❄️ EasyCool", command: "category_easycool" },
  { text: "🔌 CoolPlug", command: "category_coolplug" },
  { text: "🎤 Алиса/Интеграция", command: "category_alisa" },
  { text: "📋 Все категории", command: "all_categories" },
  { text: "◀️ Назад", command: "back" }
];

// Отправка сообщения
async function sendMessage(dialogId, message) {
  try {
    const url = `${BITRIX_WEBHOOK}imbot.message.add`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        BOT_ID: BOT_ID,
        CLIENT_ID: CLIENT_ID,
        DIALOG_ID: dialogId,
        MESSAGE: message
      })
    });
    
    const data = await response.json();
    
    if (!response.ok || data.error) {
      console.error('❌ Ошибка отправки сообщения:', data.error);
      return null;
    }
    
    console.log(`✅ Сообщение отправлено в диалог ${dialogId}`);
    return data;
  } catch (error) {
    console.error('❌ Ошибка при отправке:', error);
    return null;
  }
}

// Отправка сообщения с кнопками — ИСПРАВЛЕННАЯ ВЕРСИЯ (KEYBOARD, не ATTACH!)
async function sendMessageWithKeyboard(dialogId, message, buttons = null) {
  try {
    const url = `${BITRIX_WEBHOOK}imbot.message.add`;
    const keyboardButtons = buttons || COMMON_BUTTONS;
    
    // ✅ Правильный формат клавиатуры для imbot.message.add
    const keyboard = {
      BUTTONS: keyboardButtons.map(btn => ({
        TEXT: btn.text,
        COMMAND: btn.command
        // 👇 COMMAND_PARAMS не обязателен для простых команд
        // Если нужен: COMMAND_PARAMS: { command: btn.command }
      }))
    };
    
    console.log('📎 Отправка KEYBOARD:', JSON.stringify(keyboard, null, 2));
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BOT_ID: BOT_ID,
        CLIENT_ID: CLIENT_ID,
        DIALOG_ID: dialogId,
        MESSAGE: message,
        KEYBOARD: keyboard  // 👈 KEYBOARD, не ATTACH!
      })
    });
    
    const data = await response.json();
    
    // 🔍 Логируем ответ для отладки
    console.log('📬 Ответ Битрикс24:', {
      status: response.status,
      ok: response.ok,
      data
    });
    
    if (!response.ok || data.error) {
      console.error('❌ Ошибка отправки клавиатуры:', data.error || data);
      // Пробуем отправить сообщение без кнопок как фолбэк
      return sendMessage(dialogId, message);
    }
    
    console.log(`✅ Сообщение с кнопками отправлено в диалог ${dialogId}`);
    return data;
  } catch (error) {
    console.error('❌ Ошибка при отправке с кнопками:', error);
    return sendMessage(dialogId, message);
  }
}

// Отправка сообщения с перенаправлением на специалиста
async function transferToSpecialist(dialogId, userName, specialistId = 1673) {
  // Сообщение пользователю
  const userMessage = `👨‍💻 *Запрос передан специалисту*\n\n` +
    `${userName}, ваше сообщение отправлено техническому специалисту.\n` +
    `Специалист свяжется с вами в ближайшее время.\n\n` +
    `_Пожалуйста, ожидайте ответа в этом чате._`;
  
  await sendMessage(dialogId, userMessage);
  
  // Уведомление специалисту
  const notificationMessage = `🔔 *Новый запрос от пользователя*\n\n` +
    `👤 *Пользователь:* ${userName}\n` +
    `💬 *Диалог:* ${dialogId}\n` +
    `⏰ *Время:* ${new Date().toLocaleString()}\n\n` +
    `📝 *Сообщение:* Пользователь запросил помощь специалиста\n\n` +
    `_Ответьте в этом диалоге, чтобы помочь пользователю._`;
  
  await sendMessage(specialistId.toString(), notificationMessage);
  
  console.log(`✅ Пользователь ${userName} переведен на специалиста ${specialistId}`);
  return true;
}

// Обработка обратной связи "Помогло"
async function handleHelpful(dialogId, query) {
  const message = `🌟 *Спасибо за обратную связь!*\n\n` +
    `Рады, что смогли помочь с запросом: *"${query}"*\n\n` +
    `Если появятся другие вопросы - обращайтесь! 😊`;
  
  // Здесь можно добавить логирование в базу данных
  console.log(`✅ Пользователь ${dialogId} оценил ответ как полезный для запроса: ${query}`);
  
  return sendMessage(dialogId, message);
}

// Отправка приветственного сообщения
async function sendWelcomeMessage(dialogId) {
  const welcomeMessage = `🤖 *Бот технической поддержки HDL*\n\n` +
    `Я помогу найти документацию по устройствам HDL, Buspro, KNX, EasyCool и другим.\n\n` +
    `📌 *Что я умею:*\n` +
    `• Искать документацию по ключевым словам\n` +
    `• Предоставлять ссылки на папки Яндекс.Диска\n` +
    `• Отвечать на частые вопросы\n` +
    `• Связывать со специалистом\n\n` +
    `🔍 *Примеры запросов:*\n` +
    `• "кабель"\n` +
    `• "замок"\n` +
    `• "easycool техничка"\n` +
    `• "карниз buspro"\n` +
    `• "интеграция с алисой"\n\n` +
    `📝 *Команды:*\n` +
    `• /refine - Уточнить запрос\n` +
    `• /transfer - Связаться со специалистом\n` +
    `• /helpful - Отметить ответ полезным\n` +
    `• /categories - Показать категории\n` +
    `• /more - Показать больше результатов\n\n` +
    `Просто напишите, что ищете, и я помогу!`;
  
  return sendMessageWithKeyboard(dialogId, welcomeMessage);
}

// Отправка списка категорий
async function sendCategories(dialogId) {
  const categoriesMessage = `📂 *Доступные категории документации*\n\n` +
    `Выберите интересующую категорию для получения ссылки на папку с документами:\n\n` +
    `🔌 *Кабели* - вся документация по кабелям\n` +
    `🔒 *Замки* - дверные замки iOT Systems\n` +
    `❄️ *EasyCool* - кондиционеры и управление\n` +
    `🔌 *CoolPlug* - умные розетки CoolAutomation\n` +
    `🎤 *Алиса/Интеграция* - голосовые помощники\n` +
    `📋 *Другие категории* - полный список`;
  
  return sendMessageWithKeyboard(dialogId, categoriesMessage, CATEGORY_BUTTONS);
}

module.exports = {
  sendMessage,
  sendMessageWithKeyboard,
  transferToSpecialist,
  handleHelpful,
  sendWelcomeMessage,
  sendCategories,
  COMMON_BUTTONS,
  REFINE_BUTTONS,
  CATEGORY_BUTTONS
};