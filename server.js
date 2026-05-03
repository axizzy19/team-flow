const express = require('express');
const nodemailer = require('nodemailer');
const app = express();
const PORT = 3000;

const VALID_API_KEY = 'my-secret-key-123';

let testAccount = null;
let transporter = null;

async function setupEmail() {
  testAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
  console.log('📧 Тестовая почта готова');
  console.log(`👀 Логин: ${testAccount.user}`);
  console.log(`🔑 Пароль: ${testAccount.pass}`);
  console.log(`🔗 Смотреть письма: https://ethereal.email/messages`);
}

async function sendTaskNotification(task) {
  if (!transporter) return;
  
  const info = await transporter.sendMail({
    from: '"TaskManager" <tasks@test.com>',
    to: testAccount.user, // отправляем самому себе (на тестовый ящик)
    subject: `✅ Новая задача: ${task.title}`,
    text: `
      Создана новая задача:
      
      📌 Название: ${task.title}
      📅 Срок: ${task.due_date}
      ⚡ Приоритет: ${task.priority}
      🆔 ID: ${task.id}
      
      Удалите задачу, когда выполните.
    `,
    html: `
      <h2>✅ Новая задача</h2>
      <ul>
        <li><b>Название:</b> ${task.title}</li>
        <li><b>Срок:</b> ${task.due_date}</li>
        <li><b>Приоритет:</b> ${task.priority}</li>
        <li><b>ID:</b> ${task.id}</li>
      </ul>
      <p>Удалите задачу, когда выполните.</p>
    `
  });
  
  console.log(`Письмо отправлено, URL просмотра: ${nodemailer.getTestMessageUrl(info)}`);
  return nodemailer.getTestMessageUrl(info);
}

app.use(express.json());

function authMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== VALID_API_KEY) {
    return res.status(401).json({ error: 'Неверный или отсутствует API-ключ' });
  }
  next();
}

let tasks = [];
let nextId = 1;

app.post('/api/tasks', authMiddleware, async (req, res) => {
  const { title, due_date, priority } = req.body;

  if (!title || !due_date || !priority) {
    return res.status(400).json({ error: 'Поля title, due_date, priority обязательны' });
  }

  const newTask = {
    id: nextId++,
    title,
    due_date,
    priority,
    created_at: new Date().toISOString()
  };
  tasks.push(newTask);

  let emailUrl = null;
  try {
    emailUrl = await sendTaskNotification(newTask);
  } catch (err) {
    console.error('❌ Ошибка отправки email:', err.message);
  }
  
  res.status(201).json({ 
    ...newTask, 
    email_notification: emailUrl || 'не отправлено (ошибка)' 
  });
});

app.get('/api/tasks', authMiddleware, (req, res) => {
  res.json(tasks);
});

app.delete('/api/tasks/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const taskIndex = tasks.findIndex(task => task.id === id);
  
  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Задача не найдена' });
  }
  
  tasks.splice(taskIndex, 1);
  res.status(200).json({ message: 'Задача удалена', id });
});

async function start() {
  await setupEmail();
  app.listen(PORT, () => {
    console.log(`\nAPI запущен: http://localhost:${PORT}`);
    console.log(`API-ключ: ${VALID_API_KEY}\n`);
  });
}

start();