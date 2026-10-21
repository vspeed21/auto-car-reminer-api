import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app: Application = express();

// Imports de routers
import VehiculosRoutes from './routes/VehiculoRoutes';
import AuthRoutes from './routes/AuthRoutes';
import MantenimientosRoutes from './routes/MantenimientoRoutes';
import UsuariosRoutes from './routes/UsuariosRoutes';
import RecordatoriosRoutes from './routes/RecordatoriosRoutes';
import MarcaRoutes from './routes/MarcaRoutes';
import ModeloRoutes from './routes/ModeloRoutes';
import CatalogoRoutes from './routes/CatalogoRoutes';
import CombustibleRoutes from './routes/CombustibleRoutes';


// Configuracion inicial
app.disable('x-powered-by');
// Cloud Run / App Hosting llega por un unico proxy. No usar `true`: permite
// falsear X-Forwarded-For y saltarse el rate limit.
app.set('trust proxy', 1);
app.use(helmet());
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(express.json({ limit: '100kb' }));
app.use(cors());

// Routes
app.use('/api/vehiculos', VehiculosRoutes);
app.use('/api/auth', AuthRoutes);
app.use('/api/mantenimientos', MantenimientosRoutes);
app.use('/api/usuarios', UsuariosRoutes);
app.use('/api/recordatorios', RecordatoriosRoutes);
app.use('/api/marcas', MarcaRoutes);
app.use('/api/modelos', ModeloRoutes);
app.use('/api/catalogo', CatalogoRoutes);
app.use('/api/combustible', CombustibleRoutes);


export default app;
