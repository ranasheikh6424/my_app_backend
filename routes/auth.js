const User = require('./models/User'); // import model

app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Optional: check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Save new user
    const newUser = new User({ name, email, password });
    await newUser.save();

    res.status(201).json({ message: 'User signed up successfully!', user: newUser });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
