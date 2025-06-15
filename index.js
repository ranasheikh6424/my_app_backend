const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your_secret_key';

app.use(express.json());
app.use(cors());

const storage = multer.memoryStorage();
const upload = multer({ storage });

const uri = "mongodb+srv://myproject:mu7OsV1eeI2jlQMF@myapp-cluster.lzkmvxi.mongodb.net/myappdata?retryWrites=true&w=majority";
mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB Atlas'))
.catch((err) => console.error('❌ MongoDB connection error:', err));

// ===== Models =====
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  image: String,
});
const User = mongoose.model('User', userSchema);

const taskSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  title: String,
  description: String,
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});
const Task = mongoose.model('Task', taskSchema);

const blogSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  title: String,
  content: String,
  image: String,
  likesCount: { type: Number, default: 0 },
  sharesCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});
const Blog = mongoose.model('Blog', blogSchema);

const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  blogPost: { type: mongoose.Schema.Types.ObjectId, ref: 'Blog' },
  content: String,
  createdAt: { type: Date, default: Date.now },
});
const Comment = mongoose.model('Comment', commentSchema);

const likeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  blogPost: { type: mongoose.Schema.Types.ObjectId, ref: 'Blog' },
  createdAt: { type: Date, default: Date.now },
});
const Like = mongoose.model('Like', likeSchema);

const shareSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  blogPost: { type: mongoose.Schema.Types.ObjectId, ref: 'Blog' },
  createdAt: { type: Date, default: Date.now },
});
const Share = mongoose.model('Share', shareSchema);

// ===== JWT Middleware =====
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token missing' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// ===== Auth Routes =====
app.post('/signup', async (req, res) => {
  try {
    const { name, email, password, image } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword, image });
    await newUser.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Signup failed' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({
      message: 'Login successful',
      token,
      user: { id: user._id, name: user.name, email: user.email, image: user.image }
    });
  } catch (error) {
    res.status(500).json({ message: 'Login failed' });
  }
});

// ===== Task Routes =====
app.post('/tasks', authenticateToken, async (req, res) => {
  try {
    const { title, description } = req.body;
    const task = new Task({ user: req.user.userId, title, description });
    await task.save();
    res.status(201).json({ message: 'Task created', task });
  } catch {
    res.status(500).json({ message: 'Task creation error' });
  }
});

app.get('/tasks', authenticateToken, async (req, res) => {
  try {
    const tasks = await Task.find({ user: req.user.userId });
    res.status(200).json({ tasks });
  } catch {
    res.status(500).json({ message: 'Error fetching tasks' });
  }
});

app.put('/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const { title, description, completed } = req.body;
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.user.userId },
      { title, description, completed },
      { new: true }
    );
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.status(200).json({ message: 'Task updated', task });
  } catch {
    res.status(500).json({ message: 'Task update error' });
  }
});

app.delete('/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, user: req.user.userId });
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.status(200).json({ message: 'Task deleted' });
  } catch {
    res.status(500).json({ message: 'Task delete error' });
  }
});

// ===== Blog Routes =====
app.post('/blogs', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { title, content } = req.body;
    let image = req.file
      ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
      : null;

    const blog = new Blog({ userId: req.user.userId, title, content, image });
    await blog.save();
    res.status(201).json({ message: 'Blog created successfully', blog });
  } catch {
    res.status(500).json({ message: 'Error creating blog' });
  }
});

app.get('/blogs', async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 }).populate('userId', 'name image');
    res.status(200).json({ blogs });
  } catch {
    res.status(500).json({ message: 'Error fetching blogs' });
  }
});

app.get('/blogposts/:id', async (req, res) => {
  try {
    const blogPost = await Blog.findById(req.params.id).populate('userId', 'name email image');
    if (!blogPost) return res.status(404).json({ message: 'Blog post not found' });
    res.status(200).json({ blogPost });
  } catch {
    res.status(500).json({ message: 'Error fetching blog post' });
  }
});

