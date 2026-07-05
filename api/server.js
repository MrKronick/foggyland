const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const NP_URL = 'https://api.npoint.io/d17fdc8a8a3d3587f2bd';

async function loadReviews() {
  try {
    const res = await fetch(NP_URL);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('Ошибка загрузки:', e);
    return [];
  }
}

async function saveReviews(reviews) {
  try {
    await fetch(NP_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
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

  if (reviews.some(r => r.ip === ip)) {
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

// Временный маршрут для очистки всех отзывов (удали после использования!)
app.get('/reset', async (req, res) => {
  await saveReviews([]);
  res.json({ success: true, message: 'Все отзывы удалены' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Сервер отзывов запущен на порту ${PORT}`));
