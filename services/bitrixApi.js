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
  { text: "✅ Помогло", command: "helpful" }
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

// Отправка сообщения с кнопками
async function sendMessageWithKeyboard(dialogId, message, buttons = null, attachButtons = true) {
  try {
    const url = `${BITRIX_WEBHOOK}imbot.message.add`;
    
    // Используем переданные кнопки или стандартные
    let keyboardButtons = buttons || COMMON_BUTTONS;
    
    const keyboard = {
      BUTTONS: keyboardButtons.map(btn => ({
        TEXT: btn.text,
        COMMAND: btn.command,
        ...(btn.link && { LINK: btn.link })
      }))
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        BOT_ID: BOT_ID,
        CLIENT_ID: CLIENT_ID,
        DIALOG_ID: dialogId,
        MESSAGE: message,
        KEYBOARD: keyboard
      })
    });
    
    const data = await response.json();
    
    if (!response.ok || data.error) {
      console.error('❌ Ошибка отправки сообщения с кнопками:', data.error);
      // Пробуем отправить без кнопок
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
async function transferToSpecialist(dialogId, userName, specialistId = 39) {
  const specialistMessage = `👨‍💻 *Перевод специалисту*\n\n` +
    `${userName}, ваш запрос передан техническому специалисту.\n` +
    `Пожалуйста, ожидайте ответа в ближайшее время.\n\n` +
    `_Если вопрос срочный, позвоните по телефону: +7 (XXX) XXX-XX-XX_`;
  
  // Отправляем пользователю
  await sendMessage(dialogId, specialistMessage);
  
  // Отправляем уведомление специалисту (в личку с ID 39)
  const notificationMessage = `🔔 *Новый запрос от пользователя*\n\n` +
    `👤 Пользователь: ${userName}\n` +
    `💬 Диалог: ${dialogId}\n` +
    `⏰ Время: ${new Date().toLocaleString()}\n\n` +
    `_Ответьте в этом диалоге, чтобы помочь пользователю._`;
  
  // Отправляем специалисту
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
    `• Связывать со специалистом при необходимости\n\n` +
    `🔍 *Примеры запросов:*\n` +
    `• "кабель"\n` +
    `• "замок"\n` +
    `• "easycool техничка"\n` +
    `• "карниз buspro"\n` +
    `• "интеграция с алисой"\n\n` +
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