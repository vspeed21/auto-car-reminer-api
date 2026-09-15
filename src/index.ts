import app from './app';

app.use('/', (req, res) => res.send('Thanks for using this boilerplate :)'));

const PORT = process.env.PORT || 8080;
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
