const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const DATA_FILE = path.join(__dirname, 'reviews.json');

// Загрузка отзывов из файла
function loadReviews() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Ошибка чтения файла отзывов:', e);
  }
  return [];
}

// Сохранение отзывов в файл
function saveReviews(reviews) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(reviews, null, 2), 'utf8');
}

let reviews = loadReviews();

// Получить все отзывы (публично)
app.get('/reviews', (req, res) => {
  res.json(reviews);
});

// Добавить отзыв (один раз с IP)
app.post('/reviews', (req, res) => {
  const { nick, rating, comment, social } = req.body;
  if (!nick || !rating || !comment) {
    return res.status(400).json({ error: 'Заполните ник, оценку и комментарий' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

  // Проверка, не оставлял ли уже этот IP отзыв
  const alreadyReviewed = reviews.some(r => r.ip === ip);
  if (alreadyReviewed) {
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
  saveReviews(reviews);

  res.status(201).json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Сервер отзывов запущен на порту ${PORT}`));
