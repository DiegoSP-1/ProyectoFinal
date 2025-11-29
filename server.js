const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configurar EJS como motor de plantillas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: false
}));

// Configuración de Multer para subir archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'), false);
    }
  }
});

// Conectar a MongoDB
mongoose.connect('mongodb+srv://Zamarripa:PETRA098@cluster0.j9omxaf.mongodb.net/?retryWrites=true&w=majority&appName=Version 1-Login y registros', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Conectado a MongoDB');
}).catch(err => {
  console.error('Error conectando a MongoDB:', err);
});

// Definir esquemas
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, default: 'user' },
  profile_picture: String
});

const reservationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fecha: { type: String, required: true },
  hora: { type: String, required: true },
  tableId: { type: Number, required: true }
});

const User = mongoose.model('User', userSchema);
const Reservation = mongoose.model('Reservation', reservationSchema);

// Crear administrador por defecto si no existe
User.findOne({ role: 'admin' }).then(admin => {
  if (!admin) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    const newAdmin = new User({ username: 'admin', password: hashedPassword, role: 'admin' });
    newAdmin.save().then(() => console.log('Administrador creado')).catch(err => console.error(err));
  }
});

// Middleware para verificar autenticación
function requireAuth(req, res, next) {
  if (req.session.userId) {
    return next();
  } else {
    if (req.headers['content-type'] === 'application/json') {
      res.status(401).json({ success: false, message: 'No autenticado' });
    } else {
      res.redirect('/login');
    }
  }
}

function requireAdmin(req, res, next) {
  if (req.session.role === 'admin') {
    return next();
  } else {
    res.status(403).send('Acceso denegado');
  }
}

// Rutas
app.get('/', (req, res) => {
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user && bcrypt.compareSync(password, user.password)) {
      req.session.userId = user._id;
      req.session.role = user.role;
      req.session.username = user.username;
      if (user.role === 'admin') {
        res.redirect('/admin');
      } else {
        res.redirect('/user');
      }
    } else {
      res.render('login', { error: 'Credenciales incorrectas' });
    }
  } catch (err) {
    res.render('login', { error: 'Error en el servidor' });
  }
});

app.get('/register', (req, res) => {
  res.render('register', { error: null });
});

app.post('/register', async (req, res) => {
  const { username, password, role } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);
  try {
    const newUser = new User({ username, password: hashedPassword, role });
    await newUser.save();
    req.session.userId = newUser._id;
    req.session.role = role;
    req.session.username = username;
    if (role === 'admin') {
      res.redirect('/admin');
    } else {
      res.redirect('/user');
    }
  } catch (err) {
    res.render('register', { error: 'Usuario ya existe' });
  }
});

app.get('/user', requireAuth, async (req, res) => {
  try {
    const reservations = await Reservation.find({ user_id: req.session.userId });
    const user = await User.findById(req.session.userId);
    res.render('user', { username: req.session.username, reservations, profilePicture: user ? user.profile_picture : null });
  } catch (err) {
    res.status(500).send('Error en el servidor');
  }
});

