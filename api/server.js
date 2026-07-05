const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const DATA_FILE = path.join(__dirname, 'reviews.json');

// Инициализация файла, если его нет
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, '[]', 'utf8');
}

// Загрузка отзывов из файла
function loadReviews() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Ошибка чтения файла отзывов:', e);
    return [];
  }
}

// Сохранение отзывов в файл
function saveReviews(reviews) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(reviews, null, 2), 'utf8');
}

app.get('/reviews', (req, res) => {
  const reviews = loadReviews();
  res.json(reviews);
});

app.post('/reviews', (req, res) => {
  const { nick, rating, comment, social } = req.body;
  if (!nick || !rating || !comment) {
    return res.status(400).json({ error: 'Заполните ник, оценку и комментарий' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  const reviews = loadReviews();

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
  saveReviews(reviews);

  res.status(201).json({ success: true });
});

// Временный маршрут для очистки всех отзывов (удали после использования!)
app.get('/reset', (req, res) => {
  saveReviews([]);
  res.json({ success: true, message: 'Все отзывы удалены' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Сервер отзывов запущен на порту ${PORT}`));
