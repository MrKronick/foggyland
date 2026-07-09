const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ⚠️ Замени на свои данные от JSONBin
const BIN_ID = '6a4ce18bda38895dfe3a39ba'; // твой ID контейнера
const MASTER_KEY = '$2a$10$3B3/ISmfOUqsiYCSqnmEXuiqTvR71v1z1Qyr8dFsswufoGVLfHp16'; // твой мастер-ключ

const BIN_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
const ADMIN_SECRET = process.env.ADMIN_SECRET || '951902secret';

// Загрузка отзывов из JSONBin
async function loadReviews() {
  try {
    const res = await fetch(`${BIN_URL}/latest`, {
      headers: { 'X-Master-Key': MASTER_KEY }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.record || [];
  } catch (e) {
    console.error('Ошибка загрузки:', e);
    return [];
  }
}

// Сохранение отзывов в JSONBin
async function saveReviews(reviews) {
  try {
    await fetch(BIN_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': MASTER_KEY
      },
      body: JSON.stringify(reviews)
    });
  } catch (e) {
    console.error('Ошибка сохранения:', e);
  }
}

// Получить все отзывы
app.get('/reviews', async (req, res) => {
  const reviews = await loadReviews();
  res.json(reviews);
});

// Проверка, можно ли оставить отзыв с этого IP
app.get('/check-ip', async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  const reviews = await loadReviews();
  const hasReviewed = reviews.some(r => r.ip === ip);
  res.json({ allowed: !hasReviewed });
});

// Добавить новый отзыв
app.post('/reviews', async (req, res) => {
  const { nick, rating, comment, social } = req.body;
  if (!nick || !rating || !comment) {
    return res.status(400).json({ error: 'Заполните ник, оценку и комментарий' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  const reviews = await loadReviews();

  if (reviews.some(r => r.ip && r.ip === ip)) {
    return res.status(403).json({ error: 'Вы уже оставили отзыв с этого устройства.' });
  }

  const newReview = {
    id: Date.now(),
    nick,
    rating: Number(rating),
    comment,
    social: social || '',
    ip,
    date: new Date().toISOString(),
    reply: null
  };

  reviews.push(newReview);
  await saveReviews(reviews);
  res.status(201).json({ success: true });
});

// Ответ администратора на отзыв
app.post('/reply', async (req, res) => {
  const { reviewId, text, secret } = req.body;
  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Неверный секретный ключ' });
  }
  if (!reviewId || !text) {
    return res.status(400).json({ error: 'Укажите ID отзыва и текст ответа' });
  }

  const reviews = await loadReviews();
  const review = reviews.find(r => r.id == reviewId);
  if (!review) return res.status(404).json({ error: 'Отзыв не найден' });

  review.reply = { text, date: new Date().toISOString() };
  await saveReviews(reviews);
  res.json({ success: true });
});

// Сброс IP-адресов (разрешить повторные отзывы)
app.get('/reset-ips', async (req, res) => {
  if (req.query.secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Неверный секретный ключ' });
  }
  const reviews = await loadReviews();
  const updated = reviews.map(r => ({ ...r, ip: '' }));
  await saveReviews(updated);
  res.json({ success: true, message: 'IP-адреса сброшены' });
});

// Полный сброс всех отзывов
app.get('/reset', async (req, res) => {
  if (req.query.secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Неверный секретный ключ' });
  }
  await saveReviews([]);
  res.json({ success: true, message: 'Все отзывы удалены' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Сервер отзывов запущен на порту ${PORT}`));