app.put('/blogposts/:id', authenticateToken, upload.fields([{ name: 'image' }, { name: 'video' }]), async (req, res) => {
  try {
    const { title, content } = req.body;
    const updateData = { title, content };

    if (req.files?.image?.[0]) {
      const img = req.files.image[0];
      updateData.image = `data:${img.mimetype};base64,${img.buffer.toString('base64')}`;
    }

    const blogPost = await Blog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      updateData,
      { new: true }
    );

    if (!blogPost) return res.status(404).json({ message: 'Blog post not found or not authorized' });
    res.status(200).json({ message: 'Blog post updated', blogPost });
  } catch {
    res.status(500).json({ message: 'Blog post update error' });
  }
});

app.delete('/blogposts/:id', authenticateToken, async (req, res) => {
  try {
    const blogPost = await Blog.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!blogPost) return res.status(404).json({ message: 'Blog post not found or not authorized' });
    res.status(200).json({ message: 'Blog post deleted' });
  } catch {
    res.status(500).json({ message: 'Blog post delete error' });
  }
});

// ===== Comments =====
app.post('/blogposts/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    const blogPost = await Blog.findById(req.params.id);
    if (!blogPost) return res.status(404).json({ message: 'Blog post not found' });

    const comment = new Comment({ user: req.user.userId, blogPost: req.params.id, content });
    await comment.save();
    res.status(201).json({ message: 'Comment added', comment });
  } catch {
    res.status(500).json({ message: 'Comment creation error' });
  }
});

app.get('/blogposts/:id/comments', async (req, res) => {
  try {
    const comments = await Comment.find({ blogPost: req.params.id }).populate('user', 'name image');
    res.status(200).json({ comments });
  } catch {
    res.status(500).json({ message: 'Error fetching comments' });
  }
});

// DELETE /comments/:commentId
app.delete('/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const commentId = req.params.commentId;
    const userId = req.user.userId;  // Make sure this matches your JWT payload key

    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    if (comment.user.toString() !== userId) {
      return res.status(403).json({ message: 'You are not authorized to delete this comment' });
    }

    await Comment.findByIdAndDelete(commentId);
    res.status(200).json({ message: 'Comment deleted successfully' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});


// ===== Likes =====
app.post('/blogposts/:id/like', authenticateToken, async (req, res) => {
  try {
    const { id: blogPostId } = req.params;
    const userId = req.user.userId;

    const existingLike = await Like.findOne({ user: userId, blogPost: blogPostId });
    if (existingLike) return res.status(400).json({ message: 'Already liked' });

    await new Like({ user: userId, blogPost: blogPostId }).save();
    await Blog.findByIdAndUpdate(blogPostId, { $inc: { likesCount: 1 } });

    res.status(201).json({ message: 'Liked' });
  } catch {
    res.status(500).json({ message: 'Like error' });
  }
});

app.delete('/blogposts/:id/like', authenticateToken, async (req, res) => {
  try {
    const { id: blogPostId } = req.params;
    const userId = req.user.userId;

    const like = await Like.findOneAndDelete({ user: userId, blogPost: blogPostId });
    if (!like) return res.status(400).json({ message: 'Not liked yet' });

    await Blog.findByIdAndUpdate(blogPostId, { $inc: { likesCount: -1 } });

    res.status(200).json({ message: 'Unliked' });
  } catch {
    res.status(500).json({ message: 'Unlike error' });
  }
});

// ===== Shares =====
app.post('/blogposts/:id/share', authenticateToken, async (req, res) => {
  try {
    const blogPostId = req.params.id;
    const userId = req.user.userId;

    await new Share({ user: userId, blogPost: blogPostId }).save();
    await Blog.findByIdAndUpdate(blogPostId, { $inc: { sharesCount: 1 } });

    res.status(201).json({ message: 'Shared' });
  } catch {
    res.status(500).json({ message: 'Share error' });
  }
});

// ===== Start Server =====
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
