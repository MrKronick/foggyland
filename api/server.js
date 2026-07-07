const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Твой JSONBin контейнер и API-ключ
const BIN_URL = 'https://api.jsonbin.io/v3/b/6a4ce18bda38895dfe3a39ba';
const MASTER_KEY = '$2a$10$3B3/ISmfOUqsiYCSqnmEXuiqTvR71v1z1Qyr8dFsswufoGVLfHp16';

// Загрузка отзывов
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

// Сохранение отзывов
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

app.get('/reviews', async (req, res) => {
  const reviews = await loadReviews();
  res.json(reviews);
});

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
    date: new Date().toISOString()
  };

  reviews.push(newReview);
  await saveReviews(reviews);

  res.status(201).json({ success: true });
});

// Сброс IP (только для админа)
app.get('/reset-ips', async (req, res) => {
  if (req.query.secret !== (process.env.ADMIN_SECRET || 'мой_секретный_ключ_2026')) {
    return res.status(403).json({ error: 'Неверный секретный ключ' });
  }
  const reviews = await loadReviews();
  const updated = reviews.map(r => ({ ...r, ip: '' }));
  await saveReviews(updated);
  res.json({ success: true, message: 'IP-адреса сброшены' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Сервер отзывов запущен на порту ${PORT}`));
