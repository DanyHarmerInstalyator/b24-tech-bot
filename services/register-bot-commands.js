// register-bot-commands.js

const BITRIX_WEBHOOK = 'https://hdl.bitrix24.ru/rest/1673/kv9kkb0237aipgy3/';

const COMMANDS_TO_REGISTER = [
  { COMMAND: 'refine', TITLE: 'Уточнить запрос' },
  { COMMAND: 'transfer', TITLE: 'Связаться со специалистом' },
  { COMMAND: 'helpful', TITLE: 'Помогло' },
  { COMMAND: 'more_results', TITLE: 'Показать больше результатов' },
  { COMMAND: 'back', TITLE: 'Назад' },
  { COMMAND: 'category_cable', TITLE: 'Кабели' },
  { COMMAND: 'category_lock', TITLE: 'Замки' },
  { COMMAND: 'category_easycool', TITLE: 'EasyCool' },
  { COMMAND: 'category_coolplug', TITLE: 'CoolPlug' },
  { COMMAND: 'category_alisa', TITLE: 'Алиса/Интеграция' },
  { COMMAND: 'all_categories', TITLE: 'Все категории' },
  { COMMAND: 'curtain_buspro', TITLE: 'Карнизы Buspro' },
  { COMMAND: 'curtain_knx', TITLE: 'Карнизы KNX' },
  { COMMAND: 'ac_easycool', TITLE: 'Кондиционеры EasyCool' },
  { COMMAND: 'ac_coolauto', TITLE: 'Кондиционеры CoolAutomation' }
];

async function registerCommands() {
  console.log('🚀 Регистрация команд для бота...\n');
  
  for (const cmd of COMMANDS_TO_REGISTER) {
    try {
      const url = `${BITRIX_WEBHOOK}imbot.command.register`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          BOT_ID: '4337',
          COMMAND: cmd.COMMAND,
          TITLE: cmd.TITLE,
          HIDDEN: 'N'
        })
      });
      
      const result = await response.json();
      if (result.error) {
        console.log(`❌ ${cmd.COMMAND}: ${result.error_description}`);
      } else {
        console.log(`✅ ${cmd.COMMAND} - ${cmd.TITLE}`);
      }
    } catch (error) {
      console.log(`❌ ${cmd.COMMAND}: ${error.message}`);
    }
  }
  
  console.log('\n🏁 Регистрация завершена!');
}

registerCommands();