app.get('/admin', requireAuth, requireAdmin, async (req, res) => {
  try {
    const reservations = await Reservation.find().populate('user_id', 'username profile_picture');
    const user = await User.findById(req.session.userId);
    res.render('admin', { reservations, profilePicture: user ? user.profile_picture : null });
  } catch (err) {
    res.status(500).send('Error en el servidor');
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Reservaciones
app.get('/free-times', async (req, res) => {
  const { date } = req.query;
  const allTimes = ['12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00']; // Horas disponibles
  try {
    const reservations = await Reservation.find({ fecha: date });
    const occupiedTimes = reservations.map(r => r.hora);
    const freeTimes = allTimes.filter(time => !occupiedTimes.includes(time));
    res.json(freeTimes);
  } catch (err) {
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

app.post('/reserve', requireAuth, async (req, res) => {
  const { date, time, table } = req.body;
  if (!date || !time || !table) {
    return res.json({ success: false, message: 'Faltan datos requeridos' });
  }
  const tableNumber = parseInt(table);
  if (isNaN(tableNumber) || tableNumber <= 0) {
    return res.json({ success: false, message: 'Número de mesa inválido' });
  }
  const allowedTimes = ['12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];
  if (!allowedTimes.includes(time)) {
    return res.json({ success: false, message: 'Hora inválida' });
  }
  try {
    // Verificar si la mesa está libre
    const existingReservation = await Reservation.findOne({ fecha: date, hora: time, tableId: tableNumber });
    if (existingReservation) {
      res.json({ success: false, message: 'Mesa ocupada' });
    } else {
      const newReservation = new Reservation({ user_id: req.session.userId, fecha: date, hora: time, tableId: tableNumber });
      await newReservation.save();
      res.json({ success: true, message: 'Reservación exitosa' });
    }
  } catch (err) {
    res.json({ success: false, message: 'Error al reservar: ' + err.message });
  }
});

app.post('/edit-reservation/:id', requireAuth, async (req, res) => {
  const { date, time, table } = req.body;
  const tableNumber = parseInt(table);
  const id = req.params.id;
  try {
    const reservation = await Reservation.findById(id);
    if (!reservation) {
      return res.send('Reservación no encontrada');
    }
    if (req.session.role !== 'admin' && reservation.user_id.toString() !== req.session.userId) {
      return res.send('No autorizado');
    }
    reservation.fecha = date;
    reservation.hora = time;
    reservation.tableId = tableNumber;
    await reservation.save();
    res.redirect(req.session.role === 'admin' ? '/admin' : '/user');
  } catch (err) {
    res.send('Error al editar');
  }
});

app.post('/delete-reservation/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  try {
    const reservation = await Reservation.findById(id);
    if (!reservation) {
      return res.send('Reservación no encontrada');
    }
    if (req.session.role !== 'admin' && reservation.user_id.toString() !== req.session.userId) {
      return res.send('No autorizado');
    }
    await Reservation.findByIdAndDelete(id);
    res.redirect(req.session.role === 'admin' ? '/admin' : '/user');
  } catch (err) {
    res.send('Error al eliminar');
  }
});

app.post('/promote-user/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = req.params.id;
  try {
    const user = await User.findById(id);
    if (user) {
      user.role = 'admin';
      await user.save();
    }
    res.redirect('/admin');
  } catch (err) {
    res.status(500).send('Error al promover usuario');
  }
});

app.get('/search-reservations', requireAuth, requireAdmin, async (req, res) => {
  const username = req.query.username;
  try {
    const reservations = await Reservation.find().populate({
      path: 'user_id',
      match: { username: { $regex: username, $options: 'i' } },
      select: 'username profile_picture'
    }).exec();
    const filteredReservations = reservations.filter(r => r.user_id);
    const user = await User.findById(req.session.userId);
    res.render('admin', { reservations: filteredReservations, profilePicture: user ? user.profile_picture : null });
  } catch (err) {
    res.status(500).send('Error en el servidor');
  }
});

// Profile Picture Routes
app.post('/upload-profile-picture', requireAuth, upload.single('profilePicture'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No se subió ningún archivo');
  }

  const filename = req.file.filename;
  const userId = req.session.userId;

  // Obtener la foto anterior para eliminarla
  User.findById(userId).then(user => {
    if (user && user.profile_picture) {
      const oldPath = path.join(uploadsDir, user.profile_picture);
      fs.unlink(oldPath, (err) => {
        if (err) console.log('Error al eliminar archivo anterior:', err);
      });
    }

    // Actualizar la base de datos con la nueva foto
    user.profile_picture = filename;
    user.save().then(() => {
      res.redirect(req.session.role === 'admin' ? '/admin' : '/user');
    }).catch(err => {
      res.status(500).send('Error al actualizar la base de datos');
    });
  }).catch(err => {
    res.status(500).send('Error al obtener usuario');
  });
});

app.post('/delete-profile-picture', requireAuth, (req, res) => {
  const userId = req.session.userId;

  // Obtener la foto actual para eliminarla
  User.findById(userId).then(user => {
    if (user && user.profile_picture) {
      const filePath = path.join(uploadsDir, user.profile_picture);
      fs.unlink(filePath, (err) => {
        if (err) console.log('Error al eliminar archivo:', err);
      });

      // Actualizar la base de datos
      user.profile_picture = null;
      user.save().then(() => {
        res.redirect(req.session.role === 'admin' ? '/admin' : '/user');
      }).catch(err => {
        res.status(500).send('Error al actualizar la base de datos');
      });
    } else {
      res.redirect(req.session.role === 'admin' ? '/admin' : '/user');
    }
  }).catch(err => {
    res.status(500).send('Error al obtener usuario');
  });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
