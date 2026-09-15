import dotenv from 'dotenv';

dotenv.config();

const environment = {
  JWT_SECRET: process.env.JWT_SECRET ?? 'secret'
};

export default environment;
