const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const DATA_FILE = path.join(__dirname, 'reviews.json');
const ADMIN_SECRET = process.env.ADMIN_SECRET || '951902secret';

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, '[]', 'utf8');
}

function loadReviews() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Ошибка чтения:', e);
    return [];
  }
}

function saveReviews(reviews) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(reviews, null, 2), 'utf8');
}

app.get('/reviews', (req, res) => {
  const reviews = loadReviews();
  res.json(reviews);
});

// Маршрут проверки IP (добавлен)
app.get('/check-ip', (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  const reviews = loadReviews();
  const hasReviewed = reviews.some(r => r.ip === ip);
  res.json({ allowed: !hasReviewed });
});

app.post('/reviews', (req, res) => {
  const { nick, rating, comment, social } = req.body;
  if (!nick || !rating || !comment) {
    return res.status(400).json({ error: 'Заполните ник, оценку и комментарий' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  const reviews = loadReviews();

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
  saveReviews(reviews);
  res.status(201).json({ success: true });
});

// Ответ на отзыв
app.post('/reply', (req, res) => {
  const { reviewId, text, secret } = req.body;
  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Неверный секретный ключ' });
  }
  if (!reviewId || !text) {
    return res.status(400).json({ error: 'Укажите ID отзыва и текст ответа' });
  }

  const reviews = loadReviews();
  const review = reviews.find(r => r.id == reviewId);
  if (!review) return res.status(404).json({ error: 'Отзыв не найден' });

  review.reply = { text, date: new Date().toISOString() };
  saveReviews(reviews);
  res.json({ success: true });
});

app.get('/reset-ips', (req, res) => {
  if (req.query.secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Неверный секретный ключ' });
  }
  const reviews = loadReviews();
  const updated = reviews.map(r => ({ ...r, ip: '' }));
  saveReviews(updated);
  res.json({ success: true, message: 'IP-адреса сброшены' });
});

app.get('/reset', (req, res) => {
  if (req.query.secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Неверный секретный ключ' });
  }
  saveReviews([]);
  res.json({ success: true, message: 'Все отзывы удалены' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Сервер отзывов запущен на порту ${PORT}`));
