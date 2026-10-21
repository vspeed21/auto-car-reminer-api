import app from './app';

app.use((req, res) => res.status(404).json({
  error: true,
  code: 404,
  message: 'Ruta no encontrada',
}));

const PORT = process.env.PORT || 8080;
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
